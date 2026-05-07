# Contributor Onboarding

## Start here

1. read the README
2. read `docs/architecture.md`
3. run the app locally
4. inspect `packages/schema-core/src/index.ts`

## Mental model

Most changes fall into one of two categories:

- schema-core behavior
- web UI orchestration

If you are changing behavior across both, start in `schema-core` first.

## Recommended first tasks

- add parser fixtures
- improve warnings
- improve migration diff coverage
- polish inspector UX

## Review standard

Contributions should be easy to reason about:

- typed
- tested
- scoped
- compatible with the central schema model
