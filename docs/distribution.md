# Distribution

## Contract

Please, Make No Mistakes uses a repository marketplace that selects one exact npm package version containing the portable skill and optional Codex lifecycle guard:

```text
GitHub repository marketplace
  -> exact npm package version
  -> Codex plugin installation
```

The repository is the marketplace source users add to Codex. Its marketplace identity is also `please-make-no-mistakes`, which avoids colliding with another repository owned by the same maintainer. `.agents/plugins/marketplace.json` pins one immutable npm version, `.codex-plugin/plugin.json` exposes the packaged `skills/` directory, and Codex discovers the conventional `hooks/hooks.json` path without a manifest field. A release changes the package, plugin, marketplace, skill, and guard artifact together.

The npm package is also the canonical transport artifact for future compatible hosts. It does not imply universal activation: each host still needs a documented and tested registration adapter. The current automated host-specific route is Codex; [SETUP.md](../SETUP.md) fails closed rather than inventing commands for another host.

This route does not depend on a listing in the OpenAI Plugins Directory. A future directory submission would be a separate release and trust boundary.

## Artifact

The npm package contains the portable skill, the dependency-free Codex guard, public documentation, blind behavior and host-guard evaluation definitions, and verification utilities. It declares no runtime registry dependency and no npm lifecycle script. The explicit `files` allowlist excludes repository workflows, marketplace metadata, maintainer state, PMNM folders, and generated output.

Run the artifact check with:

```bash
npm run smoke:distribution
```

It packs the declared payload, rejects unsafe or undeclared entries, installs the tarball in a temporary consumer with lifecycle scripts disabled, validates the installed plugin, skill, and hook identities, and compares the installed skill and hook bytes with the trusted source tree. This does not execute or trust the installed hook.

## Release identity

For version `X.Y.Z`, all of these must agree before tagging:

- `package.json` version is `X.Y.Z`;
- `.codex-plugin/plugin.json` version is `X.Y.Z`;
- `.agents/plugins/marketplace.json` selects npm package `please-make-no-mistakes` at `X.Y.Z` from `https://registry.npmjs.org`;
- the release tag is exactly `vX.Y.Z`.

The validators reject version drift and a marketplace that points to a mutable or local source.

## Local Release Verification

`npm run release:verify` runs every configured package, documentation, evaluation, host-guard, installed-tree, and distribution check under the declared Node.js envelope. It reports an aggregate result after every check has run instead of hiding later failures behind the first non-zero exit.

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

Repository CI runs the complete aggregate gate on Linux across the oldest and newest declared Node.js and Python versions and on current macOS. Windows runs the portable profile, which omits symlink-oriented installed-tree tests while retaining documentation, host-guard, evaluation, package, and distribution checks. These deterministic checks validate configuration and covered state transitions, not host trust or real lifecycle delivery. A local pass establishes only the current machine; hosted support remains unverified until those jobs pass on the exact committed candidate.
