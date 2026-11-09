#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  SAFETY, catalogKey, classifyCommand, classifyTool, handle as rawHandle, hostModels, intentOfName, nameTokens, redact, runJudge,
} from "../hooks/pmnm-brake.mjs";

// Most tests exercise the brake's decisions inside a session that already loaded PMNM. This adapter
// loads the skill once per session and state directory before that session's first tool call, the
// way an agent does; the tests of the load stop itself call rawHandle directly.
const loadedSessions = new Set();
function handle(event, options = {}) {
  const session = typeof event.session_id === "string" ? event.session_id : "";
  const key = JSON.stringify([options.env?.PLUGIN_DATA || "", session, options.host]);
  if (event.hook_event_name === "PreToolUse" && session && !loadedSessions.has(key)) {
    loadedSessions.add(key);
    rawHandle({hook_event_name: "PreToolUse", session_id: session, cwd: event.cwd, tool_name: "Skill", tool_input: {skill: "please-make-no-mistakes:please-make-no-mistakes"}}, {host: options.host, env: options.env, folder: options.folder});
  }
  return rawHandle(event, options);
}

const CWD = "/work/repo";
const safety = (command, cwd = CWD) => classifyCommand(command, {cwd}).safety;

function temp(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pmnm-brake-test-"));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  return root;
}

// ---------------------------------------------------------------- tokens

test("names split into tokens across naming styles", () => {
  assert.deepEqual(nameTokens("deleteUser"), ["delete", "user"]);
  assert.deepEqual(nameTokens("remove_record"), ["remove", "record"]);
  assert.deepEqual(nameTokens("db:wipe"), ["db", "wipe"]);
  assert.deepEqual(nameTokens("mcp__store__bulkDelete"), ["mcp", "store", "bulk", "delete"]);
});

test("destructive intent is found by root at a token start, in several languages", () => {
  for (const name of ["deleteUser", "removeRecord", "purge-cache", "db:wipe", "dropAllTables", "teardown-env", "borrarUsuario", "eliminar_registro", "supprimerCompte", "reset-db"]) {
    assert.equal(intentOfName(name)?.safety, SAFETY.DESTRUCTIVE, name);
  }
});

test("short or embedded roots do not collide with ordinary words", () => {
  for (const name of ["delivery", "delay", "delegate", "model", "remote", "remember", "download"]) {
    assert.notEqual(intentOfName(name)?.safety, SAFETY.DESTRUCTIVE, name);
  }
});

// ---------------------------------------------------------------- deterministic layer

test("known destructive operations are destructive", () => {
  for (const command of [
    "rm -rf src", "rm notes.md", "find . -name '*.log' -delete", "git push --force origin main", "git reset --hard HEAD~3",
    "git clean -fd", "git branch -D topic", "git checkout -- src/app.js", "npm publish", "yarn npm publish", "cargo publish",
    "docker compose down -v", "docker rm web", "kubectl delete pod web-1", "systemctl restart nginx", "brew services stop postgresql",
    "pkill node", "terraform destroy", "curl -X DELETE https://api.example.com/users/1", "truncate -s 0 app.log",
    "psql -c \"DROP TABLE users\"", "psql -c 'TRUNCATE orders'", "mysql -e \"DELETE FROM sessions\"", "mongosh app --eval 'db.dropDatabase()'",
    "redis-cli FLUSHALL", "psql app <<'SQL'\nDROP TABLE audit;\nSQL", "bash -c 'rm -rf src'", "sudo rm -rf /var/lib/app",
    "echo \"$(rm -rf src)\"", "docker exec -it db psql -c 'DROP TABLE users'", "for f in a b; do rm $f; done", "npm run db:reset",
  ]) {
    assert.equal(safety(command), SAFETY.DESTRUCTIVE, command);
  }
});

test("state changes and secret reads are sensitive", () => {
  for (const command of [
    "npm install lodash", "git commit -m 'x'", "git push origin main", "mv a.js b.js", "chmod +x run.sh",
    "curl -X POST https://api.example.com/users -d '{}'", "kubectl apply -f deploy.yaml", "psql -c \"UPDATE users SET active=false\"",
    "cat .env", "printenv", "cat ~/.ssh/id_rsa", "gh auth token", "security find-generic-password -s x -w", "aws configure get aws_secret_access_key",
  ]) {
    assert.equal(safety(command), SAFETY.SENSITIVE, command);
  }
});

test("host plugin and marketplace changes are sensitive; listing them is safe", () => {
  for (const command of ["codex plugin marketplace add elnonathan/please-make-no-mistakes", "claude plugin install please-make-no-mistakes@please-make-no-mistakes",
    "claude plugin uninstall x@y", "claude plugin marketplace remove y", "claude plugin update x@y"]) {
    assert.equal(safety(command), SAFETY.SENSITIVE, command);
  }
  for (const command of ["claude plugin list", "codex plugin marketplace list", "claude plugin validate ."]) {
    assert.equal(safety(command), SAFETY.SAFE, command);
  }
});

test("ordinary work is safe, including the false positives discussed with the human", () => {
  for (const command of [
    "grep -rn \"rm -rf\" docs", "grep deleteUser src/", "psql -c \"SELECT id FROM users WHERE deleted_at IS NULL\"", "git log --grep=remove",
    "cat remove-notes.md", "rm -rf node_modules", "rm -rf dist build coverage", "rm -f /tmp/pmnm-scratch.txt",
    "git status", "cd /work/repo && git status", "export PATH=/opt/bin:$PATH", "cat >> notes.md <<'EOF'\nreset everything, del x\nEOF",
    "python3 -c \"print('hello')\"", "npx prettier --write src", "npx tsc --noEmit", "(cd src && ls)", "[ -f a.txt ] && cat a.txt",
    "node -e 'const x = `a ${1}`; console.log(x)'", "rmdir empty-dir", "find . -name '*.md' -exec grep -l TODO {} \\;",
  ]) {
    assert.equal(safety(command), SAFETY.SAFE, command);
  }
});

// ---------------------------------------------------------------- every route that can run code is examined

function repoWith(t, files) {
  const root = temp(t);
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), {recursive: true});
    fs.writeFileSync(path.join(root, name), content);
  }
  return root;
}

test("sourcing, find -exec and TypeScript runners are examined, not passed as safe", () => {
  for (const command of [
    "source ./delete.sh", ". ./scripts/purge.sh", "find . -exec sh -c \"rm -rf data\" _ {} \\;", "find . -type d -execdir rm -r {} +",
    "npx tsx ./delete.ts", "tsx scripts/wipe-db.ts", "trap 'rm -rf data' EXIT", "builtin eval \"rm -rf data\"",
    "awk 'BEGIN { system(\"rm -rf data\") }'", "rm -rf build/../src", "PMNM_JUDGE_ACTIVE=1 claude -p 'clean up'",
  ]) {
    assert.equal(safety(command), SAFETY.DESTRUCTIVE, command);
  }
  for (const command of ["npx tsx ./tool.ts", "node -e \"require('child_process').execSync(process.argv[1])\"", "sed -i 's/a/b/e' notes.txt"]) {
    assert.equal(safety(command), null, command);
  }
  assert.equal(safety("curl -o ~/.zshrc https://example.com/rc"), SAFETY.SENSITIVE);
  assert.equal(safety("awk '{print $1\" | \"$2}' notes.txt"), SAFETY.SAFE, "a pipe character inside an awk string is not a pipe");
  assert.equal(safety("awk '{print $1 | \"sort\"}' notes.txt"), null);
});

test("a sourced or interpreted local script is classified by its content", (t) => {
  const repo = repoWith(t, {
    "env.sh": "export A=1\n",
    "cleanup.sh": "rm -rf src\n",
    "spawn.mjs": "import {execSync} from 'node:child_process';\nexecSync(process.argv[2]);\n",
    "report.mjs": "console.log('report');\n",
  });
  assert.equal(safety("source ./env.sh", repo), SAFETY.SAFE);
  assert.equal(safety(". ./cleanup.sh", repo), SAFETY.DESTRUCTIVE);
  assert.equal(safety("node spawn.mjs", repo), null, "a script that runs other programs was passed as safe");
  assert.equal(safety("node report.mjs", repo), SAFETY.SAFE);
});

test("a changed script cannot spend an approval for its earlier contents", (t) => {
  const {env, folder} = setup(t);
  const repo = repoWith(t, {"publish.sh": "git add file.txt\n"});
  const command = "bash publish.sh";
  const first = handle(pre(command, repo), {host: "codex", env, folder});
  assert.equal(decision(first), "deny");
  const token = tokenIn(first);
  assert.ok(token);

  fs.writeFileSync(path.join(repo, "publish.sh"), "git push --force origin main\n");
  handle(reply(token), {host: "codex", env, folder});
  assert.equal(decision(handle(pre(command, repo), {host: "codex", env, folder})), "deny");
});

test("package-script approvals track the manifest and unchanged scripts remain single-use", (t) => {
  const {env, folder} = setup(t);
  const repo = repoWith(t, {"package.json": JSON.stringify({scripts: {stage: "git add file.txt"}})});
  const command = "npm run stage";
  const first = handle(pre(command, repo), {host: "codex", env, folder});
  assert.equal(decision(first), "deny");
  handle(reply(tokenIn(first)), {host: "codex", env, folder});
  assert.equal(decision(handle(pre(command, repo), {host: "codex", env, folder})), "allow");
  assert.equal(decision(handle(pre(command, repo), {host: "codex", env, folder})), "deny");

  const second = handle(pre(command, repo), {host: "codex", env, folder});
  handle(reply(tokenIn(second)), {host: "codex", env, folder});
  fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({scripts: {stage: "git push --force origin main"}}));
  assert.equal(decision(handle(pre(command, repo), {host: "codex", env, folder})), "deny");
});

test("package scripts and make targets are classified by what they run, not by their name", (t) => {
  const repo = repoWith(t, {
    "package.json": JSON.stringify({scripts: {build: "rm -rf src && tsc", test: "node --test", lint: "eslint .", "db:reset": "prisma migrate reset"}}),
    "Makefile": "all: build\n\nbuild:\n\trm -rf src\n\ncheck:\n\t@npx tsc --noEmit\n",
  });
  assert.equal(safety("npm run build", repo), SAFETY.DESTRUCTIVE, "a build script that deletes source passed by its name");
  assert.equal(safety("npm test", repo), SAFETY.SAFE);
  assert.equal(safety("npm run lint", repo), SAFETY.SAFE);
  assert.equal(safety("npm run db:reset", repo), SAFETY.DESTRUCTIVE);
  assert.equal(safety("make build", repo), SAFETY.DESTRUCTIVE, "a make target that deletes source passed by its name");
  assert.equal(safety("make", repo), SAFETY.DESTRUCTIVE, "the default target's prerequisites were not followed");
  assert.equal(safety("make check", repo), SAFETY.SAFE);
  assert.equal(safety("npm run build", path.join(repo, "nested")), SAFETY.DESTRUCTIVE, "npm finds the manifest in a parent directory");
});

test("the name rule reads a program or subcommand name, not free text", () => {
  assert.equal(safety("mystery deleted}"), null);
  assert.equal(safety("mystery 'records were deleted'"), null);
  assert.equal(safety("mytool delete-all"), SAFETY.DESTRUCTIVE);
  assert.equal(safety("heroku apps:destroy"), SAFETY.DESTRUCTIVE);
});

test("a repository inside temporary space is not disposable", () => {
  assert.equal(safety("rm -rf src", "/private/tmp/fixture"), SAFETY.DESTRUCTIVE);
  assert.equal(safety("rm -rf node_modules", "/private/tmp/fixture"), SAFETY.SAFE);
});

test("what layer 1 cannot place, and deletion calls inside code, go to the judge", () => {
  assert.equal(safety("npm run frobnicate"), null);
  assert.equal(safety("./scripts/frobnicate.sh"), null);
  assert.equal(safety("python3 -c \"import shutil; shutil.rmtree('data')\""), null);
});

test("non-shell tools: edits, secret files and MCP names", () => {
  assert.equal(classifyTool("Edit", {file_path: CWD + "/src/a.js"}, CWD).safety, SAFETY.SAFE);
  assert.equal(classifyTool("Write", {file_path: CWD + "/.env"}, CWD).safety, SAFETY.SENSITIVE);
  assert.equal(classifyTool("Read", {file_path: path.join(os.homedir(), ".ssh", "id_rsa")}, CWD).safety, SAFETY.SENSITIVE);
  assert.equal(classifyTool("Read", {file_path: CWD + "/src/a.js"}, CWD).safety, SAFETY.SAFE);
  assert.equal(classifyTool("Write", {file_path: "/etc/hosts"}, CWD).safety, SAFETY.SENSITIVE);
  assert.equal(classifyTool("mcp__db__deleteRecord", {id: 1}, CWD).safety, SAFETY.DESTRUCTIVE);
  assert.equal(classifyTool("mcp__db__listRecords", {}, CWD).safety, SAFETY.SAFE);
  assert.equal(classifyTool("mcp__crm__frobnicate", {}, CWD).safety, null);
});

// ---------------------------------------------------------------- the judge model: confirmed, available, re-evaluated

const CODEX_MODELS = ["gpt-big", "gpt-small"];
const CLAUDE_MODELS = ["claude-big", "claude-small"];

function codexCatalog(root, slugs) {
  const models = slugs.map((slug, index) => ({slug, priority: index + 1, visibility: "list", supported_in_api: true, supported_reasoning_levels: [{effort: "low"}]}));
  fs.writeFileSync(path.join(root, "models_cache.json"), JSON.stringify({fetched_at: "2026-10-18T00:00:00Z", models: [...models, {slug: "gpt-hidden", priority: 50, visibility: "hide", supported_in_api: true}]}));
  return root;
}
function claudeCatalog(root, ids) {
  const directory = path.join(root, "cache", "model-catalog");
  fs.mkdirSync(directory, {recursive: true});
  fs.writeFileSync(path.join(directory, "account-cc.json"), JSON.stringify({version: 2, fetchedAt: 2, catalog: {surface: "cc", config: {models: ids.map((id) => ({id, section: "main"}))}}}));
  fs.writeFileSync(path.join(directory, "old-cc.json"), JSON.stringify({version: 2, fetchedAt: 1, catalog: {surface: "cc", config: {models: [{id: "claude-stale"}]}}}));
  return root;
}
// Only the human's exact prompt confirms a judge model; the agent cannot send a prompt.
function confirmJudge(env, folder, host, model, extra = "") {
  return handle({hook_event_name: "UserPromptSubmit", session_id: "s1", prompt: ("PMNM-CONFIRM-JUDGE " + host + " " + model + " " + extra).trim()}, {host, env, folder});
}
function setup(t, {choose = true} = {}) {
  const folder = temp(t);
  const env = {PLUGIN_DATA: temp(t), CODEX_HOME: codexCatalog(temp(t), CODEX_MODELS), CLAUDE_CONFIG_DIR: claudeCatalog(temp(t), CLAUDE_MODELS)};
  if (choose) {
    confirmJudge(env, folder, "codex", "gpt-small");
    confirmJudge(env, folder, "claude", "claude-small");
  }
  return {folder, env};
}
function pre(command, cwd = CWD) {
  return {hook_event_name: "PreToolUse", session_id: "s1", cwd, tool_name: "Bash", tool_input: {command}};
}
function reply(prompt) {
  return {hook_event_name: "UserPromptSubmit", session_id: "s1", prompt};
}
function decision(output) {
  return output?.hookSpecificOutput?.permissionDecision || (output ? "notice" : "allow");
}
function tokenIn(output) {
  return output.hookSpecificOutput.permissionDecisionReason.match(/PMNM-[2-9A-HJKMNP-TV-Z]{4}\b/)?.[0];
}
function catalog(folder) {
  return JSON.parse(fs.readFileSync(path.join(folder, "commands.json"), "utf8"));
}

test("Codex's own catalog lists its models; no Claude Code file is read, even when one exists", (t) => {
  const {env} = setup(t);
  assert.deepEqual(hostModels("codex", {env}).ids, CODEX_MODELS);
  assert.equal(hostModels("claude", {env}), null, "a Claude Code cache file was read");
});

test("with no confirmed judge model the brake picks none: it asks and lists what the host offers", (t) => {
  const {folder, env} = setup(t, {choose: false});
  let calls = 0;
  const output = handle(pre("./bin/one"), {host: "codex", env, judge: () => { calls += 1; return {safety: "safe", confidence: "high", reason: "prints"}; }, folder});
  assert.equal(calls, 0, "the brake chose a judge model by itself");
  assert.equal(decision(output), "deny");
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /gpt-small/);
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /before continuing any task, propose the judge model: the cheapest model this host can run, with the lowest sum of input and output price per million tokens in the provider's current published documentation, never in local caches, and the newest on a tie/);
  assert.doesNotMatch(output.hookSpecificOutput.permissionDecisionReason, /gpt-hidden/);
});

test("the confirmed judge model is the one asked on each host", (t) => {
  const {folder, env} = setup(t);
  const asked = [];
  for (const host of ["codex", "claude"]) handle(pre("./bin/one"), {host, env, judge: (_host, model, _prompt, options) => { asked.push([model, options.reasoning]); return null; }, folder});
  assert.deepEqual(asked, [["gpt-small", "low"], ["claude-small", null]]);
});

test("a reasoning level the human confirmed is the one used", (t) => {
  const {folder, env} = setup(t);
  const confirmed = confirmJudge(env, folder, "codex", "gpt-small", "reasoning=medium");
  assert.match(String(confirmed?.hookSpecificOutput?.additionalContext), /gpt-small/);
  const asked = [];
  handle(pre("./bin/one"), {host: "codex", env, judge: (_host, _model, _prompt, options) => { asked.push(options.reasoning); return null; }, folder});
  assert.deepEqual(asked, ["medium"]);
});

test("models.json is the agent's proposal: writing it chooses no judge", (t) => {
  const {folder, env} = setup(t, {choose: false});
  fs.writeFileSync(path.join(folder, "models.json"), JSON.stringify({schema: "pmnm.models/v1", hosts: {codex: {model: "gpt-small", catalog_models: CODEX_MODELS}}}));
  let calls = 0;
  handle(pre("./bin/one"), {host: "codex", env, judge: () => { calls += 1; return null; }, folder});
  assert.equal(calls, 0, "a model written into models.json was used without the human's confirmation");
});

test("a forged judge confirmation in the brake's data is ignored", (t) => {
  const {folder, env} = setup(t, {choose: false});
  fs.mkdirSync(path.join(env.PLUGIN_DATA, "brake"), {recursive: true});
  fs.writeFileSync(path.join(env.PLUGIN_DATA, "brake", "judge.json"), JSON.stringify({hosts: {codex: {host: "codex", model: "gpt-small", reasoning: null, catalog_models: CODEX_MODELS, at: Date.now(), seal: "0".repeat(64)}}}));
  let calls = 0;
  handle(pre("./bin/one"), {host: "codex", env, judge: () => { calls += 1; return null; }, folder});
  assert.equal(calls, 0, "an unsealed judge confirmation was honored");
});

test("only the exact human prompt confirms a judge, and only a model the host offers", (t) => {
  const {folder, env} = setup(t, {choose: false});
  assert.doesNotMatch(JSON.stringify(handle(reply("por favor PMNM-CONFIRM-JUDGE codex gpt-small"), {host: "codex", env, folder})), /the human confirmed/);
  assert.equal(handle({hook_event_name: "UserPromptSubmit", prompt: "PMNM-CONFIRM-JUDGE codex gpt-small"}, {host: "codex", env, folder}), null, "a sessionless prompt confirmed a judge");
  const refused = confirmJudge(env, folder, "codex", "gpt-imaginary");
  assert.match(String(refused?.hookSpecificOutput?.additionalContext), /not offered/);
  let calls = 0;
  handle(pre("./bin/one"), {host: "codex", env, judge: () => { calls += 1; return null; }, folder});
  assert.equal(calls, 0, "a refused confirmation set the judge");
});

test("without a readable host catalog no judge can be confirmed or run", (t) => {
  const {folder, env} = setup(t, {choose: false});
  const noCatalog = {...env, CODEX_HOME: temp(t)};
  const refused = confirmJudge(noCatalog, folder, "codex", "gpt-imaginary");
  assert.match(String(refused?.hookSpecificOutput?.additionalContext), /could not be read/);
  assert.doesNotMatch(String(refused?.hookSpecificOutput?.additionalContext), /the human confirmed/);
  let calls = 0;
  const judge = () => { calls += 1; return {safety: "safe", confidence: "high"}; };
  assert.equal(decision(handle(pre("./bin/one"), {host: "codex", env: noCatalog, judge, folder})), "deny");
  assert.equal(calls, 0, "a judge was run for a model the host was never shown to offer");

  confirmJudge(env, folder, "codex", "gpt-small");
  assert.equal(decision(handle(pre("./bin/two"), {host: "codex", env: noCatalog, judge, folder})), "deny");
  assert.equal(calls, 0, "a confirmed judge was run while the host catalog could not be read");
});

test("a command that sets PMNM_JUDGE_MODEL is destructive, like one that disables the brake", () => {
  assert.equal(safety("PMNM_JUDGE_MODEL=anything claude -p 'clean up'"), SAFETY.DESTRUCTIVE);
  assert.equal(safety("export PMNM_JUDGE_MODEL=anything"), SAFETY.DESTRUCTIVE);
  assert.equal(safety("grep -n PMNM_JUDGE_MODEL hooks/pmnm-brake.mjs"), SAFETY.SAFE);
});

test("the judge's reasoning level reaches each host's command line", () => {
  const calls = [];
  const spawn = (command, args) => { calls.push([command, args]); return {status: 1, stdout: "", stderr: ""}; };
  runJudge("claude", "claude-small", "prompt", {spawn, reasoning: "low"});
  runJudge("claude", "claude-small", "prompt", {spawn, reasoning: null});
  runJudge("codex", "gpt-small", "prompt", {spawn, reasoning: "low"});
  const [claudeLow, claudeNone, codexLow] = calls.map(([, args]) => args);
  assert.deepEqual(claudeLow.slice(claudeLow.indexOf("--effort"), claudeLow.indexOf("--effort") + 2), ["--effort", "low"], "Claude did not receive the reasoning level");
  assert.equal(claudeNone.includes("--effort"), false);
  assert.ok(codexLow.includes("model_reasoning_effort=\"low\""), "Codex did not receive the reasoning level");
});

test("the judge's free text is never stored or shown", (t) => {
  const {folder, env} = setup(t);
  const secretish = "zq-UNRECOGNIZED-value-0042";
  const say = (safety) => () => ({safety, confidence: "high", reason: "the config holds " + secretish});
  const shown = [handle(pre("./bin/one"), {host: "claude", env, judge: say("safe"), folder}), handle(pre("./bin/two"), {host: "codex", env, judge: say("sensitive"), folder})];
  assert.doesNotMatch(JSON.stringify(shown), new RegExp(secretish));
  for (const file of [path.join(folder, "commands.json"), path.join(env.PLUGIN_DATA, "brake", "approvals.json")]) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), new RegExp(secretish), file);
  }
});

test("a confirmed model gone from the host catalog is not asked, and no other model is tried", (t) => {
  const {folder, env} = setup(t);
  codexCatalog(env.CODEX_HOME, ["gpt-big"]);
  let calls = 0;
  const output = handle(pre("./bin/one"), {host: "codex", env, judge: () => { calls += 1; return null; }, folder});
  assert.equal(calls, 0);
  assert.equal(decision(output), "deny");
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /gpt-small is no longer in the codex model catalog/);
});

test("a changed host catalog keeps the confirmed model and asks for a re-evaluation once, naming what is new", (t) => {
  const {folder, env} = setup(t);
  codexCatalog(env.CODEX_HOME, [...CODEX_MODELS, "gpt-newer"]);
  const asked = [];
  handle(pre("./bin/one"), {host: "codex", env, judge: (_host, model) => { asked.push(model); return {safety: "safe", confidence: "high", reason: "prints"}; }, folder});
  assert.deepEqual(asked, ["gpt-small"], "a catalog change switched the judge without the human");
  const first = handle(reply("hola"), {host: "codex", env, folder});
  assert.match(String(first?.hookSpecificOutput?.additionalContext), /new: gpt-newer/);
  assert.match(String(first?.hookSpecificOutput?.additionalContext), /before continuing any task, propose the judge model: the cheapest model this host can run, with the lowest sum of input and output price per million tokens in the provider's current published documentation, never in local caches, and the newest on a tie/);
  assert.equal(handle(reply("otra cosa"), {host: "codex", env, folder}), null, "the re-evaluation notice repeated");
});

test("a judge model that does not answer gets no automatic fallback", (t) => {
  const {folder, env} = setup(t);
  const asked = [];
  const output = handle(pre("./bin/one"), {host: "claude", env, judge: (_host, model) => { asked.push(model); return null; }, folder});
  assert.deepEqual(asked, ["claude-small"]);
  assert.equal(decision(output), "deny");
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /propose the judge model: the cheapest model this host can run, with the lowest sum of input and output price per million tokens in the provider's current published documentation/);
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /sending the prompt PMNM-CONFIRM-JUDGE claude <model> \[reasoning=<level>\]/);
  assert.doesNotMatch(output.hookSpecificOutput.permissionDecisionReason, /\[redacted\]/, "the brake masked its own notice");
});

test("PMNM_JUDGE_MODEL pins the judge for that environment", (t) => {
  const {folder, env} = setup(t, {choose: false});
  const asked = [];
  handle(pre("./bin/one"), {host: "claude", env: {...env, PMNM_JUDGE_MODEL: "pinned"}, judge: (_host, model) => { asked.push(model); return null; }, folder});
  assert.deepEqual(asked, ["pinned"]);
});

test("safe with high confidence runs and is stored; the next time the model is not asked", (t) => {
  const {folder, env} = setup(t);
  let calls = 0;
  const judge = () => { calls += 1; return {safety: "safe", confidence: "high", reason: "prints a report"}; };
  for (const host of ["claude", "codex"]) {
    assert.notEqual(decision(handle(pre("npm run frobnicate"), {host, env, judge, folder})), "deny");
  }
  assert.equal(calls, 1, "the stored verdict was not reused across hosts");
  const entries = Object.values(catalog(folder).commands);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].safety, "safe");
  assert.equal(entries[0].source, "model");
});

test("safe with medium confidence asks and is not stored until the human approves", (t) => {
  const {folder, env} = setup(t);
  let calls = 0;
  const judge = () => { calls += 1; return {safety: "safe", confidence: "medium", reason: "probably prints a report"}; };
  const first = handle(pre("npm run frobnicate"), {host: "claude", env, judge, folder});
  assert.equal(decision(first), "deny");
  const storedBeforeApproval = fs.existsSync(path.join(folder, "commands.json")) ? Object.keys(catalog(folder).commands).length : 0;
  assert.equal(storedBeforeApproval, 0, "a medium-confidence verdict was stored without the human");
  handle(reply(tokenIn(first)), {host: "claude", env, judge, folder});
  assert.equal(decision(handle(pre("npm run frobnicate"), {host: "claude", env, judge, folder})), "allow", "the approved run did not pass");
  assert.equal(decision(handle(pre("npm run frobnicate"), {host: "claude", env, judge, folder})), "allow", "an approved safe operation asked again");
  assert.equal(calls, 1, "an approved operation went back to the model");
  assert.equal(Object.values(catalog(folder).commands)[0].source, "human");
});

test("an approved sensitive operation asks directly next time, without the model", (t) => {
  const {folder, env} = setup(t);
  let calls = 0;
  const judge = () => { calls += 1; return {safety: "sensitive", confidence: "high", reason: "writes deploy configuration"}; };
  const first = handle(pre("./bin/configure --set region=eu"), {host: "codex", env, judge, folder});
  handle(reply(tokenIn(first)), {host: "codex", env, judge, folder});
  assert.equal(decision(handle(pre("./bin/configure --set region=eu"), {host: "codex", env, judge, folder})), "allow", "the approved run did not pass");
  const again = handle(pre("./bin/configure --set region=eu"), {host: "codex", env, judge, folder});
  assert.equal(decision(again), "deny");
  assert.match(again.hookSpecificOutput.permissionDecisionReason, /stored/);
  assert.equal(calls, 1, "a stored sensitive rating went back to the model");
});

test("deterministic destructive rules override any catalog entry", (t) => {
  const {folder, env} = setup(t);
  const key = catalogKey("Bash", {command: "rm -rf src"}, CWD);
  fs.writeFileSync(path.join(folder, "commands.json"), JSON.stringify({schema: "pmnm.commands/v1", commands: {[key]: {safety: "safe", confidence: "high", source: "human"}}}));
  assert.equal(decision(handle(pre("rm -rf src"), {host: "claude", env, judge: () => null, folder})), "deny");
});

test("a changed script invalidates its stored verdict", (t) => {
  const {folder, env} = setup(t);
  const repo = temp(t);
  let calls = 0;
  const judge = () => { calls += 1; return {safety: "safe", confidence: "high", reason: "prints"}; };
  const run = () => handle(pre("python3 tool.py", repo), {host: "claude", env, judge, folder});
  // A script with no deletion call is placed by layer 1, so this one only mentions one.
  fs.writeFileSync(path.join(repo, "tool.py"), "import shutil  # shutil.rmtree is only mentioned\nprint('report')\n");
  run();
  run();
  assert.equal(calls, 1);
  fs.writeFileSync(path.join(repo, "tool.py"), "import shutil\nshutil.rmtree('/data')\n");
  run();
  assert.equal(calls, 2, "the edited script reused the old verdict");
});

test("the key is the exact command: different flags are different entries", () => {
  assert.notEqual(catalogKey("Bash", {command: "tool -a -b"}, CWD), catalogKey("Bash", {command: "tool -a -bc"}, CWD));
  assert.equal(catalogKey("Bash", {command: "tool  -a   -b"}, CWD), catalogKey("Bash", {command: "tool -a -b"}, CWD));
});

test("spacing inside quotes and heredoc bodies is part of the key", () => {
  assert.notEqual(catalogKey("Bash", {command: "tool --name 'a  b'"}, CWD), catalogKey("Bash", {command: "tool --name 'a b'"}, CWD));
  assert.notEqual(catalogKey("Bash", {command: "tool \"x\ty\""}, CWD), catalogKey("Bash", {command: "tool \"x y\""}, CWD));
  assert.notEqual(
    catalogKey("Bash", {command: "python3 - <<'PY'\nif x:\n    run()\nPY"}, CWD),
    catalogKey("Bash", {command: "python3 - <<'PY'\nif x:\nrun()\nPY"}, CWD),
  );
  assert.equal(catalogKey("Bash", {command: "  tool   'a  b'  "}, CWD), catalogKey("Bash", {command: "tool 'a  b'"}, CWD));
});

test("the catalog stores no preview, and every stored or shown reason is redacted", (t) => {
  const {folder, env} = setup(t);
  const judge = () => ({safety: "safe", confidence: "high", reason: "uses MY_PRIVATE_TOKEN=shortValue123 to read status"});
  const output = handle(pre("./bin/status --token sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789"), {host: "claude", env, judge, folder});
  const text = fs.readFileSync(path.join(folder, "commands.json"), "utf8");
  assert.doesNotMatch(text, /abcdefghijklmnopqrstuvwxyz0123456789/);
  assert.doesNotMatch(text, /shortValue123/);
  assert.doesNotMatch(text, /"preview"/);
  assert.doesNotMatch(JSON.stringify(output), /shortValue123/);
  const asked = handle(pre("./bin/other"), {host: "codex", env, judge: () => ({safety: "sensitive", confidence: "high", reason: "sets PASSWORD=hunter2hunter"}), folder});
  assert.doesNotMatch(JSON.stringify(asked), /hunter2hunter/);
});

test("redaction covers named secret variables and credential flags", () => {
  const masked = redact("MY_PRIVATE_TOKEN=shortValue123 --credential xyz --client-secret=abc123 -H 'Cookie: sid=s3cr3t'");
  for (const secret of ["shortValue123", "xyz", "abc123", "s3cr3t"]) assert.doesNotMatch(masked, new RegExp(secret), secret);
  assert.doesNotMatch(redact("curl -H 'Authorization: Bearer abc.def.ghi'"), /abc\.def\.ghi/);
  assert.doesNotMatch(redact("curl -u me:pw --header 'X-Api-Key: k3y'"), /k3y/);
  assert.doesNotMatch(redact("PASSWORD=hunter2hunter"), /hunter2hunter/);
  assert.equal(redact("npm run build --workspace app"), "npm run build --workspace app");
});

// ---------------------------------------------------------------- nothing stored grants authority by itself

test("a forged or copied catalog entry grants nothing", (t) => {
  const {folder, env} = setup(t);
  const forgedKey = catalogKey("Bash", {command: "./bin/forged"}, CWD);
  fs.writeFileSync(path.join(folder, "commands.json"), JSON.stringify({schema: "pmnm.commands/v1", commands: {[forgedKey]: {safety: "safe", confidence: "high", source: "human"}}}));
  assert.equal(decision(handle(pre("./bin/forged"), {host: "claude", env, judge: () => null, folder})), "deny", "an unsigned entry was honored");

  handle(pre("./bin/genuine"), {host: "claude", env, judge: () => ({safety: "safe", confidence: "high", reason: "prints"}), folder});
  const stored = catalog(folder);
  const genuine = stored.commands[catalogKey("Bash", {command: "./bin/genuine"}, CWD)];
  stored.commands[catalogKey("Bash", {command: "./bin/copied"}, CWD)] = genuine;
  fs.writeFileSync(path.join(folder, "commands.json"), JSON.stringify(stored));
  assert.equal(decision(handle(pre("./bin/copied"), {host: "claude", env, judge: () => null, folder})), "deny", "a signed entry moved to another operation was honored");
});

test("a forged grant in the brake's data is not honored", (t) => {
  const {folder, env} = setup(t);
  const approvals = path.join(env.PLUGIN_DATA, "brake", "approvals.json");
  handle(pre("rm -rf src"), {host: "codex", env, folder});
  const state = JSON.parse(fs.readFileSync(approvals, "utf8"));
  state.granted.push({hash: state.pending[0].hash, session: "s1", at: Date.now(), seal: "0".repeat(64)});
  fs.writeFileSync(approvals, JSON.stringify(state));
  assert.equal(decision(handle(pre("rm -rf src"), {host: "codex", env, folder})), "deny");
});

test("commands that touch the brake's own state are denied, even where the host could ask", (t) => {
  const {folder, env} = setup(t);
  const target = path.join(env.PLUGIN_DATA, "brake", "approvals.json");
  assert.equal(decision(handle(pre("cat " + target), {host: "claude", env, folder})), "deny");
  assert.equal(decision(handle({...pre("x"), tool_name: "Write", tool_input: {file_path: path.join(env.PLUGIN_DATA, "brake", "catalog.key"), content: "x"}}, {host: "claude", env, folder})), "deny");
});

// ---------------------------------------------------------------- MCP servers the human allows

const SEMANTIC_JS = "plugin_semantic-js-mcp_semantic-js-mcp";
const SERVER = "plugin_acme_tools";
function mcp(tool, input = {symbol: "handle"}) {
  return {hook_event_name: "PreToolUse", session_id: "s1", cwd: CWD, tool_name: "mcp__" + SERVER + "__" + tool, tool_input: input};
}

test("every semantic-js-mcp tool is known and safe on both hosts, like ls; a tool named for destruction still stops", () => {
  const tools = ["lsp_references", "lsp_count_references", "lsp_reference_page", "lsp_unresolved_reference_page", "lsp_definition", "lsp_hover",
    "lsp_diagnostics", "lsp_document_symbols", "lsp_workspace_symbols", "lsp_audit_symbol", "lsp_audit_named_symbol", "lsp_count_named_symbol",
    "lsp_count_text_matches", "lsp_prepare_workspace_root", "lsp_authorize_workspace_root", "lsp_future_tool"];
  for (const server of [SEMANTIC_JS, "semantic-js-mcp", "semantic_js_mcp"]) {
    for (const tool of tools) assert.equal(classifyTool("mcp__" + server + "__" + tool, {symbol: "handle"}, CWD).safety, SAFETY.SAFE, server + " " + tool);
    assert.equal(classifyTool("mcp__" + server + "__lsp_delete_cache", {}, CWD).safety, SAFETY.DESTRUCTIVE, server);
  }
  assert.equal(classifyTool("mcp__other-server__lsp_references", {}, CWD).safety, null, "another server borrowed semantic-js-mcp's trust");
  for (const impostor of ["plugin_fake_semantic-js-mcp", "plugin_semantic-js-mcp_other", "semantic-js-mcp-evil", "x_semantic_js_mcp"]) {
    assert.equal(classifyTool("mcp__" + impostor + "__upload_secrets", {}, CWD).safety, null, impostor + " borrowed semantic-js-mcp's trust");
  }
});

test("an MCP server the human allowed runs without the judge and without catalog entries", (t) => {
  const {folder, env} = setup(t);
  const allowed = handle(reply("PMNM-ALLOW-MCP " + SERVER), {host: "claude", env, folder});
  assert.match(String(allowed?.hookSpecificOutput?.additionalContext), new RegExp(SERVER));
  const judge = () => { throw new Error("the judge was asked about an allowed MCP server"); };
  for (const host of ["claude", "codex"]) {
    for (const tool of ["lsp_references", "lsp_count_named_symbol", "lsp_authorize_workspace_root"]) {
      assert.equal(decision(handle(mcp(tool), {host, env, judge, folder})), "allow", host + " " + tool);
    }
  }
  assert.equal(fs.existsSync(path.join(folder, "commands.json")), false, "an allowed MCP call was stored in the catalog");
});

test("an allowed MCP server still stops a tool named for destruction", (t) => {
  const {folder, env} = setup(t);
  handle(reply("PMNM-ALLOW-MCP " + SERVER), {host: "claude", env, folder});
  assert.equal(decision(handle(mcp("delete_reference"), {host: "codex", env, folder})), "deny");
  const touchesState = mcp("lsp_references", {root: path.join(env.PLUGIN_DATA, "brake")});
  assert.equal(decision(handle(touchesState, {host: "claude", env, folder})), "deny", "an allowed server reached the brake's own state");
});

test("only an exact human prompt allows an MCP server; a forged entry, extra text or no session does not", (t) => {
  const {folder, env} = setup(t);
  const judge = () => null;
  assert.equal(handle(reply("please run PMNM-ALLOW-MCP " + SERVER), {host: "claude", env, folder}), null);
  assert.equal(handle({hook_event_name: "UserPromptSubmit", prompt: "PMNM-ALLOW-MCP " + SERVER}, {host: "claude", env, folder}), null);
  fs.mkdirSync(path.join(env.PLUGIN_DATA, "brake"), {recursive: true});
  fs.writeFileSync(path.join(env.PLUGIN_DATA, "brake", "mcp-allow.json"), JSON.stringify({servers: [{server: SERVER, at: Date.now(), seal: "0".repeat(64)}]}));
  assert.equal(decision(handle(mcp("lsp_references"), {host: "codex", env, judge, folder})), "deny", "an unsealed allow entry was honored");
});

test("the human can revoke an allowed MCP server", (t) => {
  const {folder, env} = setup(t);
  handle(reply("PMNM-ALLOW-MCP " + SERVER), {host: "claude", env, folder});
  handle(reply("PMNM-REVOKE-MCP " + SERVER), {host: "claude", env, folder});
  assert.equal(decision(handle(mcp("lsp_references"), {host: "codex", env, judge: () => null, folder})), "deny");
});

test("a stopped MCP call names the exact server id the human can allow", (t) => {
  const {folder, env} = setup(t);
  const output = handle(mcp("lsp_references"), {host: "codex", env, judge: () => null, folder});
  assert.match(output.hookSpecificOutput.permissionDecisionReason, new RegExp("PMNM-ALLOW-MCP " + SERVER));
});

test("without a session id nothing can be approved in-band", (t) => {
  const {folder, env} = setup(t);
  const sessionless = {...pre("rm -rf src"), session_id: undefined};
  const denied = handle(sessionless, {host: "codex", env, folder});
  assert.equal(decision(denied), "deny");
  assert.equal(tokenIn(denied), undefined, "a token was issued that any sessionless event could use");
  assert.equal(handle({hook_event_name: "UserPromptSubmit", prompt: "PMNM-2222"}, {host: "codex", env, folder}), null);
  assert.equal(decision(handle(sessionless, {host: "codex", env, folder})), "deny");
});

test("a used token never approves the same operation again", (t) => {
  const {folder, env} = setup(t);
  const first = handle(pre("rm -rf src"), {host: "codex", env, folder});
  const retry = handle(pre("rm -rf src"), {host: "codex", env, folder});
  assert.equal(tokenIn(retry), tokenIn(first), "a retry before the human answered changed the token");
  handle(reply(tokenIn(first)), {host: "codex", env, folder});
  assert.equal(decision(handle(pre("rm -rf src"), {host: "codex", env, folder})), "allow");
  const second = handle(pre("rm -rf src"), {host: "codex", env, folder});
  assert.notEqual(tokenIn(second), tokenIn(first), "the same operation pending again reused the old token");
  assert.match(String(handle(reply(tokenIn(first)), {host: "codex", env, folder})?.hookSpecificOutput?.additionalContext), /is not an open approval in this session/);
  assert.equal(decision(handle(pre("rm -rf src"), {host: "codex", env, folder})), "deny");
});

test("judge calls and catalog hits are counted, without command text", (t) => {
  const {folder, env} = setup(t);
  const judge = () => ({safety: "safe", confidence: "high", reason: "prints"});
  handle(pre("./bin/report --secret-name x"), {host: "claude", env, judge, folder});
  handle(pre("./bin/report --secret-name x"), {host: "claude", env, judge, folder});
  handle(pre("./bin/other"), {host: "claude", env, judge: () => null, folder});
  const stats = JSON.parse(fs.readFileSync(path.join(env.PLUGIN_DATA, "brake", "stats.json"), "utf8"));
  assert.equal(stats.judge_calls, 2);
  assert.equal(stats.judge_unanswered, 1);
  assert.equal(stats.catalog_hits, 1);
  assert.doesNotMatch(JSON.stringify(stats), /report|other/);
});

test("no judge answer is not a yes", (t) => {
  const {folder, env} = setup(t);
  assert.equal(decision(handle(pre("npm run frobnicate"), {host: "claude", env, judge: () => null, folder})), "deny");
  assert.equal(fs.existsSync(path.join(folder, "commands.json")) ? Object.keys(catalog(folder).commands).length : 0, 0);
});

test("known operations never call the judge", (t) => {
  const {folder, env} = setup(t);
  const judge = () => { throw new Error("the judge was called for a known operation"); };
  for (const command of ["rm -rf src", "git status", "npm install x", "rm -rf node_modules", "cat .env"]) {
    handle(pre(command), {host: "codex", env, judge, folder});
  }
});

test("host decisions: destructive denies with a token on both hosts; deterministic sensitive asks natively in Claude", (t) => {
  const {folder, env} = setup(t);
  for (const host of ["claude", "codex"]) {
    const output = handle(pre("rm -rf src"), {host, env, judge: () => null, folder});
    assert.equal(decision(output), "deny");
    assert.ok(tokenIn(output));
  }
  assert.equal(decision(handle(pre("npm install x"), {host: "claude", env, judge: () => null, folder})), "ask");
  const codex = handle(pre("npm install x"), {host: "codex", env, judge: () => null, folder});
  assert.equal(decision(codex), "deny");
  assert.ok(tokenIn(codex));
});

test("the exact token allows the exact operation once; a question or another reply does not", (t) => {
  const {folder, env} = setup(t);
  const denied = handle(pre("rm -rf src"), {host: "codex", env, folder});
  for (const text of ["¿solo fue una ronda?", "sí, adelante", "no acepto"]) {
    assert.equal(handle(reply(text), {host: "codex", env, folder}), null, text);
  }
  assert.equal(decision(handle(pre("rm -rf src"), {host: "codex", env, folder})), "deny");
  handle(reply(tokenIn(denied)), {host: "codex", env, folder});
  assert.equal(decision(handle(pre("rm -rf src"), {host: "codex", env, folder})), "allow");
  assert.equal(decision(handle(pre("rm -rf src"), {host: "codex", env, folder})), "deny", "the approval was reusable");
});

test("a pending approval survives other operations in between", (t) => {
  const {folder, env} = setup(t);
  const denied = handle(pre("rm -rf src"), {host: "codex", env, folder});
  handle(pre("git status"), {host: "codex", env, folder});
  handle(pre("npm install x"), {host: "codex", env, folder});
  handle(reply(tokenIn(denied)), {host: "codex", env, folder});
  assert.equal(decision(handle(pre("rm -rf src"), {host: "codex", env, folder})), "allow");
});

test("the judge's own CLI run cannot re-enter the brake", (t) => {
  const {folder, env} = setup(t);
  assert.equal(handle(pre("rm -rf src"), {host: "claude", env: {...env, PMNM_JUDGE_ACTIVE: "1"}, folder}), null);
});

// ---------------------------------------------------------------- edits inside the PMNM folder

const ELSEWHERE = "/work/elsewhere";
function edit(file, tool = "Edit") {
  return {hook_event_name: "PreToolUse", session_id: "s1", cwd: ELSEWHERE, tool_name: tool, tool_input: {file_path: file}};
}
function patch(lines) {
  return {hook_event_name: "PreToolUse", session_id: "s1", cwd: ELSEWHERE, tool_name: "apply_patch", tool_input: {command: "*** Begin Patch\n" + lines + "\n*** End Patch"}};
}

test("an edit inside the PMNM folder is ordinary editing on both hosts", (t) => {
  const {folder, env} = setup(t);
  const target = path.join(folder, "projects", "p", "tasks", "T-1", "index.md");
  for (const host of ["claude", "codex"]) {
    for (const tool of ["Edit", "Write", "MultiEdit"]) assert.equal(decision(handle(edit(target, tool), {host, env, folder})), "allow", host + " " + tool);
    assert.equal(decision(handle(patch("*** Update File: " + target), {host, env, folder})), "allow", host + " apply_patch");
  }
  assert.equal(classifyTool("Write", {file_path: target}, ELSEWHERE, folder).safety, SAFETY.SAFE);
});

test("an edit outside both the working directory and the PMNM folder still asks", (t) => {
  const {folder, env} = setup(t);
  const outside = temp(t);
  for (const target of [path.join(outside, "x.md"), path.join(folder, "..", path.basename(outside), "x.md"), folder + "-other/x.md"]) {
    assert.equal(decision(handle(edit(target), {host: "claude", env, folder})), "ask", target);
    assert.equal(decision(handle(edit(target), {host: "codex", env, folder})), "deny", target);
  }
});

test("without a PMNM folder every edit decision stays as before", () => {
  assert.equal(classifyTool("Write", {file_path: "/tmp/pmnm/x.md"}, CWD).safety, SAFETY.SENSITIVE);
  assert.equal(classifyTool("Write", {file_path: "/tmp/pmnm/x.md"}, CWD, null).safety, SAFETY.SENSITIVE);
  assert.equal(classifyTool("Write", {file_path: CWD + "/x.md"}, CWD, null).safety, SAFETY.SAFE);
});

test("secrets, configuration and deletions inside the PMNM folder still stop", (t) => {
  const {folder, env} = setup(t);
  for (const name of [".env", "settings.json", "config.toml", "id_rsa"]) {
    assert.equal(classifyTool("Write", {file_path: path.join(folder, name)}, ELSEWHERE, folder).safety, SAFETY.SENSITIVE, name);
  }
  assert.equal(decision(handle(patch("*** Delete File: " + path.join(folder, "notes.md")), {host: "codex", env, folder})), "deny");
  assert.equal(safety("rm /srv/pmnm/projects/p/tasks/T-1/index.md"), SAFETY.DESTRUCTIVE);
});

test("a symlink inside the PMNM folder cannot lead an edit outside it", (t) => {
  const {folder: given, env} = setup(t);
  // The real path, so only the symlinks below differ between a resolved and an unresolved target.
  const folder = fs.realpathSync(given);
  const outside = temp(t);
  fs.symlinkSync(outside, path.join(folder, "linked-dir"));
  fs.writeFileSync(path.join(outside, "target.md"), "x");
  fs.symlinkSync(path.join(outside, "target.md"), path.join(folder, "linked-file.md"));
  fs.symlinkSync(path.join(outside, "missing.md"), path.join(folder, "dangling.md"));
  for (const target of [path.join(folder, "linked-dir", "x.md"), path.join(folder, "linked-file.md"), path.join(folder, "dangling.md")]) {
    assert.equal(decision(handle(edit(target), {host: "codex", env, folder})), "deny", target);
  }
});

test("a PMNM folder that overlaps home, the host configuration, the brake's data or its code frees nothing", (t) => {
  const {env} = setup(t);
  const repository = path.dirname(path.dirname(new URL(import.meta.url).pathname));
  const parentOfConfig = temp(t);
  const config = path.join(parentOfConfig, "claude-config");
  fs.mkdirSync(config);
  const cases = [
    {folder: "/", env, target: path.join(os.homedir(), "pmnm-brake-test", "x.md")},
    {folder: os.homedir(), env, target: path.join(os.homedir(), "pmnm-brake-test", "x.md")},
    {folder: parentOfConfig, env: {...env, CLAUDE_CONFIG_DIR: config}, target: path.join(parentOfConfig, "x.md")},
    {folder: path.join(config, "pmnm"), env: {...env, CLAUDE_CONFIG_DIR: config}, target: path.join(config, "pmnm", "x.md")},
    {folder: env.PLUGIN_DATA, env, target: path.join(env.PLUGIN_DATA, "x.md")},
    {folder: path.dirname(repository), env, target: path.join(path.dirname(repository), "x.md")},
    {folder: path.join(repository, "hooks"), env, target: path.join(repository, "hooks", "x.md")},
  ];
  for (const {folder, env: caseEnv, target} of cases) {
    assert.equal(decision(handle(edit(target), {host: "claude", env: caseEnv, folder})), "ask", folder);
  }
});

test("a PMNM folder that holds the home directory frees nothing, even away from every other protected path", (t) => {
  const {env} = setup(t);
  const folder = temp(t);
  const home = path.join(folder, "home");
  fs.mkdirSync(home);
  const savedHome = process.env.HOME;
  process.env.HOME = home;
  t.after(() => { process.env.HOME = savedHome; });
  assert.equal(os.homedir(), home, "os.homedir() did not follow HOME, so this test cannot isolate the home check");
  assert.equal(decision(handle(edit(path.join(home, "notes.md")), {host: "claude", env, folder})), "ask");
});

// ---------------------------------------------------------------- an edit is judged by where it lands

test("an apply_patch move counts its destination, from the PMNM folder and from the working directory", (t) => {
  const {folder, env} = setup(t);
  const cwd = fs.realpathSync(temp(t));
  const outside = temp(t);
  for (const source of [path.join(folder, "a.md"), path.join(cwd, "a.md")]) {
    const event = {hook_event_name: "PreToolUse", session_id: "s1", cwd, tool_name: "apply_patch",
      tool_input: {command: "*** Begin Patch\n*** Update File: " + source + "\n*** Move to: " + path.join(outside, "a.md") + "\n@@\n-x\n+y\n*** End Patch"}};
    assert.equal(decision(handle(event, {host: "codex", env, folder})), "deny", source);
  }
  const inside = {hook_event_name: "PreToolUse", session_id: "s1", cwd, tool_name: "apply_patch",
    tool_input: {command: "*** Begin Patch\n*** Update File: " + path.join(cwd, "a.md") + "\n*** Move to: " + path.join(cwd, "b.md") + "\n@@\n-x\n+y\n*** End Patch"}};
  assert.equal(decision(handle(inside, {host: "codex", env, folder})), "allow", "a rename inside the working directory");
});

test("a link to a secret or configuration file is judged by the file it leads to", (t) => {
  const {folder, env} = setup(t);
  const cwd = fs.realpathSync(temp(t));
  const secrets = temp(t);
  fs.writeFileSync(path.join(secrets, ".env"), "SECRET=1");
  fs.writeFileSync(path.join(secrets, "settings.json"), "{}");
  fs.symlinkSync(path.join(secrets, ".env"), path.join(folder, "notes.md"));
  fs.symlinkSync(path.join(secrets, "settings.json"), path.join(cwd, "readme.md"));
  for (const [target, at] of [[path.join(folder, "notes.md"), ELSEWHERE], [path.join(cwd, "readme.md"), cwd]]) {
    const event = {hook_event_name: "PreToolUse", session_id: "s1", cwd: at, tool_name: "Write", tool_input: {file_path: target}};
    assert.equal(decision(handle(event, {host: "claude", env, folder})), "ask", target);
  }
});

test("a symlink cannot lead an edit out of the working directory either", (t) => {
  const {folder, env} = setup(t);
  const repository = fs.realpathSync(temp(t));
  const outside = temp(t);
  fs.symlinkSync(outside, path.join(repository, "linked"));
  fs.symlinkSync(outside, path.join(folder, "linked"));
  for (const cwd of [repository, fs.realpathSync(folder)]) {
    const event = {hook_event_name: "PreToolUse", session_id: "s1", cwd, tool_name: "Write", tool_input: {file_path: path.join(cwd, "linked", "x.md")}};
    assert.equal(decision(handle(event, {host: "codex", env, folder})), "deny", cwd);
  }
  const plain = {hook_event_name: "PreToolUse", session_id: "s1", cwd: repository, tool_name: "Write", tool_input: {file_path: path.join(repository, "src", "x.md")}};
  assert.equal(decision(handle(plain, {host: "codex", env, folder})), "allow", "an ordinary edit inside the working directory");
});

// ---------------------------------------------------------------- letter case does not hide a file

test("a secret or configuration name in any letter case still stops, on both hosts", (t) => {
  const {folder, env} = setup(t);
  const cwd = fs.realpathSync(temp(t));
  for (const name of [".ENV", ".Env", "Settings.json", "CONFIG.TOML", "ID_RSA", "Credentials.json"]) {
    for (const [target, at] of [[path.join(folder, name), ELSEWHERE], [path.join(cwd, name), cwd]]) {
      const event = {hook_event_name: "PreToolUse", session_id: "s1", cwd: at, tool_name: "Write", tool_input: {file_path: target}};
      assert.equal(decision(handle(event, {host: "claude", env, folder})), "ask", "claude " + target);
      assert.equal(decision(handle(event, {host: "codex", env, folder})), "deny", "codex " + target);
    }
  }
  assert.equal(classifyTool("Read", {file_path: path.join(cwd, ".ENV")}, cwd).safety, SAFETY.SENSITIVE, "read of .ENV");
  assert.equal(safety("echo x > .ENV", cwd), SAFETY.SENSITIVE, "redirect into .ENV");
});

test("an alias inside the PMNM folder that leads to its own .env still stops", (t) => {
  const {folder, env} = setup(t);
  fs.writeFileSync(path.join(folder, ".env"), "S=1");
  fs.symlinkSync(path.join(folder, ".env"), path.join(folder, "notes.md"));
  const event = {hook_event_name: "PreToolUse", session_id: "s1", cwd: ELSEWHERE, tool_name: "Write", tool_input: {file_path: path.join(folder, "notes.md")}};
  assert.equal(decision(handle(event, {host: "claude", env, folder})), "ask");
  assert.equal(decision(handle(event, {host: "codex", env, folder})), "deny");
});

test("a PMNM pointer that spells the home directory in another letter case frees nothing", (t) => {
  const {env} = setup(t);
  const home = os.homedir();
  const respelled = home === home.toLowerCase() ? home.toUpperCase() : home.toLowerCase();
  if (!fs.existsSync(respelled)) {
    t.skip("this volume distinguishes letter case, so the respelled home does not exist");
    return;
  }
  const event = {hook_event_name: "PreToolUse", session_id: "s1", cwd: ELSEWHERE, tool_name: "Write", tool_input: {file_path: path.join(respelled, "pmnm-brake-test", "x.md")}};
  assert.equal(decision(handle(event, {host: "claude", env, folder: respelled})), "ask");
});

test("a command naming the brake's state in another letter case still touches it", (t) => {
  const {folder, env} = setup(t);
  const respelled = path.join(env.PLUGIN_DATA, "brake").toUpperCase();
  const event = {hook_event_name: "PreToolUse", session_id: "s1", cwd: ELSEWHERE, tool_name: "Bash", tool_input: {command: "cat " + respelled + "/approvals.json"}};
  assert.equal(decision(handle(event, {host: "codex", env, folder})), "deny");
});

// ---------------------------------------------------------------- loading PMNM at the start of a session

function prompt(session, text = "fix the failing test") {
  return {hook_event_name: "UserPromptSubmit", session_id: session, prompt: text};
}
const contextOf = (output) => String(output?.hookSpecificOutput?.additionalContext || "");

test("the first prompt of a session tells the agent to load PMNM, in each host's own way", (t) => {
  const {folder, env} = setup(t, {choose: false});
  const claude = contextOf(handle(prompt("claude-session"), {host: "claude", env, folder}));
  assert.match(claude, /load the please-make-no-mistakes skill with the Skill tool before reading the project/);
  assert.match(claude, /not a deferred tool/);
  const codex = contextOf(handle(prompt("codex-session"), {host: "codex", env, folder}));
  assert.match(codex, /open the please-make-no-mistakes skill's SKILL\.md from your skills list before reading the project/);
  assert.doesNotMatch(codex, /Skill tool/);
});

test("the activation line comes once per session and again for a new session", (t) => {
  const {folder, env} = setup(t, {choose: false});
  assert.match(contextOf(handle(prompt("a"), {host: "claude", env, folder})), /please-make-no-mistakes/);
  assert.doesNotMatch(contextOf(handle(prompt("a", "and the next one"), {host: "claude", env, folder})), /please-make-no-mistakes skill/);
  assert.match(contextOf(handle(prompt("b"), {host: "claude", env, folder})), /please-make-no-mistakes/);
});

test("the activation line joins the prompt's own message instead of replacing it", (t) => {
  const {folder, env} = setup(t, {choose: false});
  const confirmed = contextOf(handle(prompt("fresh", "PMNM-CONFIRM-JUDGE claude claude-small"), {host: "claude", env, folder}));
  assert.match(confirmed, /the human confirmed claude-small/);
  assert.match(confirmed, /please-make-no-mistakes skill/);
});

test("no activation line without a session or while the judge runs", (t) => {
  const {folder, env} = setup(t, {choose: false});
  assert.equal(handle({hook_event_name: "UserPromptSubmit", prompt: "hola"}, {host: "claude", env, folder}), null);
  assert.equal(handle(prompt("judge"), {host: "claude", env: {...env, PMNM_JUDGE_ACTIVE: "1"}, folder}), null);
});

test("sessions are remembered only as hashes", (t) => {
  const {folder, env} = setup(t, {choose: false});
  handle(prompt("visible-session-id-123"), {host: "claude", env, folder});
  const stored = fs.readFileSync(path.join(env.PLUGIN_DATA, "brake", "sessions.json"), "utf8");
  assert.doesNotMatch(stored, /visible-session-id-123/);
});

// ---------------------------------------------------------------- BRAKE02: the brake's state, approvals and tokens

const stateDirectory = (env) => path.join(env.PLUGIN_DATA, "brake");
function bash(command, cwd = ELSEWHERE, session = "s1") {
  return {hook_event_name: "PreToolUse", session_id: session, cwd, tool_name: "Bash", tool_input: {command}};
}

test("a respelled path or a glob that reaches the brake's state touches it", (t) => {
  const {folder, env} = setup(t);
  const data = stateDirectory(env);
  for (const command of [
    "cp -l " + env.PLUGIN_DATA + "/./brake/catalog.* " + folder + "/key-notes.md",
    "cp -l " + env.PLUGIN_DATA + "//brake/catalog.* " + folder + "/key-notes.md",
    "cp " + data + "/../brake/cat* " + folder + "/x",
    "ln " + env.PLUGIN_DATA + "/*/c* " + folder + "/x",
  ]) {
    assert.equal(decision(handle(bash(command), {host: "codex", env, folder})), "deny", command);
  }
});

test("an alias of a state file, by hardlink or symlink, touches the state", (t) => {
  const {folder, env} = setup(t);
  const data = stateDirectory(env);
  fs.linkSync(path.join(data, "catalog.key"), path.join(folder, "key-notes.md"));
  fs.symlinkSync(path.join(data, "approvals.json"), path.join(folder, "notes.json"));
  const read = {hook_event_name: "PreToolUse", session_id: "s1", cwd: ELSEWHERE, tool_name: "Read", tool_input: {file_path: path.join(folder, "key-notes.md")}};
  assert.equal(decision(handle(read, {host: "claude", env, folder})), "deny", "Read of a hardlink to the key");
  assert.equal(decision(handle(bash("cat " + path.join(folder, "key-notes.md")), {host: "codex", env, folder})), "deny", "cat of a hardlink to the key");
  const edit = {hook_event_name: "PreToolUse", session_id: "s1", cwd: ELSEWHERE, tool_name: "Edit", tool_input: {file_path: path.join(folder, "notes.json")}};
  assert.equal(decision(handle(edit, {host: "codex", env, folder})), "deny", "Edit of a symlink to approvals.json");
  const plain = {hook_event_name: "PreToolUse", session_id: "s1", cwd: ELSEWHERE, tool_name: "Read", tool_input: {file_path: path.join(folder, "index.md")}};
  assert.equal(decision(handle(plain, {host: "claude", env, folder})), "allow", "an ordinary read in the folder");
});

test("a grant written while another call waits for the judge survives", (t) => {
  const {folder, env} = setup(t);
  const unsure = () => ({safety: "sensitive", confidence: "high"});
  const tokenA = tokenIn(handle(bash("./bin/one", "/work/repo", "A"), {host: "codex", env, folder, judge: unsure}));
  const judgeB = () => {
    handle({hook_event_name: "UserPromptSubmit", session_id: "A", prompt: tokenA}, {host: "codex", env, folder});
    return unsure();
  };
  handle(bash("./bin/two", "/work/repo", "B"), {host: "codex", env, folder, judge: judgeB});
  assert.equal(decision(handle(bash("./bin/one", "/work/repo", "A"), {host: "codex", env, folder, judge: unsure})), "allow");
});

test("a token issued while another call waits for the judge survives", (t) => {
  const {folder, env} = setup(t);
  const unsure = () => ({safety: "sensitive", confidence: "high"});
  let tokenA = null;
  const judgeB = () => {
    tokenA = tokenIn(handle(bash("./bin/one", "/work/repo", "A"), {host: "codex", env, folder, judge: unsure}));
    return unsure();
  };
  handle(bash("./bin/two", "/work/repo", "B"), {host: "codex", env, folder, judge: judgeB});
  const reply = handle({hook_event_name: "UserPromptSubmit", session_id: "A", prompt: tokenA}, {host: "codex", env, folder});
  assert.match(String(reply?.hookSpecificOutput?.additionalContext), /the human allowed the exact operation once/);
});

test("a stale lock left by a crashed hook does not block approvals", (t) => {
  const {folder, env} = setup(t);
  const lock = path.join(stateDirectory(env), "approvals.json.lock");
  fs.writeFileSync(lock, "");
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(lock, old, old);
  const started = Date.now();
  const output = handle(bash("rm -rf src", "/work/repo"), {host: "codex", env, folder});
  assert.ok(Date.now() - started < 500, "the stale lock was waited out instead of removed");
  assert.ok(tokenIn(output), "no token was issued");
  handle({hook_event_name: "UserPromptSubmit", session_id: "s1", prompt: tokenIn(output)}, {host: "codex", env, folder});
  assert.equal(decision(handle(bash("rm -rf src", "/work/repo"), {host: "codex", env, folder})), "allow");
});

test("tokens are PMNM- and four unambiguous characters, and any letter case approves", (t) => {
  const {folder, env} = setup(t);
  const output = handle(bash("rm -rf src", "/work/repo"), {host: "codex", env, folder});
  const token = tokenIn(output);
  assert.match(token, /^PMNM-[2-9A-HJKMNP-TV-Z]{4}$/);
  assert.doesNotMatch(output.hookSpecificOutput.permissionDecisionReason, /PMNM-ALLOW-[A-F0-9]{12}/);
  handle({hook_event_name: "UserPromptSubmit", session_id: "s1", prompt: "  " + token.toLowerCase() + " "}, {host: "codex", env, folder});
  assert.equal(decision(handle(bash("rm -rf src", "/work/repo"), {host: "codex", env, folder})), "allow");
});

test("a reply shaped like a token that opens nothing says why", (t) => {
  const {folder, env} = setup(t);
  const output = handle({hook_event_name: "UserPromptSubmit", session_id: "s1", prompt: "PMNM-ZZZZ"}, {host: "codex", env, folder});
  assert.match(String(output?.hookSpecificOutput?.additionalContext), /PMNM-ZZZZ is not an open approval in this session: it expired, was already used, or belongs to another session\. NEXT: rerun the operation for a new token\./);
});

test("a sessions.json written without the brake's seal does not silence the activation line", (t) => {
  const {folder, env} = setup(t, {choose: false});
  fs.mkdirSync(stateDirectory(env), {recursive: true});
  const mark = crypto.createHash("sha256").update("forged").digest("hex");
  fs.writeFileSync(path.join(stateDirectory(env), "sessions.json"), JSON.stringify({sessions: [mark]}));
  assert.match(contextOf(handle(prompt("forged"), {host: "claude", env, folder})), /please-make-no-mistakes skill/);
});

test("the activation line also covers investigating, reviewing and verifying", (t) => {
  const {folder, env} = setup(t, {choose: false});
  for (const host of ["claude", "codex"]) {
    assert.match(contextOf(handle(prompt("scope-" + host), {host, env, folder})), /and for investigating, reviewing or verifying one/);
  }
});

test("a grant never covers an operation that now reaches the brake's state", (t) => {
  const {folder, env} = setup(t);
  const repository = fs.realpathSync(temp(t));
  const target = path.join(repository, ".env");
  fs.writeFileSync(target, "A=1");
  const read = {hook_event_name: "PreToolUse", session_id: "s1", cwd: repository, tool_name: "Read", tool_input: {file_path: target}};
  const first = handle(read, {host: "codex", env, folder});
  handle({hook_event_name: "UserPromptSubmit", session_id: "s1", prompt: tokenIn(first)}, {host: "codex", env, folder});
  fs.rmSync(target);
  fs.linkSync(path.join(stateDirectory(env), "catalog.key"), target);
  const retry = handle(read, {host: "codex", env, folder});
  assert.equal(decision(retry), "deny");
  assert.equal(tokenIn(retry), undefined, "an operation on the brake's state was offered a token");
});

test("an operation that reaches the brake's state is denied on both hosts, with no token", (t) => {
  const {folder, env} = setup(t);
  const command = bash("cat " + path.join(stateDirectory(env), "approvals.json"));
  for (const host of ["claude", "codex"]) {
    const output = handle(command, {host, env, folder});
    assert.equal(decision(output), "deny", host);
    assert.equal(tokenIn(output), undefined, host);
    assert.match(output.hookSpecificOutput.permissionDecisionReason, /only the human can run it/, host);
  }
});

test("a lock that cannot be taken writes nothing and issues no token", (t) => {
  const {folder, env} = setup(t);
  const approvals = path.join(stateDirectory(env), "approvals.json");
  handle(bash("rm -rf first", "/work/repo"), {host: "codex", env, folder});
  const before = fs.readFileSync(approvals, "utf8");
  fs.writeFileSync(approvals + ".lock", "");
  const output = handle(bash("rm -rf second", "/work/repo"), {host: "codex", env, folder});
  assert.equal(decision(output), "deny");
  assert.equal(tokenIn(output), undefined, "a token was issued without the lock");
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /busy/);
  assert.equal(fs.readFileSync(approvals, "utf8"), before, "approvals were written without the lock");
});

test("text that only mentions the key's name is not a path to it", (t) => {
  const {folder, env} = setup(t);
  const repository = fs.realpathSync(temp(t));
  const prose = {hook_event_name: "PreToolUse", session_id: "s1", cwd: repository, tool_name: "Edit",
    tool_input: {file_path: path.join(repository, "notes.md"), old_string: "a", new_string: "the brake keeps catalog.key in its data"}};
  assert.equal(decision(handle(prose, {host: "codex", env, folder})), "allow");
  assert.equal(decision(handle(bash("git commit -m \"document catalog.key\"", repository), {host: "claude", env, folder})), "ask", "a commit stays a commit, not a state access");
  assert.match(String(handle(bash("cat catalog.key", repository), {host: "codex", env, folder}).hookSpecificOutput.permissionDecisionReason), /only the human can run it/, "a path word naming the key still reaches it");
});

test("a backslash-escaped space in a path is one shell word, as the shell reads it", (t) => {
  const {folder, env} = setup(t);
  fs.linkSync(path.join(stateDirectory(env), "catalog.key"), path.join(folder, "key notes.md"));
  for (const command of ["cat " + folder + "/key\\ notes.md", "cat \"" + folder + "/key notes.md\"", "cat '" + folder + "/key notes.md'"]) {
    assert.equal(decision(handle(bash(command), {host: "codex", env, folder})), "deny", command);
  }
  assert.equal(safety("rm my\\ file.txt"), SAFETY.DESTRUCTIVE, "an escaped space still leaves one deletion target");
});

test("escaped quotes and apostrophes inside double quotes cannot hide a command", () => {
  for (const command of [
    "echo \\\" ; rm -rf src ; echo \\\"",
    "echo \\' ; rm -rf src ; echo \\'",
    "echo \\' $(rm -rf src)",
    "echo \"it's\" $(rm -rf src)",
    "echo \"it's\" `rm -rf src`",
  ]) {
    assert.equal(safety(command), SAFETY.DESTRUCTIVE, command);
  }
  for (const command of ["echo '$(rm -rf src)'", "echo \"a;b\"", "echo 'it''s'", "printf '%s\\n' \"a b\""]) {
    assert.equal(safety(command), SAFETY.SAFE, command);
  }
});

// ---------------------------------------------------------------- the whole bash quoting layer

test("ANSI-C, locale and continued words reach the file bash would reach", (t) => {
  const {folder, env} = setup(t);
  const key = path.join(stateDirectory(env), "catalog.key");
  fs.linkSync(key, path.join(folder, "key notes.md"));
  // Only the joined name exists, so a continuation read as a space would miss the key and pass.
  fs.linkSync(key, path.join(folder, "joined.md"));
  for (const command of [
    "cat " + folder + "/key$'\\x20'notes.md",
    "cat " + folder + "/key$'\\040'notes.md",
    "cat " + folder + "/key$' 'notes.md",
    "cat $\"" + folder + "/key notes.md\"",
    "cat " + folder + "/joi\\\nned.md",
    "cat \"" + folder + "/joi\\\nned.md\"",
  ]) {
    assert.equal(decision(handle(bash(command), {host: "codex", env, folder})), "deny", JSON.stringify(command));
  }
});

test("an escaped quote inside ANSI-C quoting cannot hide a command", () => {
  for (const command of [
    "echo $'a\\'b' ; rm -rf src",
    "echo $'\\'' $(rm -rf src)",
    "rm -rf \\\nsrc",
    "echo $\"x\" ; rm -rf src",
  ]) {
    assert.equal(safety(command), SAFETY.DESTRUCTIVE, JSON.stringify(command));
  }
  for (const command of ["echo $'a;b'", "echo $\"a;b\"", "printf $'%s\\n' x", "echo $'$(rm -rf src)'", "echo 'a\\'"]) {
    assert.equal(safety(command), SAFETY.SAFE, JSON.stringify(command));
  }
});

test("shell punctuation inside quotes and file-tool paths stays part of the path", (t) => {
  const {folder, env} = setup(t);
  const key = path.join(stateDirectory(env), "catalog.key");
  for (const name of ["key;notes.md", "key&notes.md", "key(notes).md", "key|notes.md", "key<notes>.md", "key spaced.md"]) {
    fs.linkSync(key, path.join(folder, name));
    const target = path.join(folder, name);
    assert.equal(decision(handle(bash("cat \"" + target + "\""), {host: "codex", env, folder})), "deny", "double-quoted " + name);
    assert.equal(decision(handle(bash("cat '" + target + "'"), {host: "codex", env, folder})), "deny", "single-quoted " + name);
    const read = {hook_event_name: "PreToolUse", session_id: "s1", cwd: ELSEWHERE, tool_name: "Read", tool_input: {file_path: target}};
    assert.equal(decision(handle(read, {host: "codex", env, folder})), "deny", "Read " + name);
  }
  const redirected = bash("echo x >" + path.join(folder, "key;notes.md").replace(";", "\\;"));
  assert.equal(decision(handle(redirected, {host: "codex", env, folder})), "deny", "an escaped separator in a redirect target");
});

test("a held lock costs one short wait per call, not two", (t) => {
  const {folder, env} = setup(t);
  // The session loads the skill before the lock is taken, so only the measured call meets the lock.
  handle(bash("true", "/work/repo"), {host: "codex", env, folder});
  fs.writeFileSync(path.join(stateDirectory(env), "approvals.json.lock"), "");
  const started = Date.now();
  const output = handle(bash("rm -rf src", "/work/repo"), {host: "codex", env, folder});
  const waited = Date.now() - started;
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /busy/);
  // One wait measures about 240 ms (LOCK_ATTEMPTS × LOCK_WAIT_MS plus pause overshoot); a second wait in
  // the same call makes it about 480. The bound sits halfway, so load in either direction has room.
  assert.ok(waited < 360, "a held lock cost " + waited + " ms");
});

test("a file-tool path keeps its literal bytes, trailing blanks included", (t) => {
  const {folder, env} = setup(t);
  const key = path.join(stateDirectory(env), "catalog.key");
  for (const name of ["keynotes.md ", "keynotes.md\t", " keynotes.md", "keynotes.md  "]) {
    const target = path.join(folder, name);
    fs.linkSync(key, target);
    for (const tool of ["Read", "Edit", "Write"]) {
      const event = {hook_event_name: "PreToolUse", session_id: "s1", cwd: ELSEWHERE, tool_name: tool, tool_input: {file_path: target}};
      assert.equal(decision(handle(event, {host: "codex", env, folder})), "deny", tool + " " + JSON.stringify(name));
    }
    const mcp = {hook_event_name: "PreToolUse", session_id: "s1", cwd: ELSEWHERE, tool_name: "mcp__files__read_file", tool_input: {path: target}};
    assert.equal(decision(handle(mcp, {host: "codex", env, folder})), "deny", "MCP " + JSON.stringify(name));
    const patched = {hook_event_name: "PreToolUse", session_id: "s1", cwd: ELSEWHERE, tool_name: "apply_patch", tool_input: {command: "*** Begin Patch\n*** Update File: " + target + "\n@@\n-a\n+b\n*** End Patch"}};
    assert.equal(decision(handle(patched, {host: "codex", env, folder})), "deny", "apply_patch " + JSON.stringify(name));
    fs.rmSync(target);
  }
});

// ---------------------------------------------------------------- open approvals are never evicted

function stopIn(session, command, env, folder) {
  return handle({hook_event_name: "PreToolUse", session_id: session, cwd: "/work/repo", tool_name: "Bash", tool_input: {command}}, {host: "codex", env, folder});
}
function answerIn(session, token, env, folder) {
  return handle({hook_event_name: "UserPromptSubmit", session_id: session, prompt: token}, {host: "codex", env, folder});
}

test("a token stays valid while other sessions open many more", (t) => {
  const {folder, env} = setup(t);
  const first = tokenIn(stopIn("session-0", "rm -rf first", env, folder));
  for (let index = 1; index <= 16; index += 1) stopIn("session-" + index, "rm -rf dir" + index, env, folder);
  assert.match(contextOf(answerIn("session-0", first, env, folder)), /the human allowed the exact operation once/);
  assert.equal(decision(stopIn("session-0", "rm -rf first", env, folder)), "allow");
});

test("a session with eight open tokens gets an explicit refusal, and its tokens stay valid", (t) => {
  const {folder, env} = setup(t);
  const tokens = Array.from({length: 8}, (_, index) => tokenIn(stopIn("busy-session", "rm -rf d" + index, env, folder)));
  assert.equal(tokens.filter(Boolean).length, 8);
  const ninth = stopIn("busy-session", "rm -rf d8", env, folder);
  assert.equal(decision(ninth), "deny");
  assert.equal(tokenIn(ninth), undefined, "a ninth token was issued");
  assert.match(ninth.hookSpecificOutput.permissionDecisionReason, /too many open approvals in this session/);
  assert.equal(tokenIn(stopIn("busy-session", "rm -rf d0", env, folder)), tokens[0], "a retry of an open operation lost its token");
  assert.match(contextOf(answerIn("busy-session", tokens[0], env, folder)), /the human allowed/);
});

test("past 128 open tokens across sessions the brake refuses explicitly instead of evicting", (t) => {
  const {folder, env} = setup(t);
  const first = tokenIn(stopIn("s-0", "rm -rf a0", env, folder));
  for (let index = 1; index < 128; index += 1) stopIn("s-" + index, "rm -rf a" + index, env, folder);
  const overflow = stopIn("s-128", "rm -rf a128", env, folder);
  assert.equal(tokenIn(overflow), undefined);
  assert.match(overflow.hookSpecificOutput.permissionDecisionReason, /too many open approvals across sessions/);
  assert.match(contextOf(answerIn("s-0", first, env, folder)), /the human allowed/);
});

// ---------------------------------------------------------------- the Claude judge without a host catalog

test("with no Claude catalog, the human's confirmation alone names the Claude judge, and it runs", (t) => {
  const {folder, env} = setup(t, {choose: false});
  const noCatalog = {...env, CLAUDE_CONFIG_DIR: temp(t)};
  const confirmed = contextOf(confirmJudge(noCatalog, folder, "claude", "claude-haiku-5-5", "reasoning=low"));
  assert.match(confirmed, /the human confirmed claude-haiku-5-5 as the claude judge with low reasoning/);
  assert.match(confirmed, /not checked against a model catalog/);
  const asked = [];
  handle(pre("./bin/one"), {host: "claude", env: noCatalog, judge: (_host, model, _prompt, options) => { asked.push([model, options.reasoning]); return null; }, folder});
  assert.deepEqual(asked, [["claude-haiku-5-5", "low"]]);
  assert.equal(contextOf(handle(reply("hola"), {host: "claude", env: noCatalog, folder})).includes("catalog could not be read"), false, "a missing Claude catalog still raised a notice");
});

test("a stale Claude cache, present or added later, neither refuses nor stops the confirmed judge; Codex still needs its catalog", (t) => {
  const {folder, env} = setup(t, {choose: false});
  const noCache = {...env, CLAUDE_CONFIG_DIR: temp(t)};
  assert.match(contextOf(confirmJudge(noCache, folder, "claude", "claude-haiku-5-5", "reasoning=low")), /the human confirmed claude-haiku-5-5/);
  claudeCatalog(noCache.CLAUDE_CONFIG_DIR, ["claude-other"]);
  const asked = [];
  handle(pre("./bin/one"), {host: "claude", env: noCache, judge: (_host, model) => { asked.push(model); return null; }, folder});
  assert.deepEqual(asked, ["claude-haiku-5-5"], "a stale cache added later stopped the confirmed judge");
  assert.match(contextOf(confirmJudge(env, folder, "claude", "claude-imaginary")), /the human confirmed claude-imaginary/, "a stale cache refused the human's model");
  const noCodexCatalog = {...env, CODEX_HOME: temp(t)};
  assert.match(contextOf(confirmJudge(noCodexCatalog, folder, "codex", "gpt-small")), /could not be read/);
});

// ---------------------------------------------------------------- the PMNM load stop

function event(session, tool, input, cwd = "/work/repo") {
  return {hook_event_name: "PreToolUse", session_id: session, cwd, tool_name: tool, tool_input: input};
}
const LOAD_STOP = /Blocked: load PMNM before working on the project\./;

test("in Claude Code the first project tool call of a session that has not loaded PMNM is stopped once, with no token", (t) => {
  const {folder, env} = setup(t);
  const first = rawHandle(event("cold-claude", "Read", {file_path: "/work/repo/math.js"}), {host: "claude", env, folder});
  assert.equal(decision(first), "deny");
  assert.match(first.hookSpecificOutput.permissionDecisionReason, LOAD_STOP);
  assert.match(first.hookSpecificOutput.permissionDecisionReason, /load the please-make-no-mistakes skill with the Skill tool/);
  assert.equal(tokenIn(first), undefined);
  assert.equal(decision(rawHandle(event("cold-claude", "Read", {file_path: "/work/repo/math.js"}), {host: "claude", env, folder})), "allow", "stopped twice");
});

test("Codex, which loads the skill on its own, is never stopped for it", (t) => {
  const {folder, env} = setup(t);
  for (const [tool, input] of [["Bash", {command: "ls"}], ["apply_patch", {command: "*** Begin Patch\n*** Update File: /work/repo/a.js\n@@\n-a\n+b\n*** End Patch"}]]) {
    const output = rawHandle(event("codex-" + tool, tool, input), {host: "codex", env, folder});
    assert.doesNotMatch(output?.hookSpecificOutput?.permissionDecisionReason || "", LOAD_STOP, tool);
  }
});

test("loading the skill with the Skill tool first means no stop at all", (t) => {
  const {folder, env} = setup(t);
  rawHandle(event("warm-claude", "Skill", {skill: "please-make-no-mistakes:please-make-no-mistakes"}), {host: "claude", env, folder});
  assert.equal(decision(rawHandle(event("warm-claude", "Read", {file_path: "/work/repo/math.js"}), {host: "claude", env, folder})), "allow");
});

test("no file read counts as loading PMNM, whatever it reads or hides", (t) => {
  const {folder, env} = setup(t);
  const installedSkill = path.join(path.dirname(path.dirname(new URL(import.meta.url).pathname)), "skills", "please-make-no-mistakes", "SKILL.md");
  const operations = [
    ["Bash", {command: "cat " + installedSkill}],
    ["Bash", {command: "head -n 0 " + installedSkill}],
    ["Bash", {command: "cat " + installedSkill + " >/dev/null"}],
    ["Bash", {command: "echo " + installedSkill}],
    ["Bash", {command: "cat /nonexistent/skills/please-make-no-mistakes/SKILL.md"}],
    ["Read", {file_path: installedSkill}],
    ["Skill", {skill: "some-other-skill"}],
  ];
  // A read credited as a load would itself pass; not credited, it is the session's one stop. Another
  // skill touches nothing, so the stop falls on the next project read.
  operations.forEach(([tool, input], index) => {
    const session = "not-a-load-" + index;
    const first = rawHandle(event(session, tool, input), {host: "claude", env, folder});
    const stopped = tool === "Skill" ? rawHandle(event(session, "Read", {file_path: "/work/repo/math.js"}), {host: "claude", env, folder}) : first;
    assert.match(stopped?.hookSpecificOutput?.permissionDecisionReason || "", LOAD_STOP, tool + " " + JSON.stringify(input) + " counted as loading PMNM");
  });
});

test("tools that do not touch the project pass before the skill is loaded", (t) => {
  const {folder, env} = setup(t);
  for (const tool of ["ToolSearch", "AskUserQuestion", "TodoWrite", "WebFetch", "WebSearch", "Skill"]) {
    assert.equal(decision(rawHandle(event("exempt-" + tool, tool, {query: "x"}), {host: "claude", env, folder})), "allow", tool);
  }
  assert.equal(decision(rawHandle(event("exempt-mcp", "mcp__plugin_semantic-js-mcp_semantic-js-mcp__lsp_references", {symbol: "x"}), {host: "claude", env, folder})), "deny", "an MCP tool can read the project");
});

test("PMNM-SKIP from the human lifts the stop for that session only", (t) => {
  const {folder, env} = setup(t);
  const reply = rawHandle({hook_event_name: "UserPromptSubmit", session_id: "skip-me", prompt: "pmnm-skip"}, {host: "claude", env, folder});
  assert.match(contextOf(reply), /the human turned off the PMNM load stop for this session/);
  assert.equal(decision(rawHandle(event("skip-me", "Read", {file_path: "/work/repo/a.js"}), {host: "claude", env, folder})), "allow");
  assert.equal(decision(rawHandle(event("other-session", "Read", {file_path: "/work/repo/a.js"}), {host: "claude", env, folder})), "deny");
});

test("a forged load mark is ignored, and the brake's own state still comes first", (t) => {
  const {folder, env} = setup(t);
  fs.mkdirSync(stateDirectory(env), {recursive: true});
  const mark = crypto.createHash("sha256").update("forged").digest("hex");
  fs.writeFileSync(path.join(stateDirectory(env), "loaded.json"), JSON.stringify({sessions: [mark]}));
  assert.match(rawHandle(event("forged", "Read", {file_path: "/work/repo/a.js"}), {host: "claude", env, folder}).hookSpecificOutput.permissionDecisionReason, LOAD_STOP);
  const touch = rawHandle(event("state-first", "Bash", {command: "cat " + path.join(stateDirectory(env), "approvals.json")}), {host: "claude", env, folder});
  assert.match(touch.hookSpecificOutput.permissionDecisionReason, /reaches the brake's own state/);
});

test("only the exact PMNM skill identifier counts as a load; a similar or unknown name does not", (t) => {
  const {folder, env} = setup(t);
  const lookalikes = ["please-make-no-mistakes:other-skill", "please-make-no-mistakes-extra", "other-plugin:please-make-no-mistakes", "PLEASE-MAKE-NO-MISTAKES:please-make-no-mistakes ", "nonexistent"];
  lookalikes.forEach((skill, index) => {
    const session = "lookalike-" + index;
    rawHandle(event(session, "Skill", {skill}), {host: "claude", env, folder});
    const next = rawHandle(event(session, "Read", {file_path: "/work/repo/math.js"}), {host: "claude", env, folder});
    assert.match(next?.hookSpecificOutput?.permissionDecisionReason || "", LOAD_STOP, JSON.stringify(skill) + " counted as loading PMNM");
  });
  for (const skill of ["please-make-no-mistakes:please-make-no-mistakes", "please-make-no-mistakes"]) {
    const session = "exact-" + skill.length;
    rawHandle(event(session, "Skill", {skill}), {host: "claude", env, folder});
    assert.equal(decision(rawHandle(event(session, "Read", {file_path: "/work/repo/math.js"}), {host: "claude", env, folder})), "allow", skill);
  }
});
