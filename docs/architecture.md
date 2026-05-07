# Architecture

SchemaCanvas is split into two main layers:

## 1. `packages/schema-core`

This package owns:

- normalized `SchemaModel`
- focused PostgreSQL parser
- schema operations
- SQL generator
- migration preview generation
- deterministic validation rules
- Markdown documentation generation

It is designed to stay UI-agnostic.

## 2. `apps/web`

This app owns:

- split workspace layout
- SQL editor
- visual graph canvas
- inspector
- local persistence
- export and import UX

The web app does not invent a second schema state. It orchestrates `schema-core`.

## Data flow

```text
SQL editor text
  -> parseSchemaSql()
  -> SchemaModel
  -> render tables, relationships, problems, docs

Canvas interaction
  -> typed operation
  -> SchemaModel
  -> generateSchemaSql()
  -> update editor + review panel
```

## Last-valid-schema behavior

When SQL is invalid:

- editor text remains untouched
- parse errors are surfaced
- last valid `SchemaModel` stays rendered on the canvas

This prevents work loss and visual thrash.

## Package boundaries

- `model/`: public types and validation schema
- `parser/`: SQL statement splitting and DDL parsing
- `operations/`: all user-authored mutations
- `generator/`: canonical PostgreSQL SQL output
- `validator/`: review rules
- `diff/`: migration preview generation
- `docs/`: Markdown documentation output

## Canvas architecture

React Flow is used as a rendering substrate, not the source of truth.

The app adds:

- custom table nodes
- handle-per-column relationship creation
- layout persistence
- inspector-driven editing
- migration/doc review tied to the same state

## Collaboration readiness

The current store is local-first, but the state shape is intentionally compatible with future shared editing:

- operations are explicit
- the schema model is normalized
- layout and viewport are separate concerns
- parser/generator are deterministic

That makes future Yjs or Liveblocks integration reasonable without replacing the product core.
