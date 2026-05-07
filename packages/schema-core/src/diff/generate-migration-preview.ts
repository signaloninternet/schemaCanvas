import type { SchemaModel } from "../model/types";
import { getTableById, qualifyName } from "../model/utils";
import { generateSchemaSql } from "../generator/generate-sql";

function diffColumns(previous: SchemaModel, next: SchemaModel): string[] {
  const statements: string[] = [];

  for (const table of next.tables) {
    const previousTable = previous.tables.find((candidate) => candidate.id === table.id);
    if (!previousTable) {
      continue;
    }

    for (const column of table.columns) {
      const previousColumn = previousTable.columns.find(
        (candidate) => candidate.id === column.id
      );
      if (!previousColumn) {
        statements.push(
          `ALTER TABLE ${qualifyName(table.schema, table.name)} ADD COLUMN ${column.name} ${column.type}${column.nullable ? "" : " NOT NULL"}${column.defaultValue ? ` DEFAULT ${column.defaultValue}` : ""};`
        );
        continue;
      }

      if (previousColumn.type !== column.type) {
        statements.push(
          `ALTER TABLE ${qualifyName(table.schema, table.name)} ALTER COLUMN ${column.name} TYPE ${column.type};`
        );
      }

      if (previousColumn.nullable !== column.nullable) {
        statements.push(
          `ALTER TABLE ${qualifyName(table.schema, table.name)} ALTER COLUMN ${column.name} ${column.nullable ? "DROP" : "SET"} NOT NULL;`
        );
      }

      if (previousColumn.defaultValue !== column.defaultValue) {
        statements.push(
          `ALTER TABLE ${qualifyName(table.schema, table.name)} ALTER COLUMN ${column.name} ${column.defaultValue ? `SET DEFAULT ${column.defaultValue}` : "DROP DEFAULT"};`
        );
      }
    }

    for (const previousColumn of previousTable.columns) {
      if (!table.columns.some((candidate) => candidate.id === previousColumn.id)) {
        statements.push(
          `ALTER TABLE ${qualifyName(table.schema, table.name)} DROP COLUMN ${previousColumn.name};`
        );
      }
    }
  }

  return statements;
}

function diffTables(previous: SchemaModel, next: SchemaModel): string[] {
  const statements: string[] = [];
  for (const table of next.tables) {
    const previousTable = previous.tables.find((candidate) => candidate.id === table.id);
    if (!previousTable) {
      statements.push(
        generateSchemaSql({
          ...next,
          tables: [table],
          enums: [],
          indexes: [],
          relationships: next.relationships.filter(
            (relationship) => relationship.sourceTableId === table.id
          )
        })
      );
    }
  }

  for (const table of previous.tables) {
    if (!next.tables.some((candidate) => candidate.id === table.id)) {
      statements.push(`DROP TABLE ${qualifyName(table.schema, table.name)};`);
    }
  }

  return statements;
}

function diffEnums(previous: SchemaModel, next: SchemaModel): string[] {
  const statements: string[] = [];
  for (const enumeration of next.enums) {
    const previousEnum = previous.enums.find((candidate) => candidate.id === enumeration.id);
    if (!previousEnum) {
      statements.push(
        `CREATE TYPE ${qualifyName(enumeration.schema, enumeration.name)} AS ENUM (${enumeration.values.map((value) => `'${value}'`).join(", ")});`
      );
      continue;
    }

    for (const value of enumeration.values) {
      if (!previousEnum.values.includes(value)) {
        statements.push(
          `ALTER TYPE ${qualifyName(enumeration.schema, enumeration.name)} ADD VALUE IF NOT EXISTS '${value}';`
        );
      }
    }
  }

  return statements;
}

function diffRelationships(previous: SchemaModel, next: SchemaModel): string[] {
  const statements: string[] = [];
  for (const relationship of next.relationships) {
    if (previous.relationships.some((candidate) => candidate.id === relationship.id)) {
      continue;
    }

    const sourceTable = getTableById(next, relationship.sourceTableId);
    const targetTable = getTableById(next, relationship.targetTableId);
    const sourceColumn = sourceTable?.columns.find(
      (column) => column.id === relationship.sourceColumnId
    );
    const targetColumn = targetTable?.columns.find(
      (column) => column.id === relationship.targetColumnId
    );
    if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) {
      continue;
    }

    const constraintPrefix = relationship.constraintName
      ? `ADD CONSTRAINT ${relationship.constraintName} `
      : "ADD ";
    const actions = [
      relationship.onDelete ? `ON DELETE ${relationship.onDelete}` : undefined,
      relationship.onUpdate ? `ON UPDATE ${relationship.onUpdate}` : undefined
    ]
      .filter(Boolean)
      .join(" ");

    statements.push(
      `ALTER TABLE ${qualifyName(sourceTable.schema, sourceTable.name)} ${constraintPrefix}FOREIGN KEY (${sourceColumn.name}) REFERENCES ${qualifyName(targetTable.schema, targetTable.name)}(${targetColumn.name})${actions ? ` ${actions}` : ""};`
    );
  }

  for (const relationship of previous.relationships) {
    if (next.relationships.some((candidate) => candidate.id === relationship.id)) {
      continue;
    }

    const sourceTable = getTableById(previous, relationship.sourceTableId);
    if (!sourceTable || !relationship.constraintName) {
      continue;
    }

    statements.push(
      `ALTER TABLE ${qualifyName(sourceTable.schema, sourceTable.name)} DROP CONSTRAINT ${relationship.constraintName};`
    );
  }

  return statements;
}

export function generateMigrationPreview(
  previous: SchemaModel | null,
  next: SchemaModel
): string {
  if (!previous) {
    return generateSchemaSql(next, { includeUnsupportedStatements: true });
  }

  const statements = [
    ...diffEnums(previous, next),
    ...diffTables(previous, next),
    ...diffColumns(previous, next),
    ...diffRelationships(previous, next)
  ].filter(Boolean);

  if (!statements.length) {
    return "-- No schema changes detected.";
  }

  return statements.join("\n\n");
}
