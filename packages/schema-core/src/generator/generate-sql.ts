import type {
  SchemaColumn,
  SchemaForeignKey,
  SchemaModel,
  SchemaTable,
  TableConstraint
} from "../model/types";
import { getTableById, qualifyName } from "../model/utils";

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function buildColumnDefinition(
  column: SchemaColumn,
  table: SchemaTable
): string {
  const tokens: string[] = [column.name, column.type];

  const tablePrimaryKey = table.constraints.find(
    (constraint) =>
      constraint.kind === "primary_key" &&
      constraint.columns.length === 1 &&
      constraint.columns[0] === column.name
  );

  if (column.primaryKey || tablePrimaryKey) {
    tokens.push("PRIMARY KEY");
  }

  if (!column.nullable && !column.primaryKey) {
    tokens.push("NOT NULL");
  }

  const tableUnique = table.constraints.find(
    (constraint) =>
      constraint.kind === "unique" &&
      constraint.columns.length === 1 &&
      constraint.columns[0] === column.name
  );
  if (column.unique || tableUnique) {
    tokens.push("UNIQUE");
  }

  if (column.defaultValue) {
    tokens.push(`DEFAULT ${column.defaultValue}`);
  }

  return `  ${tokens.join(" ")}`;
}

function buildTableConstraint(
  constraint: TableConstraint
): string[] {
  if (constraint.kind === "primary_key") {
    if (constraint.columns.length === 1) {
      return [];
    }
    return [
      `  ${constraint.name ? `CONSTRAINT ${constraint.name} ` : ""}PRIMARY KEY (${constraint.columns.join(", ")})`
    ];
  }

  if (constraint.kind === "unique") {
    if (constraint.columns.length === 1) {
      return [];
    }
    return [
      `  ${constraint.name ? `CONSTRAINT ${constraint.name} ` : ""}UNIQUE (${constraint.columns.join(", ")})`
    ];
  }

  if (constraint.kind === "check") {
    return [
      `  ${constraint.name ? `CONSTRAINT ${constraint.name} ` : ""}CHECK (${constraint.expression})`
    ];
  }
  return [];
}

function buildForeignKeyConstraint(
  relationship: SchemaForeignKey,
  model: SchemaModel
): string[] {
  const sourceTable = getTableById(model, relationship.sourceTableId);
  const targetTable = getTableById(model, relationship.targetTableId);
  const sourceColumn = sourceTable?.columns.find(
    (column) => column.id === relationship.sourceColumnId
  );
  const targetColumn = targetTable?.columns.find(
    (column) => column.id === relationship.targetColumnId
  );

  if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) {
    return [];
  }

  const lines = [
    `  ${relationship.constraintName ? `CONSTRAINT ${relationship.constraintName} ` : ""}FOREIGN KEY (${sourceColumn.name}) REFERENCES ${qualifyName(targetTable.schema, targetTable.name)}(${targetColumn.name})`
  ];

  if (relationship.onDelete) {
    lines.push(`    ON DELETE ${relationship.onDelete}`);
  }

  if (relationship.onUpdate) {
    lines.push(`    ON UPDATE ${relationship.onUpdate}`);
  }

  return [lines.join("\n")];
}

function buildTable(model: SchemaModel, table: SchemaTable): string {
  const relationships = model.relationships.filter(
    (relationship) => relationship.sourceTableId === table.id
  );

  const body = [
    ...table.columns.map((column) => buildColumnDefinition(column, table)),
    ...table.constraints.flatMap((constraint) => buildTableConstraint(constraint)),
    ...relationships.flatMap((relationship) => buildForeignKeyConstraint(relationship, model))
  ].filter(Boolean);

  return `CREATE TABLE ${qualifyName(table.schema, table.name)} (\n${body.join(",\n")}\n);`;
}

function buildIndex(model: SchemaModel, indexId: string): string | undefined {
  const index = model.indexes.find((item) => item.id === indexId);
  if (!index) {
    return undefined;
  }

  const table = getTableById(model, index.tableId);
  if (!table) {
    return undefined;
  }

  const method = index.method ? ` USING ${index.method}` : "";
  const uniqueness = index.unique ? "UNIQUE " : "";
  return `CREATE ${uniqueness}INDEX ${index.name} ON ${qualifyName(table.schema, table.name)}${method} (${index.columns.join(", ")});`;
}

function escapeComment(value: string): string {
  return value.replace(/'/g, "''");
}

export function generateSchemaSql(
  model: SchemaModel,
  options: { includeUnsupportedStatements?: boolean } = {}
): string {
  const segments: string[] = [];

  for (const enumeration of model.enums) {
    const enumValues = enumeration.values.map((value) => `  ${quoteLiteral(value)}`).join(",\n");
    segments.push(
      `CREATE TYPE ${qualifyName(enumeration.schema, enumeration.name)} AS ENUM (\n${enumValues}\n);`
    );
  }

  for (const table of model.tables) {
    segments.push(buildTable(model, table));
  }

  for (const index of model.indexes) {
    const statement = buildIndex(model, index.id);
    if (statement) {
      segments.push(statement);
    }
  }

  for (const table of model.tables) {
    if (table.comment) {
      segments.push(
        `COMMENT ON TABLE ${qualifyName(table.schema, table.name)} IS '${escapeComment(table.comment)}';`
      );
    }

    for (const column of table.columns) {
      if (column.comment) {
        segments.push(
          `COMMENT ON COLUMN ${qualifyName(table.schema, table.name)}.${column.name} IS '${escapeComment(column.comment)}';`
        );
      }
    }
  }

  if (options.includeUnsupportedStatements && model.metadata.unsupportedStatements.length > 0) {
    segments.push(
      ...model.metadata.unsupportedStatements.map(
        (statement) =>
          `-- Preserved unsupported statement\n${statement.statement.replace(/;$/, "")};`
      )
    );
  }

  return segments.join("\n\n");
}
