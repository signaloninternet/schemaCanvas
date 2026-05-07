import type {
  SchemaColumn,
  SchemaModel,
  SchemaTable,
  SchemaLayoutPosition
} from "./types";

export const DEFAULT_PROJECT_NAME = "SchemaCanvas Demo";

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function normalizeIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  return trimmed.replace(/;$/, "").toLowerCase();
}

export function splitQualifiedName(value: string): {
  schema: string;
  name: string;
} {
  const cleaned = value.trim().replace(/[";]/g, "");
  const parts = cleaned.split(".");
  if (parts.length === 2) {
    return {
      schema: normalizeIdentifier(parts[0] ?? "public"),
      name: normalizeIdentifier(parts[1] ?? "")
    };
  }

  return {
    schema: "public",
    name: normalizeIdentifier(parts[0] ?? "")
  };
}

export function qualifyName(schemaName: string, entityName: string): string {
  if (!schemaName || schemaName === "public") {
    return entityName;
  }

  return `${schemaName}.${entityName}`;
}

export function cloneSchema(schema: SchemaModel): SchemaModel {
  return structuredClone(schema);
}

export function createEmptySchema(
  projectName = DEFAULT_PROJECT_NAME
): SchemaModel {
  return {
    version: 1,
    dialect: "postgresql",
    tables: [],
    enums: [],
    indexes: [],
    relationships: [],
    layout: {},
    metadata: {
      projectName,
      lastUpdatedAt: new Date().toISOString(),
      unsupportedStatements: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  };
}

export function getTableById(
  schema: SchemaModel,
  tableId: string
): SchemaTable | undefined {
  return schema.tables.find((table) => table.id === tableId);
}

export function getColumnById(
  table: SchemaTable,
  columnId: string
): SchemaColumn | undefined {
  return table.columns.find((column) => column.id === columnId);
}

export function getTableByName(
  schema: SchemaModel,
  tableName: string,
  schemaName = "public"
): SchemaTable | undefined {
  return schema.tables.find(
    (table) => table.name === tableName && table.schema === schemaName
  );
}

export function getColumnByName(
  table: SchemaTable,
  columnName: string
): SchemaColumn | undefined {
  return table.columns.find((column) => column.name === columnName);
}

export function ensureLayoutPosition(
  schema: SchemaModel,
  tableId: string,
  fallback?: SchemaLayoutPosition
): SchemaLayoutPosition {
  return (
    schema.layout[tableId] ??
    fallback ?? {
      x: Object.keys(schema.layout).length * 320,
      y: 40
    }
  );
}

export function syncColumnReferences(schema: SchemaModel): SchemaModel {
  const nextSchema = cloneSchema(schema);

  for (const table of nextSchema.tables) {
    for (const column of table.columns) {
      column.references = undefined;
    }
  }

  for (const relationship of nextSchema.relationships) {
    const table = getTableById(nextSchema, relationship.sourceTableId);
    if (!table) {
      continue;
    }

    const column = getColumnById(table, relationship.sourceColumnId);
    if (!column) {
      continue;
    }

    column.references = {
      tableId: relationship.targetTableId,
      columnId: relationship.targetColumnId
    };
  }

  nextSchema.metadata.lastUpdatedAt = new Date().toISOString();
  return nextSchema;
}

export function reorderSchema(schema: SchemaModel): SchemaModel {
  const nextSchema = cloneSchema(schema);

  nextSchema.enums.sort((left, right) => left.name.localeCompare(right.name));
  nextSchema.tables.sort((left, right) => left.name.localeCompare(right.name));
  nextSchema.indexes.sort((left, right) => left.name.localeCompare(right.name));
  nextSchema.relationships.sort((left, right) => left.id.localeCompare(right.id));

  for (const table of nextSchema.tables) {
    table.columns.sort((left, right) => left.name.localeCompare(right.name));
    table.constraints.sort((left, right) => left.id.localeCompare(right.id));
  }

  return nextSchema;
}

export function formatConstraintColumns(columns: string[]): string {
  return columns.join(", ");
}

export function isPluralWord(word: string): boolean {
  return word.endsWith("s");
}
