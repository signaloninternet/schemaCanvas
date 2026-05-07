# Security Policy

## Reporting a vulnerability

Please do not open public issues for security-sensitive findings.

Instead:

1. prepare a minimal reproduction
2. describe impact and affected package or route
3. send the report privately to the maintainers

Until a dedicated project address exists, treat this repository as pre-1.0 and coordinate privately before disclosure.

## Scope

Current priority areas:

- parser correctness and unexpected SQL handling
- import/export boundaries
- local persistence behavior
- dependency supply-chain issues

## Disclosure process

- acknowledge report
- reproduce and triage
- patch on a private branch when necessary
- publish a changelog note once fixed
