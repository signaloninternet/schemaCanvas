import type { SchemaModel } from "../model/types";
import { getTableById, qualifyName } from "../model/utils";

function renderConstraintSummary(
  schema: SchemaModel,
  tableId: string,
  columnId: string
): string {
  const table = getTableById(schema, tableId);
  const column = table?.columns.find((item) => item.id === columnId);
  if (!table || !column) {
    return "";
  }

  const items: string[] = [];
  if (column.primaryKey) {
    items.push("PRIMARY KEY");
  }
  if (!column.nullable) {
    items.push("NOT NULL");
  }
  if (column.unique) {
    items.push("UNIQUE");
  }
  if (column.defaultValue) {
    items.push(`DEFAULT ${column.defaultValue}`);
  }
  if (column.references) {
    const targetTable = getTableById(schema, column.references.tableId);
    const targetColumn = targetTable?.columns.find(
      (item) => item.id === column.references?.columnId
    );
    if (targetTable && targetColumn) {
      items.push(`FK -> ${qualifyName(targetTable.schema, targetTable.name)}.${targetColumn.name}`);
    }
  }

  return items.join(", ");
}

export function generateMarkdownDocs(schema: SchemaModel): string {
  const sections: string[] = ["# Database Schema Documentation"];

  for (const table of schema.tables) {
    sections.push(`## ${qualifyName(table.schema, table.name)}`);
    sections.push(table.comment?.trim() || "No description yet.");
    sections.push("### Columns");
    sections.push("| Column | Type | Constraints | Description |");
    sections.push("|---|---|---|---|");

    for (const column of table.columns) {
      sections.push(
        `| ${column.name} | ${column.type} | ${renderConstraintSummary(schema, table.id, column.id)} | ${column.comment?.replace(/\n/g, " ") ?? ""} |`
      );
    }
  }

  if (schema.enums.length > 0) {
    sections.push("## Enums");
    for (const enumeration of schema.enums) {
      sections.push(`### ${qualifyName(enumeration.schema, enumeration.name)}`);
      sections.push(enumeration.values.map((value) => `- ${value}`).join("\n"));
    }
  }

  return sections.join("\n\n");
}
