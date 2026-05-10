import type { SchemaModel } from "@schemacanvas/schema-core";

export interface SuggestedFK {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
}

export function inferSuggestedFKs(schema: SchemaModel): SuggestedFK[] {
  const declared = new Set<string>();
  for (const rel of schema.relationships) {
    declared.add(`${rel.sourceTableId}::${rel.sourceColumnId}`);
  }

  const tablesByName = new Map<string, (typeof schema.tables)[number]>();
  for (const table of schema.tables) {
    tablesByName.set(table.name, table);
  }

  const suggestions: SuggestedFK[] = [];
  for (const table of schema.tables) {
    for (const column of table.columns) {
      if (!column.name.endsWith("_id") || column.name === "id") {
        continue;
      }
      if (declared.has(`${table.id}::${column.id}`)) {
        continue;
      }

      const prefix = column.name.slice(0, -3);
      const candidate =
        tablesByName.get(`${prefix}s`) ?? tablesByName.get(prefix);
      if (!candidate || candidate.id === table.id) {
        continue;
      }

      const pk = candidate.columns.find((col) => col.primaryKey);
      if (!pk) {
        continue;
      }

      suggestions.push({
        id: `suggested-${table.id}-${column.id}`,
        sourceTableId: table.id,
        sourceColumnId: column.id,
        targetTableId: candidate.id,
        targetColumnId: pk.id
      });
    }
  }
  return suggestions;
}
