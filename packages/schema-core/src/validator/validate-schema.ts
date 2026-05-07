import type { SchemaModel, SchemaProblem, SchemaTable } from "../model/types";
import { createId, getTableById, isPluralWord } from "../model/utils";

function warning(
  code: string,
  message: string,
  location?: SchemaProblem["location"]
): SchemaProblem {
  return {
    id: createId("warning"),
    severity: "warning",
    code,
    message,
    location
  };
}

function detectCircularReferences(schema: SchemaModel): SchemaProblem[] {
  const adjacency = new Map<string, string[]>();
  for (const relationship of schema.relationships) {
    const list = adjacency.get(relationship.sourceTableId) ?? [];
    list.push(relationship.targetTableId);
    adjacency.set(relationship.sourceTableId, list);
  }

  const seen = new Set<string>();
  const active = new Set<string>();
  const problems: SchemaProblem[] = [];

  function visit(tableId: string): void {
    if (active.has(tableId)) {
      problems.push(
        warning("circular_reference", "Circular table references detected.", {
          tableId
        })
      );
      return;
    }

    if (seen.has(tableId)) {
      return;
    }

    seen.add(tableId);
    active.add(tableId);
    for (const target of adjacency.get(tableId) ?? []) {
      visit(target);
    }
    active.delete(tableId);
  }

  for (const table of schema.tables) {
    visit(table.id);
  }

  return problems;
}

function validateTable(table: SchemaTable): SchemaProblem[] {
  const problems: SchemaProblem[] = [];
  const hasPrimaryKey = table.columns.some((column) => column.primaryKey);
  if (!hasPrimaryKey) {
    problems.push(
      warning("missing_primary_key", `Table "${table.name}" has no primary key.`, {
        tableId: table.id
      })
    );
  }

  const hasCreatedAt = table.columns.some((column) => column.name === "created_at");
  const hasUpdatedAt = table.columns.some((column) => column.name === "updated_at");
  if ((table.name.includes("order") || table.name.includes("payment") || table.name.includes("ticket")) && (!hasCreatedAt || !hasUpdatedAt)) {
    problems.push(
      warning(
        "missing_timestamps",
        `Table "${table.name}" looks transactional and may benefit from created_at and updated_at columns.`,
        { tableId: table.id }
      )
    );
  }

  if (!isPluralWord(table.name)) {
    problems.push(
      warning(
        "naming_consistency",
        `Table "${table.name}" is singular. Consider using plural table names consistently.`,
        { tableId: table.id }
      )
    );
  }

  const nullableCount = table.columns.filter((column) => column.nullable).length;
  if (table.columns.length > 4 && nullableCount / table.columns.length > 0.65) {
    problems.push(
      warning(
        "nullable_density",
        `Table "${table.name}" has many nullable columns. Review whether required fields should be constrained.`,
        { tableId: table.id }
      )
    );
  }

  for (const column of table.columns) {
    if (
      column.name.endsWith("_id") &&
      !column.primaryKey &&
      !column.references &&
      table.columns.length > 1
    ) {
      problems.push(
        warning(
          "possible_missing_foreign_key",
          `Column "${table.name}.${column.name}" looks like a foreign key but has no relationship.`,
          { tableId: table.id, columnId: column.id }
        )
      );
    }

    if (
      (column.name.includes("amount") || column.name.includes("price")) &&
      /float|double/i.test(column.type)
    ) {
      problems.push(
        warning(
          "money_float",
          `Column "${table.name}.${column.name}" should generally use NUMERIC instead of floating-point types.`,
          { tableId: table.id, columnId: column.id }
        )
      );
    }

    if (column.name === "status" && !schemaHasEnumType(column.type)) {
      problems.push(
        warning(
          "status_enum",
          `Column "${table.name}.${column.name}" may be a better fit for an enum.`,
          { tableId: table.id, columnId: column.id }
        )
      );
    }
  }

  return problems;
}

function schemaHasEnumType(type: string): boolean {
  return /^[a-z_][a-z0-9_]*$/i.test(type) && !/text|varchar|char/i.test(type);
}

export function validateSchema(schema: SchemaModel): { problems: SchemaProblem[] } {
  const problems: SchemaProblem[] = [];

  for (const table of schema.tables) {
    problems.push(...validateTable(table));
  }

  for (const relationship of schema.relationships) {
    const sourceTable = getTableById(schema, relationship.sourceTableId);
    const targetTable = getTableById(schema, relationship.targetTableId);
    const sourceColumn = sourceTable?.columns.find(
      (column) => column.id === relationship.sourceColumnId
    );
    const targetColumn = targetTable?.columns.find(
      (column) => column.id === relationship.targetColumnId
    );

    if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) {
      problems.push(
        warning("orphan_foreign_key", "Foreign key points to a missing table or column.")
      );
      continue;
    }

    if (sourceColumn.type !== targetColumn.type) {
      problems.push(
        warning(
          "foreign_key_type_mismatch",
          `Foreign key "${sourceTable.name}.${sourceColumn.name}" does not match referenced type "${targetTable.name}.${targetColumn.name}".`,
          {
            tableId: sourceTable.id,
            columnId: sourceColumn.id
          }
        )
      );
    }
  }

  const seenIndexes = new Set<string>();
  for (const index of schema.indexes) {
    const key = `${index.tableId}:${index.columns.join(",")}:${index.unique}`;
    if (seenIndexes.has(key)) {
      problems.push(
        warning("duplicate_index", `Index "${index.name}" duplicates another index.`)
      );
    }
    seenIndexes.add(key);
  }

  problems.push(...detectCircularReferences(schema));
  return { problems };
}
