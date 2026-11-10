# Roadmap

This roadmap lists what is decided. It is not a release promise.

## Publication

The first public release is 0.1.0. It is published after the installation test passes in a real host session against the exact installed candidate, not before. Until then the package exists as a repository source and a local artifact.

## Other hosts

Claude Code and Codex each have a plugin and marketplace. Both use the same brake through their own host integration. Support for other coding agents is in progress. Another host may load the portable skill through its own mechanism, but this repository will not claim the complete PMNM folder workflow until it documents and verifies one literal pointer for that host. Any brake on that host also needs its own tested integration. Similar event names do not promise the same behavior.

## Rules and guards

A new rule or guard needs a failure observed in use and evidence that the existing guidance did not prevent it. The response depends on that evidence: the guard may block an action or ask for approval.
