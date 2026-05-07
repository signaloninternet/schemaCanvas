import type {
  CreateColumnInput,
  CreateEnumInput,
  CreateForeignKeyInput,
  CreateTableInput,
  SchemaColumn,
  SchemaEnum,
  SchemaForeignKey,
  SchemaModel,
  SchemaOperationResult
} from "../model/types";
import {
  cloneSchema,
  createId,
  ensureLayoutPosition,
  getColumnById,
  getTableById,
  getTableByName,
  syncColumnReferences
} from "../model/utils";
import { validateSchema } from "../validator/validate-schema";
import { createError } from "./shared";

function finalize(schema: SchemaModel): SchemaOperationResult {
  const nextSchema = syncColumnReferences(schema);
  const validation = validateSchema(nextSchema);
  return {
    schema: nextSchema,
    warnings: validation.problems.filter((problem) => problem.severity !== "error")
  };
}

export function addTable(
  schema: SchemaModel,
  input: CreateTableInput
): SchemaOperationResult {
  if (getTableByName(schema, input.name, input.schema ?? "public")) {
    throw new Error(`Table "${input.name}" already exists.`);
  }

  const nextSchema = cloneSchema(schema);
  const tableId = createId("table");
  nextSchema.tables.push({
    id: tableId,
    name: input.name,
    schema: input.schema ?? "public",
    columns: [],
    constraints: [],
    comment: input.comment
  });
  nextSchema.layout[tableId] = ensureLayoutPosition(nextSchema, tableId, input.position);
  return finalize(nextSchema);
}

export function renameTable(
  schema: SchemaModel,
  tableId: string,
  newName: string
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  const table = getTableById(nextSchema, tableId);
  if (!table) {
    throw new Error("Table not found.");
  }

  if (
    nextSchema.tables.some(
      (item) =>
        item.id !== tableId && item.name === newName && item.schema === table.schema
    )
  ) {
    throw new Error(`Table "${newName}" already exists.`);
  }

  table.name = newName;
  return finalize(nextSchema);
}

export function deleteTable(
  schema: SchemaModel,
  tableId: string
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  nextSchema.tables = nextSchema.tables.filter((table) => table.id !== tableId);
  nextSchema.relationships = nextSchema.relationships.filter(
    (relationship) =>
      relationship.sourceTableId !== tableId && relationship.targetTableId !== tableId
  );
  nextSchema.indexes = nextSchema.indexes.filter((index) => index.tableId !== tableId);
  delete nextSchema.layout[tableId];
  return finalize(nextSchema);
}

export function addColumn(
  schema: SchemaModel,
  tableId: string,
  input: CreateColumnInput
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  const table = getTableById(nextSchema, tableId);
  if (!table) {
    throw new Error("Table not found.");
  }

  if (table.columns.some((column) => column.name === input.name)) {
    throw new Error(`Column "${input.name}" already exists in "${table.name}".`);
  }

  const column: SchemaColumn = {
    id: createId("column"),
    name: input.name,
    type: input.type,
    nullable: input.nullable ?? !input.primaryKey,
    primaryKey: input.primaryKey ?? false,
    unique: input.unique ?? false,
    defaultValue: input.defaultValue,
    comment: input.comment
  };

  table.columns.push(column);
  if (column.primaryKey && !table.constraints.some((constraint) => constraint.kind === "primary_key")) {
    table.constraints.push({
      id: createId("constraint"),
      kind: "primary_key",
      columns: [column.name]
    });
  }

  return finalize(nextSchema);
}

export function updateColumn(
  schema: SchemaModel,
  tableId: string,
  columnId: string,
  patch: Partial<SchemaColumn>
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  const table = getTableById(nextSchema, tableId);
  if (!table) {
    throw new Error("Table not found.");
  }

  const column = getColumnById(table, columnId);
  if (!column) {
    throw new Error("Column not found.");
  }

  if (
    patch.name &&
    table.columns.some((candidate) => candidate.id !== columnId && candidate.name === patch.name)
  ) {
    throw new Error(`Column "${patch.name}" already exists in "${table.name}".`);
  }

  Object.assign(column, patch);

  if (column.primaryKey) {
    column.nullable = false;
  }

  table.constraints = table.constraints.filter((constraint) => {
    if (constraint.kind === "primary_key" && constraint.columns.length === 1) {
      return constraint.columns[0] !== column.name;
    }
    if (constraint.kind === "unique" && constraint.columns.length === 1) {
      return constraint.columns[0] !== column.name;
    }
    return true;
  });

  if (column.primaryKey) {
    table.constraints.push({
      id: createId("constraint"),
      kind: "primary_key",
      columns: [column.name]
    });
  }

  if (column.unique) {
    table.constraints.push({
      id: createId("constraint"),
      kind: "unique",
      columns: [column.name]
    });
  }

  return finalize(nextSchema);
}

export function deleteColumn(
  schema: SchemaModel,
  tableId: string,
  columnId: string
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  const table = getTableById(nextSchema, tableId);
  if (!table) {
    throw new Error("Table not found.");
  }

  const column = getColumnById(table, columnId);
  if (!column) {
    throw new Error("Column not found.");
  }

  table.columns = table.columns.filter((item) => item.id !== columnId);
  table.constraints = table.constraints.filter((constraint) => {
    if ("columns" in constraint) {
      return !constraint.columns.includes(column.name);
    }
    return true;
  });
  nextSchema.relationships = nextSchema.relationships.filter(
    (relationship) =>
      relationship.sourceColumnId !== columnId && relationship.targetColumnId !== columnId
  );
  nextSchema.indexes = nextSchema.indexes.filter(
    (index) => !index.columns.includes(column.name)
  );
  return finalize(nextSchema);
}

export function addForeignKey(
  schema: SchemaModel,
  input: CreateForeignKeyInput
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  const sourceTable = getTableById(nextSchema, input.sourceTableId);
  const targetTable = getTableById(nextSchema, input.targetTableId);
  if (!sourceTable || !targetTable) {
    throw new Error("Source or target table not found.");
  }

  const sourceColumn = getColumnById(sourceTable, input.sourceColumnId);
  const targetColumn = getColumnById(targetTable, input.targetColumnId);

  if (!sourceColumn || !targetColumn) {
    throw new Error("Source or target column not found.");
  }

  if (input.sourceTableId === input.targetTableId && input.sourceColumnId === input.targetColumnId) {
    throw new Error("A column cannot reference itself.");
  }

  if (
    nextSchema.relationships.some(
      (relationship) =>
        relationship.sourceTableId === input.sourceTableId &&
        relationship.sourceColumnId === input.sourceColumnId
    )
  ) {
    throw new Error("Source column already has a foreign key.");
  }

  const relationship: SchemaForeignKey = {
    id: createId("fk"),
    ...input
  };

  nextSchema.relationships.push(relationship);
  return finalize(nextSchema);
}

export function deleteForeignKey(
  schema: SchemaModel,
  foreignKeyId: string
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  nextSchema.relationships = nextSchema.relationships.filter(
    (relationship) => relationship.id !== foreignKeyId
  );
  return finalize(nextSchema);
}

export function addEnum(
  schema: SchemaModel,
  input: CreateEnumInput
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  const schemaName = input.schema ?? "public";
  if (
    nextSchema.enums.some(
      (enumeration) => enumeration.name === input.name && enumeration.schema === schemaName
    )
  ) {
    throw new Error(`Enum "${input.name}" already exists.`);
  }

  const valueSet = new Set(input.values.map((value) => value.trim()).filter(Boolean));
  if (!valueSet.size) {
    throw new Error("Enum must include at least one value.");
  }

  const enumeration: SchemaEnum = {
    id: createId("enum"),
    name: input.name,
    schema: schemaName,
    values: Array.from(valueSet)
  };

  nextSchema.enums.push(enumeration);
  return finalize(nextSchema);
}

export function updateEnum(
  schema: SchemaModel,
  enumId: string,
  patch: Partial<SchemaEnum>
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  const enumeration = nextSchema.enums.find((item) => item.id === enumId);
  if (!enumeration) {
    throw new Error("Enum not found.");
  }

  Object.assign(enumeration, patch);
  return finalize(nextSchema);
}

export function addIndex(
  schema: SchemaModel,
  input: {
    name: string;
    tableId: string;
    columns: string[];
    unique?: boolean;
    method?: string;
  }
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  if (nextSchema.indexes.some((index) => index.name === input.name)) {
    throw new Error(`Index "${input.name}" already exists.`);
  }

  const table = getTableById(nextSchema, input.tableId);
  if (!table) {
    throw new Error("Table not found.");
  }

  const missingColumn = input.columns.find(
    (columnName) => !table.columns.some((column) => column.name === columnName)
  );
  if (missingColumn) {
    throw new Error(`Column "${missingColumn}" does not exist in "${table.name}".`);
  }

  nextSchema.indexes.push({
    id: createId("index"),
    name: input.name,
    tableId: input.tableId,
    columns: input.columns,
    unique: input.unique ?? false,
    method: input.method
  });

  return finalize(nextSchema);
}

export function updateLayout(
  schema: SchemaModel,
  tableId: string,
  position: { x: number; y: number }
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  if (!getTableById(nextSchema, tableId)) {
    throw new Error("Table not found.");
  }

  nextSchema.layout[tableId] = position;
  return finalize(nextSchema);
}

export function updateViewport(
  schema: SchemaModel,
  viewport: { x: number; y: number; zoom: number }
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  nextSchema.metadata.viewport = viewport;
  return finalize(nextSchema);
}

export function updateTableComment(
  schema: SchemaModel,
  tableId: string,
  comment: string
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  const table = getTableById(nextSchema, tableId);
  if (!table) {
    throw new Error("Table not found.");
  }

  table.comment = comment.trim() || undefined;
  return finalize(nextSchema);
}

export function updateColumnComment(
  schema: SchemaModel,
  tableId: string,
  columnId: string,
  comment: string
): SchemaOperationResult {
  const nextSchema = cloneSchema(schema);
  const table = getTableById(nextSchema, tableId);
  if (!table) {
    throw new Error("Table not found.");
  }

  const column = getColumnById(table, columnId);
  if (!column) {
    throw new Error("Column not found.");
  }

  column.comment = comment.trim() || undefined;
  return finalize(nextSchema);
}

export function ensureTableAndColumn(
  schema: SchemaModel,
  tableId: string,
  columnId: string
): { tableId: string; columnId: string } {
  const table = getTableById(schema, tableId);
  if (!table) {
    throw createError("table_missing", "Selected table no longer exists.");
  }

  const column = getColumnById(table, columnId);
  if (!column) {
    throw createError("column_missing", "Selected column no longer exists.");
  }

  return { tableId: table.id, columnId: column.id };
}
