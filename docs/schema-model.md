# Schema Model

`SchemaModel` is the product contract.

## Top-level shape

- `dialect`
- `tables`
- `enums`
- `indexes`
- `relationships`
- `layout`
- `metadata`

## Table

Each table includes:

- stable `id`
- `name`
- `schema`
- `columns`
- `constraints`
- optional `comment`

## Column

Each column includes:

- stable `id`
- `name`
- `type`
- `nullable`
- `primaryKey`
- `unique`
- optional `defaultValue`
- optional `references`
- optional `comment`

## Why normalized IDs matter

Names are not sufficient identity:

- tables can be renamed
- layout needs stability across SQL edits
- selection state should survive regeneration
- future collaboration needs object identity

## Layout

Layout is stored separately from parsing concerns so visual position survives SQL edits when names still match.

## Comments and documentation

Documentation fields live on schema entities so exports and inspector edits share the same storage.
