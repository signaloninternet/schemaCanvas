# Parser

SchemaCanvas currently uses a focused PostgreSQL DDL parser.

## Supported statements

- `CREATE TYPE ... AS ENUM`
- `CREATE TABLE`
- `CREATE INDEX`
- `COMMENT ON TABLE`
- `COMMENT ON COLUMN`

## Supported table features

- column definitions
- primary keys
- unique constraints
- defaults
- inline foreign keys
- table-level foreign keys
- basic `CHECK` capture

## Unsupported statements

Unsupported SQL is preserved as raw text and surfaced as warnings.

That means the parser does not claim coverage it does not have.

## Why not a fully general parser yet

For the current MVP, the priority is reliable bidirectional editing for a focused relational design workflow.

The parser should expand deliberately rather than pretend to understand arbitrary Postgres DDL and corrupt state.

## Extension path

Parser coverage can expand in phases:

1. `ALTER TABLE` add/drop support
2. richer index expressions
3. composite foreign keys in visualization
4. function / trigger / policy parsing
