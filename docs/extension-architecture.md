# Extension Architecture

SchemaCanvas should grow through public boundaries, not hidden coupling.

## Planned extension surfaces

- import/export adapters
- dialect adapters
- validator rule packs
- documentation exporters
- canvas metadata overlays

## Public API center

The public core should remain anchored on:

- `SchemaModel`
- parser result contracts
- schema operations
- generator interfaces

## Plugin planning

A future extension system should allow:

- new exporters such as Prisma or Drizzle
- dialect-specific visualization metadata
- domain-specific review packs
- alternative migration emitters

See [RFC 0001](rfcs/0001-plugin-system.md).
