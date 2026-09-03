# Non-operative project-context example

This example shows values that belong in a project adapter rather than the portable core.

```text
project id: example-web-service
scope: /example/repos/web-service
source of authority: repository instructions and maintainer decisions
last verified source state: example-1234

commands:
  focused tests: use the project's documented command for the affected scenario
  formatting check: use the project's documented formatter check for affected files
  static analysis: use the project's documented narrow analysis command
  resource rule: run one heavy process at a time

environment safety:
  - Local and testing data are distinct.
  - Do not restore, synchronize, or mutate shared data without authorization.
  - Historical exports are not current environment state.

tool adapter:
  applies when: named symbols or structural relationships must be traced and a compatible language-aware navigator is available
  preferred tool: the project-selected semantic or structural navigator
  capability provided: symbol identity, definitions, candidate references, and semantic navigation
  cannot establish alone: runtime reachability, complete absence, product intent, or behavior
  fallback: text search, definitions and callers, build configuration, focused checks, and direct inspection
  mutation limit: read-only investigation
```

The values are illustrative. Do not execute the commands or assume the paths exist.
