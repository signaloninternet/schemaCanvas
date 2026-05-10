import type { SchemaModel } from "../model/types";
import { getTableById, qualifyName } from "../model/utils";
import { generateSchemaSql } from "../generator/generate-sql";

function warning(message: string): string {
  return `-- WARNING: ${message}`;
}

function parseTypeLimit(type: string): number | undefined {
  const match = type.match(/\((\d+)/);
  return match ? Number(match[1]) : undefined;
}

function isPotentiallyDestructiveTypeChange(
  previousType: string,
  nextType: string,
): boolean {
  const previous = previousType.trim().toUpperCase();
  const next = nextType.trim().toUpperCase();

  if (previous === next) {
    return false;
  }

  if (
    (previous === "TEXT" || previous.startsWith("VARCHAR")) &&
    next.startsWith("VARCHAR")
  ) {
    const previousLimit = parseTypeLimit(previous);
    const nextLimit = parseTypeLimit(next);
    return (
      previous === "TEXT" ||
      Boolean(previousLimit && nextLimit && nextLimit < previousLimit)
    );
  }

  if (
    ["BIGINT", "NUMERIC", "DECIMAL", "DOUBLE PRECISION"].includes(previous) &&
    ["INTEGER", "INT", "SMALLINT"].includes(next)
  ) {
    return true;
  }

  const previousNumericLimit = parseTypeLimit(previous);
  const nextNumericLimit = parseTypeLimit(next);
  return Boolean(
    previousNumericLimit &&
    nextNumericLimit &&
    nextNumericLimit < previousNumericLimit,
  );
}

function findMatchingTable(
  schema: SchemaModel,
  table: SchemaModel["tables"][number],
): SchemaModel["tables"][number] | undefined {
  return (
    schema.tables.find((candidate) => candidate.id === table.id) ??
    schema.tables.find(
      (candidate) =>
        candidate.schema === table.schema && candidate.name === table.name,
    )
  );
}

function findMatchingColumn(
  table: SchemaModel["tables"][number],
  column: SchemaModel["tables"][number]["columns"][number],
): SchemaModel["tables"][number]["columns"][number] | undefined {
  return (
    table.columns.find((candidate) => candidate.id === column.id) ??
    table.columns.find((candidate) => candidate.name === column.name)
  );
}

function findMatchingEnum(
  previous: SchemaModel,
  enumeration: SchemaModel["enums"][number],
): SchemaModel["enums"][number] | undefined {
  return (
    previous.enums.find((candidate) => candidate.id === enumeration.id) ??
    previous.enums.find(
      (candidate) =>
        candidate.schema === enumeration.schema &&
        candidate.name === enumeration.name,
    )
  );
}

function relationshipSignature(
  schema: SchemaModel,
  relationship: SchemaModel["relationships"][number],
): string | undefined {
  const sourceTable = getTableById(schema, relationship.sourceTableId);
  const targetTable = getTableById(schema, relationship.targetTableId);
  const sourceColumn = sourceTable?.columns.find(
    (column) => column.id === relationship.sourceColumnId,
  );
  const targetColumn = targetTable?.columns.find(
    (column) => column.id === relationship.targetColumnId,
  );

  if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) {
    return undefined;
  }

  return [
    qualifyName(sourceTable.schema, sourceTable.name),
    sourceColumn.name,
    qualifyName(targetTable.schema, targetTable.name),
    targetColumn.name,
    relationship.onDelete ?? "",
    relationship.onUpdate ?? "",
  ].join("|");
}

function hasMatchingRelationship(
  previous: SchemaModel,
  next: SchemaModel,
  relationship: SchemaModel["relationships"][number],
): boolean {
  if (
    previous.relationships.some((candidate) => candidate.id === relationship.id)
  ) {
    return true;
  }

  const nextSignature = relationshipSignature(next, relationship);
  if (!nextSignature) {
    return false;
  }

  return previous.relationships.some(
    (candidate) => relationshipSignature(previous, candidate) === nextSignature,
  );
}

function diffColumns(previous: SchemaModel, next: SchemaModel): string[] {
  const statements: string[] = [];

  for (const table of next.tables) {
    const previousTable = findMatchingTable(previous, table);
    if (!previousTable) {
      continue;
    }

    for (const column of table.columns) {
      const previousColumn = findMatchingColumn(previousTable, column);
      if (!previousColumn) {
        statements.push(
          `ALTER TABLE ${qualifyName(table.schema, table.name)} ADD COLUMN ${column.name} ${column.type}${column.nullable ? "" : " NOT NULL"}${column.defaultValue ? ` DEFAULT ${column.defaultValue}` : ""};`,
        );
        continue;
      }

      if (previousColumn.name !== column.name) {
        statements.push(
          `ALTER TABLE ${qualifyName(table.schema, table.name)} RENAME COLUMN ${previousColumn.name} TO ${column.name};`,
        );
      }

      if (previousColumn.type !== column.type) {
        if (
          isPotentiallyDestructiveTypeChange(previousColumn.type, column.type)
        ) {
          statements.push(
            warning(
              `Changing ${qualifyName(table.schema, table.name)}.${column.name} from ${previousColumn.type} to ${column.type} may truncate or reject existing data.`,
            ),
          );
        }
        statements.push(
          `ALTER TABLE ${qualifyName(table.schema, table.name)} ALTER COLUMN ${column.name} TYPE ${column.type};`,
        );
      }

      if (previousColumn.nullable !== column.nullable) {
        if (!column.nullable) {
          statements.push(
            warning(
              `Setting ${qualifyName(table.schema, table.name)}.${column.name} NOT NULL can fail if existing rows contain nulls.`,
            ),
          );
        }
        statements.push(
          `ALTER TABLE ${qualifyName(table.schema, table.name)} ALTER COLUMN ${column.name} ${column.nullable ? "DROP" : "SET"} NOT NULL;`,
        );
      }

      if (previousColumn.defaultValue !== column.defaultValue) {
        statements.push(
          `ALTER TABLE ${qualifyName(table.schema, table.name)} ALTER COLUMN ${column.name} ${column.defaultValue ? `SET DEFAULT ${column.defaultValue}` : "DROP DEFAULT"};`,
        );
      }
    }

    for (const previousColumn of previousTable.columns) {
      if (
        !table.columns.some(
          (candidate) =>
            candidate.id === previousColumn.id ||
            candidate.name === previousColumn.name,
        )
      ) {
        const dependentRelationships = previous.relationships.filter(
          (relationship) =>
            relationship.sourceColumnId === previousColumn.id ||
            relationship.targetColumnId === previousColumn.id,
        );
        const dependentIndexes = previous.indexes.filter(
          (index) =>
            index.tableId === previousTable.id &&
            index.columns.includes(previousColumn.name),
        );
        if (dependentRelationships.length > 0 || dependentIndexes.length > 0) {
          statements.push(
            warning(
              `Dropping ${qualifyName(previousTable.schema, previousTable.name)}.${previousColumn.name} affects ${dependentRelationships.length} foreign key dependency/dependencies and ${dependentIndexes.length} index(es).`,
            ),
          );
        } else {
          statements.push(
            warning(
              `Dropping ${qualifyName(previousTable.schema, previousTable.name)}.${previousColumn.name} permanently removes stored data.`,
            ),
          );
        }
        statements.push(
          `ALTER TABLE ${qualifyName(table.schema, table.name)} DROP COLUMN ${previousColumn.name};`,
        );
      }
    }
  }

  return statements;
}

function diffTables(previous: SchemaModel, next: SchemaModel): string[] {
  const statements: string[] = [];
  for (const table of next.tables) {
    const previousTable = findMatchingTable(previous, table);
    if (!previousTable) {
      statements.push(
        generateSchemaSql({
          ...next,
          tables: [table],
          enums: [],
          indexes: [],
          relationships: next.relationships.filter(
            (relationship) => relationship.sourceTableId === table.id,
          ),
        }),
      );
      continue;
    }

    if (
      previousTable.name !== table.name ||
      previousTable.schema !== table.schema
    ) {
      if (previousTable.schema !== table.schema) {
        statements.push(
          warning(
            `Schema changes for existing tables are not fully automated; review ${qualifyName(previousTable.schema, previousTable.name)} manually.`,
          ),
        );
      }
      statements.push(
        `ALTER TABLE ${qualifyName(previousTable.schema, previousTable.name)} RENAME TO ${table.name};`,
      );
    }
  }

  for (const table of previous.tables) {
    if (findMatchingTable(next, table)) {
      continue;
    }

    const dependentRelationships = previous.relationships.filter(
      (relationship) =>
        relationship.sourceTableId === table.id ||
        relationship.targetTableId === table.id,
    );
    if (dependentRelationships.length > 0) {
      statements.push(
        warning(
          `Dropping ${qualifyName(table.schema, table.name)} removes ${dependentRelationships.length} foreign key dependency/dependencies.`,
        ),
      );
    } else {
      statements.push(
        warning(
          `Dropping ${qualifyName(table.schema, table.name)} permanently removes the table and its data.`,
        ),
      );
    }
    statements.push(`DROP TABLE ${qualifyName(table.schema, table.name)};`);
  }

  return statements;
}

function diffEnums(previous: SchemaModel, next: SchemaModel): string[] {
  const statements: string[] = [];
  for (const enumeration of next.enums) {
    const previousEnum = findMatchingEnum(previous, enumeration);
    if (!previousEnum) {
      statements.push(
        `CREATE TYPE ${qualifyName(enumeration.schema, enumeration.name)} AS ENUM (${enumeration.values.map((value) => `'${value}'`).join(", ")});`,
      );
      continue;
    }

    for (const value of enumeration.values) {
      if (!previousEnum.values.includes(value)) {
        statements.push(
          `ALTER TYPE ${qualifyName(enumeration.schema, enumeration.name)} ADD VALUE IF NOT EXISTS '${value}';`,
        );
      }
    }
  }

  return statements;
}

function diffRelationships(previous: SchemaModel, next: SchemaModel): string[] {
  const statements: string[] = [];
  for (const relationship of next.relationships) {
    if (hasMatchingRelationship(previous, next, relationship)) {
      continue;
    }

    const sourceTable = getTableById(next, relationship.sourceTableId);
    const targetTable = getTableById(next, relationship.targetTableId);
    const sourceColumn = sourceTable?.columns.find(
      (column) => column.id === relationship.sourceColumnId,
    );
    const targetColumn = targetTable?.columns.find(
      (column) => column.id === relationship.targetColumnId,
    );
    if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) {
      continue;
    }

    const constraintPrefix = relationship.constraintName
      ? `ADD CONSTRAINT ${relationship.constraintName} `
      : "ADD ";
    const actions = [
      relationship.onDelete ? `ON DELETE ${relationship.onDelete}` : undefined,
      relationship.onUpdate ? `ON UPDATE ${relationship.onUpdate}` : undefined,
    ]
      .filter(Boolean)
      .join(" ");

    statements.push(
      `ALTER TABLE ${qualifyName(sourceTable.schema, sourceTable.name)} ${constraintPrefix}FOREIGN KEY (${sourceColumn.name}) REFERENCES ${qualifyName(targetTable.schema, targetTable.name)}(${targetColumn.name})${actions ? ` ${actions}` : ""};`,
    );
  }

  for (const relationship of previous.relationships) {
    if (hasMatchingRelationship(next, previous, relationship)) {
      continue;
    }

    const sourceTable = getTableById(previous, relationship.sourceTableId);
    if (!sourceTable || !relationship.constraintName) {
      continue;
    }

    statements.push(
      `ALTER TABLE ${qualifyName(sourceTable.schema, sourceTable.name)} DROP CONSTRAINT ${relationship.constraintName};`,
    );
  }

  return statements;
}

export function generateMigrationPreview(
  previous: SchemaModel | null,
  next: SchemaModel,
): string {
  if (!previous) {
    return generateSchemaSql(next, { includeUnsupportedStatements: true });
  }

  const statements = [
    ...diffEnums(previous, next),
    ...diffTables(previous, next),
    ...diffColumns(previous, next),
    ...diffRelationships(previous, next),
  ].filter(Boolean);

  if (!statements.length) {
    return "-- No schema changes detected.";
  }

  return statements.join("\n\n");
}
