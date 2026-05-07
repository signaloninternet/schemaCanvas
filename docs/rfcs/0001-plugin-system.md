# RFC 0001: Plugin System

## Summary

Introduce a plugin system for import/export adapters, review packs, and dialect extensions.

## Goals

- keep `schema-core` stable
- avoid hardcoding every exporter into the main app
- enable ecosystem growth

## Non-goals

- arbitrary remote code execution in the browser
- replacing the central schema model

## Proposed surfaces

- exporter interface: `SchemaModel -> string | binary`
- importer interface: `string | file -> SchemaModel | parse warnings`
- validator interface: `SchemaModel -> SchemaProblem[]`

## Open questions

- plugin packaging format
- browser sandbox constraints
- version compatibility guarantees
