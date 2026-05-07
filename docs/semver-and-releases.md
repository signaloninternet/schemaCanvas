# Semver and Releases

SchemaCanvas is currently pre-1.0.

## Versioning intent

- patch: fixes without public contract changes
- minor: backward-compatible new features
- major: schema-core or app API breaks

## Changelog structure

Use these sections:

- Added
- Changed
- Fixed

## Release checklist

1. run lint, typecheck, unit tests, and build
2. update changelog
3. tag release
4. publish package notes if `schema-core` becomes independently published
