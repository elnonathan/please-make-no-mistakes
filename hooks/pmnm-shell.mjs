import path from "node:path";

const R_SENSITIVE_EFFECTS = new Set(["deletion", "movement", "external-write", "git", "dependencies", "publish", "environment", "network", "state-change"]);

function rLexShell(command) {
  const segments = [];
  let tokens = [];
  let current = "";
  let currentQuoted = false;
  let inToken = false;
  let quote = null;
  let escaped = false;
  let redirectWrite = false;
  let dynamic = false;
  let awaitingRedirectTarget = false;
  let text = "";
  let redirectTargets = [];

  const flushToken = () => {
    if (inToken) {
      if (awaitingRedirectTarget) {
        if (current !== "/dev/null") {
          redirectWrite = true;
          redirectTargets.push(current);
        }
        awaitingRedirectTarget = false;
      } else {
        tokens.push({value: current, quoted: currentQuoted});
      }
    }
    current = "";
    currentQuoted = false;
    inToken = false;
  };

  const flushSegment = (separator = null) => {
    flushToken();
    if (awaitingRedirectTarget) {
      redirectWrite = true;
      awaitingRedirectTarget = false;
    }
    segments.push({tokens, text: text.trim(), redirectWrite, dynamic, redirectTargets, separator});
    tokens = [];
    text = "";
    redirectWrite = false;
    dynamic = false;
    redirectTargets = [];
  };

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    const next = command[index + 1];
    text += character;
    if (escaped) {
      current += character;
      inToken = true;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      inToken = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = null;
        continue;
      }
      if (
        quote === '"' &&
        (character === "\`" || (character === "$" && (next === "(" || next === "{" || /[A-Za-z_0-9?!#$*@-]/.test(next || ""))))
      ) {
        dynamic = true;
      }
      current += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      inToken = true;
      currentQuoted = true;
      continue;
    }
    if (
      character === "\`" ||
      (character === "$" && (next === "(" || next === "{" || /[A-Za-z_0-9?!#$*@-]/.test(next || ""))) ||
      ((character === "<" || character === ">") && next === "(")
    ) {
      dynamic = true;
      current += character;
      inToken = true;
      continue;
    }
    if (character === "&" && next === "&") {
      flushSegment("&&");
      index += 1;
      continue;
    }
    if (character === "|") {
      flushSegment(next === "|" ? "||" : "|");
      if (next === "|") index += 1;
      continue;
    }
    if (character === ";" || character === "\n") {
      flushSegment(character === ";" ? ";" : "newline");
      continue;
    }
    if (character === ">") {
      const fdOnly = inToken && /^[0-9]+$/.test(current) && !currentQuoted;
      if (fdOnly) {
        current = "";
        inToken = false;
      } else {
        flushToken();
      }
      let cursor = index + 1;
      if (command[cursor] === ">") cursor += 1;
      if (command[cursor] === "&") {
        index = cursor;
        while (/[0-9-]/.test(command[index + 1] || "")) index += 1;
        text += command.slice(cursor, index + 1);
        continue;
      }
      awaitingRedirectTarget = true;
      index = cursor - 1;
      continue;
    }
    if (character === "<") {
      const fdOnly = inToken && /^[0-9]+$/.test(current) && !currentQuoted;
      if (fdOnly) {
        current = "";
        inToken = false;
      } else {
        flushToken();
      }
      continue;
    }
    if (/\s/.test(character)) {
      flushToken();
      continue;
    }
    current += character;
    inToken = true;
  }
  if (quote || escaped) return {invalid: true, segments: []};
  flushSegment(null);
  return {invalid: false, segments: segments.filter((segment) => segment.tokens.length || segment.redirectWrite)};
}

function rWrite(effect, reason = "definite-pattern") {
  return {kind: "write", effect, reason, declarable: false};
}

function rUnknown(reason = "dynamic-declaration-required", extra = {}) {
  return {kind: "unknown", effect: null, reason, declarable: reason === "dynamic-declaration-required", ...extra};
}

function rClassifyDeclaration(d, authorized = false) {
  const read = d.persistence === "none" && ["investigation", "verification"].includes(d.effect);
  return {kind: read ? "read" : "write", effect: d.effect, reason: "dynamic-declaration", boundary: d.boundary,
    persistence: d.persistence, certainty: d.certainty, capability: d.capability, capabilityAuthorized: authorized};
}
function rDeclarationSensitiveEffect(d) {
  if (d.certainty !== "certain") return "state-change";
  const boundaryEffect = {"local-environment":"environment",network:"network",external:"state-change",unknown:"state-change"}[d.boundary];
  if (boundaryEffect) return boundaryEffect;
  if (d.effect === "investigation" && d.persistence !== "none") return "state-change";
  const nonPersistentRead = d.persistence === "none" && ["investigation", "verification"].includes(d.effect);
  if (d.boundary === "mixed" && !nonPersistentRead) return "state-change";
  return null;
}
function rToolResult(e) {
  const response = e.tool_response;
  let failed = false, text = "", explicit = false;
  if (response && typeof response === "object") {
    explicit = ["isError", "success", "ok"].some((key) => typeof response[key] === "boolean");
    failed = response?.isError === true || response?.success === false || response?.ok === false;
    const code = response.exit_code ?? response.exitCode ?? response.status;
    if (typeof code === "number") {
      explicit = true;
      failed ||= code !== 0;
    }
    for (const key of ["output", "stdout", "text", "content", "result"]) if (!text && typeof response[key] === "string") text = response[key];
    if (!text) try { text = JSON.stringify(response); } catch {}
  } else if (typeof response === "string") text = response;
  failed ||= !explicit && (/(?:^|\n)(?:error|failed|failure):/i.test(text) || /process exited with code [1-9]\d*/i.test(text));
  return {failed, text};
}
function rToolPayload(e) {
  const input = e.tool_input && typeof e.tool_input === "object" ? e.tool_input : {};
  const field = {Bash: "command", Edit: "new_string", Write: "content"}[e.tool_name];
  if (field) return typeof input[field] === "string" ? input[field] : "";
  if (e.tool_name !== "apply_patch") return "";
  for (const key of ["patch", "command", "input"]) if (typeof input[key] === "string") return input[key];
  return "";
}
function rPatchEffect(patchText) {
  let effect = "implementation";
  for (const match of patchText.matchAll(/^\*\*\* (Add File|Update File|Delete File|Move to): (.+)$/gm)) {
    if (match[1] === "Delete File") return "deletion";
    if (match[1] === "Move to") effect = "movement";
  }
  return effect;
}
function rOperationIdentity(e, payload) {
  const input = e.tool_input && typeof e.tool_input === "object" ? e.tool_input : {};
  const tool = String(e.tool_name || "");
  if (["Bash", "apply_patch"].includes(e.tool_name)) return {tool, payload};
  const path = input.file_path || input.path || "";
  if (e.tool_name === "Edit") return {tool, path, old: input.old_string || "", new: input.new_string || "", replace_all: input.replace_all === true};
  if (e.tool_name === "Write") return {tool, path, content: input.content || ""};
  return {tool, input};
}
function rClassifyToolEvent(e, payload) {
  if (e.tool_name === "apply_patch") return rWrite(rPatchEffect(payload), "apply-patch");
  if (["Edit", "Write"].includes(e.tool_name)) return rWrite("implementation", "file-tool");
  if (e.tool_name === "Bash") return classifyShell(payload);
  return R_UNKNOWN;
}

const R_UNKNOWN = Object.freeze(rUnknown());
const R_READ = Object.freeze({kind: "read", effect: "investigation", reason: "shell-structure-only"});
const R_UNRESOLVED = Object.freeze({resolvable: false, targets: [], sources: []});

function rSkipAssignments(tokens) {
  let index = 0;
  while (index < tokens.length && !tokens[index].quoted && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index].value)) index += 1;
  return tokens.slice(index);
}

function rUnwrapCommand(input) {
  let tokens = input.slice();
  for (let guard = 0; guard < 8 && tokens.length; guard += 1) {
    if (tokens[0].quoted) break;
    const word = tokens[0].value;
    if (word === "env") {
      let index = 1;
      while (
        index < tokens.length &&
        !tokens[index].quoted &&
        (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index].value) || tokens[index].value === "-i" || tokens[index].value === "-")
      ) {
        index += 1;
      }
      while (index < tokens.length && !tokens[index].quoted && tokens[index].value === "-u") index += 2;
      tokens = tokens.slice(index);
      continue;
    }
    if (word.includes("/") && !word.startsWith("-")) {
      tokens = [{value: path.basename(word), quoted: false}, ...tokens.slice(1)];
      continue;
    }
    if (word === "corepack") {
      tokens = tokens.slice(1);
      continue;
    }
    break;
  }
  return {word: tokens[0]?.value || "", rest: tokens.slice(1), tokens};
}

function rLiteralOperands(tokens, {short = "", values = [], long = []} = {}) {
  const operands = [];
  const options = new Map();
  let positional = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const value = token.value;
    if (!positional && !token.quoted && value === "--") {
      positional = true;
      continue;
    }
    if (positional || token.quoted || value === "-" || !value.startsWith("-")) {
      operands.push(value);
      continue;
    }
    const equal = value.indexOf("=");
    const option = equal > 0 ? value.slice(0, equal) : value;
    if (values.includes(option)) {
      const argument = equal > 0 ? value.slice(equal + 1) : tokens[++index]?.value;
      if (!argument) return null;
      options.set(option, argument);
      continue;
    }
    const shortValue = values.find((candidate) => candidate.length === 2 && value.startsWith(candidate) && value.length > 2);
    if (shortValue) {
      options.set(shortValue, value.slice(2));
      continue;
    }
    if (equal < 0 && (long.includes(value) || (/^-[A-Za-z]+$/.test(value) && [...value.slice(1)].every((letter) => short.includes(letter))))) {
      options.set(value, true);
      continue;
    }
    return null;
  }
  return {operands, options};
}

function rCopyMoveTargets(word, parsed, event, targets, sources, kind, resolvePath, fsType) {
  const targetDirectory = parsed.options.get("-t") || parsed.options.get("--target-directory");
  const operands = parsed.operands;
  const sourceNames = targetDirectory ? operands : operands.slice(0, -1);
  const rawDestination = targetDirectory || operands.at(-1);
  if (!rawDestination || !sourceNames.length) return false;
  const destination = resolvePath(rawDestination, event);
  const destinationIsDirectory = Boolean(targetDirectory || fsType(destination) === "dir");
  if (sourceNames.length > 1 && !destinationIsDirectory) return false;
  for (const rawSource of sourceNames) {
    const source = resolvePath(rawSource, event);
    if (!source) return false;
    sources.push(source);
    if (word === "mv") targets.push({path: source, kind: "delete"});
    const target = destinationIsDirectory ? path.join(destination, path.basename(source)) : destination;
    targets.push({path: target, kind});
  }
  return true;
}

function rPushTargets(parsed, event, targets, kind, resolvePath, skip = 0, extra = {}) {
  if (!parsed || parsed.operands.length <= skip) return false;
  for (const raw of parsed.operands.slice(skip)) targets.push({path: resolvePath(raw, event), kind, ...extra});
  return true;
}

const R_OPERAND_OPTIONS = {
  mkdir: ["pv", "-m --mode", "--parents --verbose"],
  tee: ["ai", "", "--append --ignore-interrupts"],
  touch: ["acmh", "-d -r -t --date --reference --time", "--no-create"],
  remove: ["firdRvPuvz", "--interactive --preserve-root --one-file-system -s --size -n --iterations", "--force --recursive --dir --verbose --parents --ignore-fail-on-non-empty --remove --zero"],
  move: ["afHiLnPpRrsuvxT", "-t --target-directory -S --suffix", "--archive --force --interactive --no-clobber --recursive --verbose --no-target-directory"],
  link: ["sfnvT", "-t --target-directory -S --suffix", "--symbolic --force --no-dereference --verbose --no-target-directory"],
  install: ["dDpCvT", "-t --target-directory -m --mode -o --owner -g --group -S --suffix", "--directory --compare --verbose --no-target-directory --preserve-timestamps --strip"],
  metadata: ["Rcfhv", "--reference", "--recursive --changes --silent --quiet --verbose"],
};

function rOperands(tokens, name) {
  const [short, values, long] = R_OPERAND_OPTIONS[name];
  return rLiteralOperands(tokens, {short, values: values ? values.split(" ") : [], long: long.split(" ")});
}

function rResolveShellTargets(command, event, {resolvePath, fsType, defaultCwd}) {
  const lexed = rLexShell(command);
  if (lexed.invalid) return R_UNRESOLVED;
  const targets = [];
  const sources = [];
  let workingDirectory = event && typeof event.cwd === "string" ? event.cwd : defaultCwd;
  for (const segment of lexed.segments) {
    if (segment.dynamic) return R_UNRESOLVED;
    for (const raw of segment.redirectTargets || []) {
      const target = resolvePath(raw, event);
      if (!target) return R_UNRESOLVED;
      targets.push({path: target, kind: "file"});
    }
    const initial = rSkipAssignments(segment.tokens);
    const unwrapped = rUnwrapCommand(initial);
    const word = unwrapped.word;
    if (!word) continue;
    const scopedEvent = {...event, cwd: workingDirectory};
    if (word === "cd") {
      const parsed = rLiteralOperands(unwrapped.rest);
      const operands = parsed?.operands || [];
      if (operands.length !== 1 || segment.redirectWrite || segment.separator === "|" || segment.separator === "||") return R_UNRESOLVED;
      const destination = resolvePath(operands[0], scopedEvent);
      if (!destination || fsType(destination) !== "dir") return R_UNRESOLVED;
      workingDirectory = destination;
      continue;
    }
    if (word === "mkdir") {
      const parsed = rOperands(unwrapped.rest, "mkdir");
      if (!rPushTargets(parsed, scopedEvent, targets, "dir", resolvePath, 0, {implicitParents: true})) return R_UNRESOLVED;
    } else if (word === "touch" || word === "tee") {
      const parsed = rOperands(unwrapped.rest, word);
      if (!rPushTargets(parsed, scopedEvent, targets, "file", resolvePath)) return R_UNRESOLVED;
    } else if (word === "rm" || word === "rmdir" || word === "unlink" || word === "truncate" || word === "shred") {
      const parsed = rOperands(unwrapped.rest, "remove");
      if (!rPushTargets(parsed, scopedEvent, targets, "delete", resolvePath)) return R_UNRESOLVED;
    } else if (word === "mv" || word === "cp") {
      const parsed = rOperands(unwrapped.rest, "move");
      if (!parsed || !rCopyMoveTargets(word, parsed, scopedEvent, targets, sources, word === "mv" ? "move" : "file", resolvePath, fsType)) return R_UNRESOLVED;
    } else if (word === "ln") {
      const parsed = rOperands(unwrapped.rest, "link");
      if (!parsed || !rCopyMoveTargets("ln", parsed, scopedEvent, targets, sources, "link", resolvePath, fsType)) return R_UNRESOLVED;
    } else if (word === "install") {
      const parsed = rOperands(unwrapped.rest, "install");
      if (!parsed?.operands.length) return R_UNRESOLVED;
      const directoryMode = [...parsed.options.keys()].some((option) => option === "-d" || option === "--directory" || /^-[A-Za-z]*d/.test(option));
      if (directoryMode) {
        if (!rPushTargets(parsed, scopedEvent, targets, "dir", resolvePath)) return R_UNRESOLVED;
      } else if (!rCopyMoveTargets("install", parsed, scopedEvent, targets, sources, "file", resolvePath, fsType)) return R_UNRESOLVED;
    } else if (word === "chmod" || word === "chown") {
      const parsed = rOperands(unwrapped.rest, "metadata");
      if (!rPushTargets(parsed, scopedEvent, targets, "metadata", resolvePath, 1)) return R_UNRESOLVED;
    } else if (segment.redirectTargets?.length) {
      // Redirection targets already describe this filesystem effect.
    } else if (rClassifySegment(segment).kind === "read") {
      continue;
    } else {
      return R_UNRESOLVED;
    }
  }
  if (targets.some((entry) => !entry.path) || sources.some((entry) => !entry)) return R_UNRESOLVED;
  return {resolvable: targets.length > 0, targets, sources};
}

function rContainerExecTokens(tokens, compose) {
  let index = compose ? 3 : 2;
  const valueOptions = new Set([
    "-e", "--env", "--env-file", "-u", "--user", "-w", "--workdir", "--detach-keys",
    "--preserve-fds", "--latest", "--cidfile",
  ]);
  const flagOptions = new Set(["-d", "--detach", "-i", "--interactive", "-t", "--tty", "--privileged"]);
  while (index < tokens.length) {
    const token = tokens[index];
    if (token.quoted || token.value === "-") break;
    const value = token.value;
    if (value === "--") {
      index += 1;
      break;
    }
    if (valueOptions.has(value)) {
      if (!tokens[index + 1]) return null;
      index += 2;
      continue;
    }
    if ([...valueOptions].some((option) => option.startsWith("--") && value.startsWith(option + "="))) {
      index += 1;
      continue;
    }
    if (/^-[euw].+/.test(value) || /^-[dit]+$/.test(value) || flagOptions.has(value)) {
      index += 1;
      continue;
    }
    if (value.startsWith("-")) return null;
    break;
  }
  if (!tokens[index] || tokens[index].quoted || tokens[index].value.startsWith("-")) return null;
  return tokens.slice(index + 1);
}

function rClassifyContainerExec(tokens, compose) {
  const inner = rContainerExecTokens(tokens, compose);
  if (!inner || !inner.length) return R_UNKNOWN;
  return rClassifySegment({
    tokens: inner,
    text: inner.map((token) => token.value).join(" "),
    redirectWrite: false,
    redirectTargets: [],
    dynamic: false,
    separator: null,
  });
}

function rGitSubcommand(values) {
  let index = 1;
  while (index < values.length) {
    if (["-C", "-c", "--git-dir", "--work-tree", "--namespace"].includes(values[index])) {
      index += 2;
      continue;
    }
    if (/^--(?:git-dir|work-tree|namespace)=/.test(values[index]) || values[index] === "--no-pager" || values[index] === "--no-optional-locks") {
      index += 1;
      continue;
    }
    break;
  }
  return {name: values[index] || "", rest: values.slice(index + 1)};
}

function rDefiniteEffect(segment) {
  const initial = rSkipAssignments(segment.tokens);
  if (!initial.length) return null;
  if (initial[0].quoted) return rUnknown("hidden-or-dynamic-shell", {declarable: false});
  const {word, tokens} = rUnwrapCommand(initial);
  const values = tokens.map((token) => token.value);
  const flags = tokens.filter((token) => !token.quoted).map((token) => token.value);
  if (!word) return null;
  if (["eval", "exec", "source", ".", "xargs", "sudo", "doas", "sh", "bash", "zsh", "dash", "ksh", "fish"].includes(word)) {
    const body = values.slice(1).join(" ");
    if (/\b(?:rm|rmdir|unlink|truncate|shred)\b/.test(body)) return rWrite("deletion", "hidden-definite-deletion");
    if (/(^|[^<>])>{1,2}(?![=>&])/.test(body) || /\b(?:mkdir|touch|chmod|chown|ln|dd|patch|tee)\b/.test(body)) {
      return rWrite("implementation", "hidden-definite-write");
    }
    return rUnknown("hidden-or-dynamic-shell", {declarable: false});
  }
  if (["rm", "rmdir", "unlink", "truncate", "shred"].includes(word)) return rWrite("deletion");
  if (["mv", "cp"].includes(word)) return rWrite("movement");
  if (["mkdir", "touch", "install", "chmod", "chown", "ln", "dd", "patch", "tee"].includes(word)) return rWrite("implementation");
  if (["kill", "killall", "launchctl", "systemctl", "service"].includes(word)) return rWrite("environment");
  if (["curl", "wget"].includes(word)) return rWrite("network");
  if (word === "git") {
    const {name, rest} = rGitSubcommand(values);
    if ([
      "add", "commit", "push", "tag", "checkout", "switch", "reset", "rebase", "merge", "cherry-pick", "revert", "clean",
      "stash", "apply", "am", "rm", "mv", "restore", "fetch", "pull", "init", "clone", "worktree", "submodule", "notes",
      "filter-branch", "gc", "prune",
    ].includes(name)) return rWrite("git", "git-" + name);
    if (name === "config" && !rest.every((token) => /^(?:--get|--get-all|--list|-l)$/.test(token))) return rWrite("git", "git-config");
    if (["remote", "branch"].includes(name) && rest.some((token) => !/^(?:-v|--show-current|--list|-a|-r|-vv|get-url)$/.test(token))) {
      return rWrite("git", "git-" + name);
    }
  }
  if (["npm", "yarn", "pnpm", "bun"].includes(word)) {
    const action = values.find((value, index) => index > 0 && !value.startsWith("-"));
    if (["install", "add", "remove", "uninstall", "update", "link"].includes(action)) return rWrite("dependencies");
    if (action === "publish") return rWrite("publish");
  }
  if (["docker", "podman"].includes(word)) {
    const offset = values[1] === "compose" ? 2 : 1;
    if (values[offset] === "exec") return rClassifyContainerExec(tokens, values[1] === "compose");
    if (["up", "down", "start", "stop", "restart", "rm", "build", "run", "create", "kill", "pause", "unpause"].includes(values[offset])) {
      return rWrite("environment", "container-lifecycle");
    }
  }
  if (["codex", "claude"].includes(word) && values.includes("plugin") && values.some((value) => ["add", "remove", "install", "uninstall", "update"].includes(value))) {
    return rWrite("environment", "host-plugin");
  }
  if (word === "find") {
    if (flags.includes("-delete")) return rWrite("deletion");
    if (flags.some((flag) => /^-(?:exec|execdir|ok|okdir)$/.test(flag))) return rUnknown("hidden-or-dynamic-shell", {declarable: false});
    if (flags.some((flag) => /^-(?:fprint|fprint0|fprintf|fls)$/.test(flag))) return rWrite("implementation");
  }
  if (word === "awk" && /\b(?:system|close)\s*\(|\bgetline\b|[>|]/.test(values.slice(1).join(" "))) {
    return rUnknown("hidden-or-dynamic-shell", {declarable: false});
  }
  if (word === "sed") {
    if (flags.some((flag) => /^-[A-Za-z]*i/.test(flag) || /^--in-place(?:=|$)/.test(flag))) return rWrite("implementation", "sed-in-place");
    const script = values.slice(1).join(" ");
    if (/(?:^|[;\s])(?:w|W)\s+\S/.test(script) || /s(.).*\1.*\1[^;\n]*w\s+\S/.test(script)) return rWrite("implementation", "sed-write-command");
  }
  return null;
}

function rClassifySegment(segment) {
  if (segment.dynamic) return rUnknown("hidden-or-dynamic-shell", {declarable: false});
  const initial = rSkipAssignments(segment.tokens);
  if (!initial.length) return segment.redirectWrite
    ? rUnknown("dynamic-declaration-required", {minimumEffect: "implementation", reasonDetail: "shell-redirection"})
    : R_READ;
  const {word, rest} = rUnwrapCommand(initial);
  if (word === "cd") {
    const operands = rest.filter((token) => token.value !== "--");
    return operands.length === 1 && !rest.some((token) => !token.quoted && token.value.startsWith("-") && token.value !== "--")
      ? R_READ
      : rUnknown("hidden-or-dynamic-shell", {declarable: false});
  }
  const definite = rDefiniteEffect(segment);
  if (definite) return definite;
  if (segment.redirectWrite) {
    return rUnknown("dynamic-declaration-required", {minimumEffect: "implementation", reasonDetail: "shell-redirection"});
  }
  return R_UNKNOWN;
}

export function classifyShell(command) {
  if (typeof command !== "string" || !command.trim()) return R_READ;
  if (/[\r\u0000]/.test(command)) return rUnknown("hidden-or-dynamic-shell", {declarable: false});
  const lexed = rLexShell(command.trim());
  if (lexed.invalid) return rUnknown("unbalanced-quoting", {declarable: false});
  if (!lexed.segments.length) return R_READ;
  let segments = lexed.segments;
  if (segments.length === 2) {
    const first = rClassifySegment(segments[0]);
    const firstWord = rUnwrapCommand(rSkipAssignments(segments[0].tokens)).word;
    if (firstWord === "cd" && first.kind === "read" && segments[0].separator === "&&") segments = segments.slice(1);
  }
  if (segments.length !== 1) return rUnknown("compound-with-unknown", {declarable: false});
  const result = rClassifySegment(segments[0]);
  return result.kind === "write" ? {...result, observedEffects: [result.effect]} : result;
}

export {
  rClassifyDeclaration as classifyDeclaration,
  rDeclarationSensitiveEffect as declarationSensitiveEffect,
  rClassifyToolEvent as classifyToolEvent,
  rOperationIdentity as operationIdentity,
  rToolPayload as toolPayload,
  rToolResult as toolResult,
  R_READ as shellRead,
  R_SENSITIVE_EFFECTS as sensitiveEffects,
  R_UNKNOWN as shellUnknown,
  R_UNRESOLVED as shellUnresolved,
  rClassifySegment as classifyShellSegment,
  rLexShell as lexShell,
  rResolveShellTargets as resolveShellTargets,
  rSkipAssignments as skipShellAssignments,
  rUnwrapCommand as unwrapShellCommand,
  rWrite as shellWrite,
};
