# SchemaCanvas

SchemaCanvas is a PostgreSQL-first schema design IDE built around one normalized schema model.

It lets you:

- write PostgreSQL DDL in a live editor
- inspect and edit the same schema visually on a relationship canvas
- keep SQL, ERD, documentation, warnings, and migration previews in sync
- preserve unsupported statements instead of pretending they were parsed

This repository is structured as a serious product codebase, not a diagram demo.

## Why this exists

Most database tools make you choose between raw SQL, visual modeling, or generated abstractions. SchemaCanvas treats those as different projections of the same schema state.

The core pipeline is:

```text
SQL editor
  -> focused PostgreSQL DDL parser
  -> unified SchemaModel
  -> canvas, docs, warnings, SQL generation, migration preview

Visual canvas + inspector
  -> schema operations
  -> unified SchemaModel
  -> regenerated SQL, docs, warnings, migration preview
```

## Current MVP

The current build includes:

- Next.js App Router web app
- split layout with SQL editor, visual canvas, and review panel
- PostgreSQL-focused DDL parser for:
  - `CREATE TYPE ... AS ENUM`
  - `CREATE TABLE`
  - inline and table-level foreign keys
  - primary keys
  - unique constraints
  - defaults
  - `CREATE INDEX`
  - `COMMENT ON TABLE`
  - `COMMENT ON COLUMN`
- unsupported statement preservation with warnings
- normalized schema model in `packages/schema-core`
- visual table editing
- relationship creation on the canvas
- deterministic schema review warnings
- generated SQL
- migration preview
- Markdown documentation export
- JSON `SchemaModel` export
- PNG/SVG diagram export
- local persistence

## Acceptance flow

The MVP supports the main flow described in the product brief:

1. Paste PostgreSQL DDL into the SQL editor.
2. Parse into `SchemaModel`.
3. Render tables and relationships on the canvas.
4. Add tables or columns visually.
5. Regenerate SQL from schema operations.
6. Review warnings, docs, and migration output.

## Repo layout

```text
apps/web
  app/
  components/
  lib/
  public/examples/

packages/schema-core
  src/model/
  src/parser/
  src/operations/
  src/generator/
  src/validator/
  src/diff/
  src/docs/
  src/examples/
  src/tests/

docs/
  architecture.md
  schema-model.md
  parser.md
  roadmap.md
  extension-architecture.md
  contributor-onboarding.md
  semver-and-releases.md
  adr/
  rfcs/
```

## Quick start

### Requirements

- Node.js 22+
- pnpm 10+

### Install

```bash
pnpm install
```

### Run the app

```bash
pnpm dev
```

### Run checks

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:e2e
pnpm build
```

## Examples

Three sample schemas are included:

- `simple-ecommerce.sql`
- `project-management.sql`
- `valet-platform.sql`

They are available in:

- `packages/schema-core/src/examples`
- `apps/web/public/examples`

## How bidirectional sync works

### SQL -> model -> UI

- SQL text is parsed into `SchemaModel`
- if parsing succeeds, the canvas updates
- if parsing fails, the last valid schema remains on screen
- unsupported statements are preserved separately and surfaced as warnings

### UI -> model -> SQL

- every visual edit calls a typed schema operation
- the operation returns a new validated `SchemaModel`
- SQL is regenerated from the schema model
- docs and migration preview update from the same model

## Parser scope

The parser is intentionally focused. It does not claim to support arbitrary PostgreSQL DDL yet.

If a statement is unsupported, SchemaCanvas does this instead:

- preserves the raw SQL
- shows a warning
- keeps the rest of the schema synchronized

That tradeoff is deliberate. The system refuses silent corruption.

## Architecture docs

- [Architecture](docs/architecture.md)
- [Schema Model](docs/schema-model.md)
- [Parser](docs/parser.md)
- [Roadmap](docs/roadmap.md)
- [Extension Architecture](docs/extension-architecture.md)
- [Contributor Onboarding](docs/contributor-onboarding.md)
- [Semver and Releases](docs/semver-and-releases.md)
- [ADR 0001](docs/adr/0001-central-schema-model.md)
- [RFC 0001](docs/rfcs/0001-plugin-system.md)

## Repository workflow

The repo includes:

- rights-reserved license
- contribution guide
- code of conduct
- security policy
- CI workflow
- issue templates
- PR template
- release and semver policy
- changelog structure

## Good first issues

- support `ALTER TABLE ... ADD COLUMN`
- add table grouping and module boundaries
- improve parser coverage for `CHECK` constraints
- improve migration diffing for renames
- add table search and focus mode
- add comment editing for relationships
- add Supabase-specific schema annotations

## Screenshots

Screenshot slots will be added here as the product UI evolves:

- workspace overview
- SQL-to-canvas sync
- migration review panel
- documentation export

## Roadmap

Short-term:

- deeper parser coverage
- richer migration diffing
- better edge routing and layout heuristics
- keyboard shortcuts
- table search

Mid-term:

- extension API
- DBML / Mermaid / Prisma / Drizzle export
- Supabase mode
- snapshot history

Long-term:

- collaboration with Yjs / Liveblocks-compatible state semantics
- comments, reviews, and presence
- cloud sync

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/contributor-onboarding.md](docs/contributor-onboarding.md).

## License

This repository is released as [UNLICENSED / all rights reserved](LICENSE).
No permission is granted to use, copy, modify, distribute, or commercialize the code
without prior express written permission.
