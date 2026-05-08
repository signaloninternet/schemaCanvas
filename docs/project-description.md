# SchemaCanvas Project Description

## Project Title

SchemaCanvas: PostgreSQL Schema Design IDE

## Short Description

SchemaCanvas is a PostgreSQL-first schema design IDE that keeps SQL, visual ER diagrams, documentation, validation warnings, generated SQL, and migration previews synchronized through one normalized schema model. It lets developers paste or write PostgreSQL DDL, view the schema as an interactive relationship canvas, make visual edits, and regenerate accurate SQL and supporting documentation from the same source of truth.

## One-Line Portfolio Summary

Built a PostgreSQL schema design IDE using Next.js, TypeScript, React Flow, CodeMirror, Zustand, and a custom schema-core package to synchronize SQL editing, ER diagrams, validation, migration previews, documentation, and export workflows.

## Problem Statement

Database design often happens across disconnected tools. Developers write SQL in one place, draw ER diagrams in another, maintain documentation manually, and review migrations separately. This creates duplicated work and increases the chance that the visual diagram, SQL schema, and documentation become inconsistent.

Many visual database tools also hide or oversimplify SQL. On the other side, raw SQL workflows are powerful but difficult to inspect visually, especially when schemas grow to many tables and relationships. SchemaCanvas solves this by treating SQL, diagrams, generated documentation, warnings, and migrations as different views of the same schema state.

## Why This Project Is Needed

SchemaCanvas exists to reduce friction in relational database design. It is useful because database schemas are central to most applications, but the design process is still often fragmented.

Key reasons:

- Developers need SQL-level control, not only drag-and-drop diagrams.
- Teams need visual understanding of tables, columns, and relationships.
- Documentation should be generated from the real schema instead of maintained manually.
- Migration previews should be visible before changes are applied.
- Unsupported SQL should be preserved and warned about, not silently ignored.
- The system should avoid maintaining separate SQL and canvas states that can drift apart.

The main value is bidirectional schema editing. A user can start from SQL, inspect the schema visually, make edits on the canvas, and regenerate SQL without losing the underlying database structure.

## What The Project Does

SchemaCanvas provides a complete local-first workspace for designing PostgreSQL schemas.

Core workflow:

1. User pastes or writes PostgreSQL DDL in the SQL editor.
2. The custom parser converts supported SQL into a normalized `SchemaModel`.
3. The schema model powers the canvas, inspector, warnings, docs, JSON output, and migration preview.
4. User edits tables, columns, or relationships visually.
5. Typed schema operations update the same normalized model.
6. SQL, documentation, warnings, and migration output are regenerated from the updated model.

## Major Features

- Live PostgreSQL DDL editor powered by CodeMirror.
- Interactive ER diagram canvas powered by React Flow.
- Custom table nodes with columns, primary keys, unique markers, nullable state, defaults, and relationships.
- Visual table and column editing through an inspector panel.
- Relationship creation from the canvas.
- Deterministic schema warnings for missing keys, possible missing foreign keys, and modeling issues.
- SQL generation from the normalized schema model.
- Migration preview between the previous and current schema.
- Markdown documentation generation.
- JSON `SchemaModel` export.
- PNG and SVG diagram export.
- Local persistence for project state.
- Sample schemas for ecommerce, project management, and valet-platform use cases.
- Last-valid-schema behavior that keeps the canvas stable when SQL parsing fails.
- Unsupported statement preservation with warnings.

## Supported PostgreSQL Scope

The MVP parser focuses on high-value PostgreSQL DDL instead of trying to parse all SQL.

Currently supported statements:

- `CREATE TYPE ... AS ENUM`
- `CREATE TABLE`
- `CREATE INDEX`
- `COMMENT ON TABLE`
- `COMMENT ON COLUMN`

Currently supported table features:

- Column definitions
- Primary keys
- Unique constraints
- Default values
- Inline foreign keys
- Table-level foreign keys
- Basic `CHECK` capture
- Table and column comments

Unsupported SQL is preserved as raw text and surfaced as a warning. This prevents silent schema corruption and makes parser limitations visible to the user.

## Architecture Overview

SchemaCanvas is organized as a TypeScript monorepo with two main workspaces.

### `packages/schema-core`

This package owns the product's core database logic. It is UI-agnostic and contains:

- Normalized `SchemaModel`
- PostgreSQL DDL parser
- Schema operations
- SQL generator
- Migration preview generator
- Validation and review rules
- Markdown documentation generator
- Example schemas
- Unit tests

### `apps/web`

This package owns the user interface. It contains:

- Next.js App Router web app
- SQL editor panel
- React Flow schema canvas
- Table node and relationship edge components
- Schema inspector
- Review panel
- Export/import controls
- Local workspace store
- Component tests

## Technical Stack

- Framework: Next.js 15
- Language: TypeScript
- UI: React 19
- Canvas: React Flow
- SQL editor: CodeMirror
- State management: Zustand
- Styling: Tailwind CSS
- UI primitives: Radix UI
- Validation: Zod
- Diagram export: html-to-image
- Layout: Dagre
- Unit testing: Vitest
- Component testing: Testing Library
- End-to-end testing: Playwright
- Package manager: pnpm
- Runtime requirement: Node.js 22+

## Key Engineering Decisions

### One Normalized Schema Model

The project does not keep SQL, diagrams, documentation, and migration state as separate sources of truth. All views are generated from one `SchemaModel`. This makes the system more reliable and reduces drift between different representations.

### UI-Agnostic Core Package

The parsing, operations, validation, generation, documentation, and diffing logic live in `packages/schema-core`. This keeps core behavior testable and reusable outside the web UI.

### Deterministic Parser And Generator

The parser and SQL generator are designed to produce predictable output. This matters because schema tools must be trustworthy and reviewable.

### Preserve Unsupported SQL

Instead of pretending to understand unsupported PostgreSQL statements, the parser keeps those statements as raw SQL and warns the user. This is safer than silently dropping or incorrectly transforming schema definitions.

### Last Valid Schema

If the user types invalid SQL, SchemaCanvas keeps the last valid visual schema rendered on the canvas. This avoids work loss and prevents the UI from constantly collapsing while the user is editing.

## Numbers You Can Include

Use these numbers in a resume, project report, portfolio case study, or presentation. These are based on the current repository state.

| Metric                                    | Number | How To Use It                                                                             |
| ----------------------------------------- | -----: | ----------------------------------------------------------------------------------------- |
| Monorepo workspaces                       |      2 | Next.js web app plus reusable schema-core package                                         |
| TypeScript/TSX source files               |     51 | Shows implementation size excluding generated files                                       |
| TypeScript/TSX lines of code              |  6,684 | Shows project scale excluding generated files and dependencies                            |
| Web component files                       |     23 | Demonstrates UI breadth                                                                   |
| Schema-core source files                  |     16 | Demonstrates separated domain logic                                                       |
| Schema-core top-level modules             |      9 | Parser, model, operations, generator, validator, diff, docs, examples, tests              |
| Architecture/documentation files          |      9 | Shows engineering documentation and planning                                              |
| Example schemas                           |      3 | Ecommerce, project management, and valet platform examples                                |
| Supported PostgreSQL statement categories |      5 | Enum, table, index, table comments, column comments                                       |
| Supported table/schema features           |      8 | Columns, PKs, unique constraints, defaults, inline FKs, table-level FKs, checks, comments |
| Export/output formats                     |      5 | SQL, migration preview, Markdown docs, JSON model, PNG/SVG diagrams                       |
| Test files                                |      3 | Core unit, web component, and Playwright E2E tests                                        |
| Passing tests                             |      6 | 4 schema-core tests, 1 web component test, 1 E2E test                                     |
| Quality commands                          |      5 | lint, typecheck, unit tests, E2E tests, build                                             |

## Suggested Resume Bullets

- Built SchemaCanvas, a PostgreSQL-first schema design IDE that synchronizes SQL editing, ER diagrams, validation warnings, generated SQL, migration previews, documentation, and exports through one normalized schema model.
- Implemented a reusable TypeScript `schema-core` package with parsing, schema operations, SQL generation, validation, migration previewing, Markdown documentation, and example schemas.
- Developed an interactive Next.js workspace with CodeMirror SQL editing, React Flow relationship canvas, inspector-driven schema editing, local persistence, and PNG/SVG/JSON/Markdown export support.
- Supported 5 PostgreSQL DDL statement categories and 8 core table features, including enums, tables, indexes, comments, primary keys, unique constraints, defaults, checks, and foreign keys.
- Structured the project as a 2-workspace TypeScript monorepo with 6,684 lines of source code, 51 TypeScript/TSX files, 9 architecture docs, and automated unit, component, and Playwright E2E coverage.

## Suggested Project Report Paragraph

SchemaCanvas is a database schema design IDE built to make PostgreSQL schema development more reliable and visual. The project addresses the gap between SQL-first workflows and visual database modeling tools by using a single normalized schema model as the source of truth. SQL written in the editor is parsed into this model, rendered as an interactive ER diagram, reviewed for modeling problems, and used to generate SQL, migration previews, documentation, JSON, and diagram exports. Visual edits made on the canvas are also applied through typed operations to the same model, allowing the SQL and diagram to stay synchronized.

The project is implemented as a TypeScript monorepo with a reusable `schema-core` package and a Next.js web app. The core package handles parsing, validation, schema operations, SQL generation, migration previews, and Markdown documentation. The web app provides the user-facing workspace with CodeMirror, React Flow, Zustand, Tailwind CSS, Radix UI, and export functionality. The current MVP supports 5 PostgreSQL DDL statement categories, 8 table/schema features, 3 sample schemas, 5 output/export types, and includes unit, component, and end-to-end tests.

## Impact And Value

SchemaCanvas improves schema design by combining SQL accuracy with visual understanding. It helps users review database structure faster, reduces manual documentation effort, and gives developers a safer way to move between SQL and diagram-based editing. The unsupported-statement preservation strategy also makes the tool more trustworthy because users can see parser limitations instead of losing SQL silently.

## High-Impact Enhancements

These enhancements would make SchemaCanvas feel closer to commercial-grade database tooling and would significantly improve demo value, technical depth, and startup-level perception.

### 1. AST Visualization

Adding AST visualization would show the internal compiler-style pipeline behind the product:

```text
SQL -> Parser -> AST -> SchemaModel -> Generators
```

This would make the architecture easier to explain and more impressive in demos because users could see how raw SQL becomes structured data and then powers diagrams, validation, documentation, and generated output.

What to add:

- SQL statement tree viewer
- Parsed token/statement breakdown
- AST node inspector
- Side-by-side AST and `SchemaModel` view
- Parser warning highlights connected to specific SQL statements

Numbers to track:

- Number of supported AST node types
- Number of SQL statement types parsed into AST
- Parser success rate across example schemas
- Average parse time for small, medium, and large schemas

### 2. Collaborative Editing

Collaborative editing would make SchemaCanvas significantly more advanced because real-time schema editing is difficult to implement correctly. It would move the product from a local design tool toward a collaborative database design workspace.

What to add:

- Yjs-based shared document state
- CRDT-backed schema operations
- Multiplayer cursors on the canvas
- Presence indicators
- Collaborative table and column editing
- Conflict-safe schema operation history

Numbers to track:

- Number of simultaneous collaborators supported in testing
- Average sync latency between clients
- Number of collaborative operations tested
- Conflict resolution success rate
- Cursor/presence update frequency

### 3. Migration Diff Intelligence

Smarter migration diffing would make SchemaCanvas much closer to real commercial database tooling. Instead of only showing basic generated changes, the system could reason about risk, dependency order, and destructive operations.

What to add:

- Column rename detection
- Table rename detection
- Destructive change warnings for dropped tables, dropped columns, and type narrowing
- Foreign key dependency warnings
- Migration ordering based on relationship dependencies
- Safe/unsafe migration classification

Numbers to track:

- Number of migration change types detected
- Number of destructive change categories flagged
- Rename detection accuracy across test cases
- Number of dependency warning scenarios covered
- Number of migration fixtures in the test suite

### 4. Database Introspection

Database introspection would be a major product upgrade because users could connect an existing PostgreSQL database, reverse-engineer its structure, and instantly visualize it. This would make SchemaCanvas useful not only for greenfield schema design but also for understanding real production databases.

What to add:

- PostgreSQL connection flow
- Schema introspection queries against `information_schema` and `pg_catalog`
- Reverse engineering of tables, columns, indexes, enums, constraints, and foreign keys
- Import existing database schema into `SchemaModel`
- Visualize live database structure on the canvas
- Optional read-only mode for safe exploration

Numbers to track:

- Number of PostgreSQL object types introspected
- Number of tables/relationships successfully imported in test databases
- Introspection time for small, medium, and large schemas
- Percentage of schema objects mapped into `SchemaModel`
- Number of database fixtures validated

### 5. Visual Schema History

Visual schema history would create a strong demo experience by showing how a database evolved over time. A timeline slider, migration replay, or schema evolution view would help teams understand why a schema looks the way it does today.

What to add:

- Schema timeline
- Migration replay mode
- Before/after visual diff
- Snapshot comparison
- Highlighted table, column, and relationship changes
- Restore or branch from previous schema states

Numbers to track:

- Number of schema snapshots stored
- Number of migration steps replayed
- Number of visual change categories highlighted
- Time required to compare two schema versions
- Number of historical states supported without UI slowdown

## Suggested Priority

The best order depends on the goal:

| Goal                                   | Best Next Feature           |
| -------------------------------------- | --------------------------- |
| Better demo and interview impact       | AST visualization           |
| Strongest technical credibility        | Collaborative editing       |
| Closest to commercial database tooling | Migration diff intelligence |
| Biggest real-world usability upgrade   | Database introspection      |
| Most visually impressive demo          | Visual schema history       |

Recommended practical order:

1. AST visualization
2. Migration diff intelligence
3. Database introspection
4. Visual schema history
5. Collaborative editing

This order builds depth gradually. AST visualization and migration intelligence improve the existing architecture first. Introspection then brings real database input into the product. Visual history builds on stronger diffing. Collaborative editing should come later because it affects state management, persistence, conflict handling, and UI behavior across the whole application.

## Future Scope

Planned improvements include:

- AST visualization for the SQL parser pipeline
- `ALTER TABLE` parsing and generation
- More advanced migration diffing
- Column rename detection and destructive migration warnings
- PostgreSQL database introspection
- Better diagram layout and edge routing
- Table grouping and module boundaries
- Search and focus mode for large schemas
- Supabase-specific schema annotations
- DBML, Mermaid, Prisma, and Drizzle exports
- Visual schema history and migration replay
- Snapshot history
- Multiplayer collaboration using Yjs or Liveblocks-compatible state
