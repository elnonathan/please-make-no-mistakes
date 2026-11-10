# Distribution

## Contract

Claude Code and Codex each install PMNM through this repository's marketplace for that host. Both marketplaces select the same exact npm package. The package contains the portable skill and an optional brake for each host:

```text
GitHub repository marketplace
  -> exact npm package version
  -> Claude Code or Codex plugin installation
```

The repository is the marketplace source users add to Claude Code or Codex. Both hosts use the marketplace identity `please-make-no-mistakes`, so it does not collide with another repository from the same maintainer. `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json` pin the same immutable npm version. Neither marketplace file ships in the package.

`.claude-plugin/plugin.json` exposes the Claude Code plugin and its `hooks/claude/hooks.json`. `.codex-plugin/plugin.json` exposes the packaged `skills/` directory and declares `./hooks/codex/hooks.json` in its `hooks` field. Codex uses that declared hook file instead of default discovery. No conventional `hooks/hooks.json` ships, because Claude Code would merge it into the plugin root. A release changes the package, plugins, marketplaces, skill and brake together.

The npm package can carry PMNM to another host, but it cannot activate the skill there by itself. Each host needs a documented and tested registration route. Claude Code and Codex have one. [SETUP.md](../SETUP.md) does not invent commands for other hosts, whose integration is still in progress.

This route does not depend on an OpenAI Plugins Directory listing. A future submission would need its own release and trust review.

## Artifact

The npm package contains the portable skill, the dependency-free brake, the retired interlock source (unregistered, kept for rollback), public documentation, blind behavior evaluation definitions, the retired interlock's host-guard evaluation definitions, and verification utilities. It declares no runtime registry dependency and no npm lifecycle script. The explicit `files` allowlist excludes repository workflows, marketplace metadata, maintainer state, PMNM folders, and generated output.

Run the artifact check with:

```bash
npm run smoke:distribution
```

It packs the declared payload, rejects unsafe or undeclared entries, installs the tarball in a temporary consumer with lifecycle scripts disabled, validates the installed plugin, skill, and hook identities, and compares the installed skill and hook bytes with the trusted source tree. This does not execute or trust the installed hook.

## Release identity

For version `X.Y.Z`, all of these must agree before tagging:

- `package.json` version is `X.Y.Z`;
- `.claude-plugin/plugin.json` version is `X.Y.Z`;
- `.codex-plugin/plugin.json` version is `X.Y.Z`;
- `.agents/plugins/marketplace.json` selects npm package `please-make-no-mistakes` at `X.Y.Z` from `https://registry.npmjs.org`;
- `.claude-plugin/marketplace.json` selects the same package, version and registry;
- the release tag is exactly `vX.Y.Z`.

The validators reject version drift and a marketplace that points to a mutable or local source.

## Local Release Verification

`npm run release:verify` runs every configured package, documentation, evaluation, brake, retired-interlock, installed-tree, and distribution check under the declared Node.js envelope. It reports an aggregate result after every check has run instead of hiding later failures behind the first non-zero exit.

The documentation gate checks ownership and semantic setup boundaries. Its adversarial suite removes or changes those boundaries and requires each mutation to fail. The blind evaluation smoke verifies that model-facing cases omit expected answers and that incorrect routing decisions are rejected deterministically. These are source-level claims; model execution and clean-session host behavior remain separate evidence.

## Trusted publication

`.github/workflows/publish.yml` runs only for tags matching `v*` in `elnonathan/please-make-no-mistakes`. It uses a GitHub-hosted Node.js 24 and Python 3.13 environment, verifies the tag against `package.json`, runs `npm run release:verify`, and publishes publicly through npm Trusted Publishing with OIDC.

The workflow grants only `contents: read` and `id-token: write`, uses the protected `npm-publish` environment, and reads no npm token or repository secret. Configure npm's trusted publisher for GitHub user `elnonathan`, repository `please-make-no-mistakes`, workflow `publish.yml`, and environment `npm-publish` before pushing an OIDC release tag.

### One-time npm bootstrap

The package must already exist on npm before Trusted Publishing can be configured. This is an npm constraint, not a repository preference; the official [`npm trust` documentation](https://docs.npmjs.com/cli/v11/commands/npm-trust/) states that the target package must exist.

Before the first OIDC release:

1. Align every release surface to a prerelease of the intended first public version, such as `0.1.0-bootstrap.0`.
2. Run `npm run release:verify` on that exact state.
3. Publish it interactively with account 2FA using `npm publish --access public --tag bootstrap`; do not put it on `latest`.
4. Configure the GitHub trusted publisher and allow `npm publish` for `publish.yml` in environment `npm-publish`.
5. Require 2FA and disallow traditional publishing tokens in the package settings.
6. Align the intended public version across package, plugin, marketplace, and changelog, then use the normal tag workflow.

The bootstrap publish is a separately authorized external action. It must not introduce an npm token into the repository or workflow, and it does not count as evidence that OIDC publication works.

After bootstrap, the normal release sequence is:

1. Align package, plugin, marketplace, and changelog versions.
2. Run `npm run release:verify` on the intended release state.
3. Put that state on `main` and require CI to pass.
4. Create and push only the matching `v<version>` tag.
5. Approve the protected environment if its policy requires review.
6. Run `npm run verify:published -- <version>`.
7. Create a matching GitHub release only after postpublication verification passes.

Tagging, pushing, publishing, environment approval, and GitHub release creation remain separate external actions. Local validation does not authorize or simulate them.

## Postpublication verification

```bash
npm run verify:published -- <version>
```

The verifier checks:

1. local release identity and a clean checkout at the matching repository tag;
2. exact npm registry availability;
3. installation from a fresh temporary npm cache with lifecycle scripts disabled;
4. installed package, plugin, skill, and hook identity plus byte equality with the release source;
5. the tag-pinned GitHub marketplace inside a temporary `CODEX_HOME`;
6. the exact plugin version is installed and enabled.

The result is `passed` (exit `0`), `failed` (`1`), `invalid` (`2`), or `blocked` (`3`). Registry, network, marketplace, or Codex client unavailability is never converted into a pass. Temporary installation state is removed when verification ends.

## Installation

[SETUP.md](../SETUP.md) is the single installation, update, rollback, removal, and verification authority. `npm install` alone does not register or activate a Codex plugin, discover its skill, trust its hook, or configure another host integration.

## Continuous Integration

Repository CI runs the complete aggregate gate on Linux across the oldest and newest declared Node.js and Python versions and on current macOS. Windows support is in progress. On Windows, CI runs the portable profile: the skill, documentation and evaluation checks. It does not yet run the brake, package and Claude Code discovery checks, or the retired interlock suites, because they still assume a POSIX shell and paths. These deterministic checks validate configuration, covered brake decisions and the retired interlock's covered transitions, not host trust or real hook delivery. A local pass establishes only the current machine. Hosted support remains unverified until those jobs pass on the exact committed candidate.
