# Non-operative context registry example

This file demonstrates registration only. It supplies no active context.

```text
id: project.example-web-service
kind: project
location: /example/config/project-context.md
match conditions: verified repository root equals /example/repos/web-service
capabilities supplied: commands, environment safety, semantic navigation
precedence within those capabilities: project
enabled: true
privacy: private
owner or authority: repository maintainer
source and last verified state: repository instructions at revision example-1234
retention or deletion rule: remove when the repository is retired
notes: replace every example value only after verification
```

```text
id: person.example-collaborator
kind: person
location: /example/config/person-context.md
match conditions: the current collaborator explicitly identifies this context as theirs
capabilities supplied: communication preferences
precedence within those capabilities: person
enabled: true
privacy: private
owner or authority: the collaborator
source and last verified state: explicit statement on 2026-08-14
retention or deletion rule: delete on owner request
notes: never infer identity to activate this entry
```
