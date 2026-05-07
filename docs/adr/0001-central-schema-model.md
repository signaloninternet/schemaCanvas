# ADR 0001: Central Schema Model

## Status

Accepted

## Context

The product requires SQL editing, visual editing, documentation, warnings, and migration preview to stay aligned.

## Decision

Use a normalized `SchemaModel` as the central source of truth.

Do not treat:

- raw SQL text
- React Flow node state
- inspector local state

as authoritative schema state.

## Consequences

- parser output must map into `SchemaModel`
- visual edits must go through schema operations
- SQL generation becomes deterministic
- future collaboration has a stable model boundary
