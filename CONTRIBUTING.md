# Contributing

SchemaCanvas is organized around one rule: every user-facing view must be backed by the same schema model.

## Legal terms

This repository is proprietary and rights-reserved.

By submitting a pull request, patch, issue attachment, or any other contribution, you represent that you have the right to submit it and you grant the repository owner a perpetual, worldwide, irrevocable, sublicensable right to use, modify, reproduce, distribute, commercialize, and relicense that contribution.

If you do not agree to those terms, do not submit contributions.

## Local setup

```bash
pnpm install
pnpm dev
```

## Before opening a PR

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

If you touch end-to-end behavior, also run:

```bash
pnpm test:e2e
```

## Contribution boundaries

- Parser work belongs in `packages/schema-core/src/parser`
- SQL generation belongs in `packages/schema-core/src/generator`
- validation rules belong in `packages/schema-core/src/validator`
- visual behavior belongs in `apps/web/components`
- workspace state orchestration belongs in `apps/web/lib/schema-workspace-store.ts`

## Design constraints

- Do not make the canvas the source of truth
- Do not mutate SQL text directly from UI operations
- Do not silently ignore unsupported parser input
- Do not add dead controls
- Prefer typed schema operations over local component mutations

## PR expectations

- keep changes scoped
- explain the user-facing behavior change
- note parser or generator compatibility implications
- add or update tests when shared behavior changes

## Areas that benefit from tests

- parser coverage
- SQL generation ordering
- schema warnings
- migration diff output
- visual editing flows

## Good first issues

See the README list and open GitHub issues tagged `good first issue`.
