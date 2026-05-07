import type {
  SchemaColumn,
  SchemaForeignKey,
  SchemaModel,
  SchemaProblem,
  SchemaTable
} from "../model/types";
import {
  cloneSchema,
  createEmptySchema,
  createId,
  getTableByName,
  normalizeIdentifier,
  splitQualifiedName,
  syncColumnReferences
} from "../model/utils";
import { createError, createWarning } from "../operations/shared";

export interface SqlStatement {
  statement: string;
  line: number;
}

export function splitSqlStatements(sql: string): SqlStatement[] {
  const statements: SqlStatement[] = [];
  let current = "";
  let quote: "'" | '"' | "$" | null = null;
  let dollarTag = "";
  let depth = 0;
  let line = 1;
  let startLine = 1;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index] ?? "";
    const nextTwo = sql.slice(index, index + 2);

    if (nextTwo === "--" && !quote) {
      const endOfLine = sql.indexOf("\n", index);
      const comment = endOfLine === -1 ? sql.slice(index) : sql.slice(index, endOfLine);
      current += comment;
      index += comment.length - 1;
      continue;
    }

    if (!quote && character === "$") {
      const remainder = sql.slice(index);
      const match = remainder.match(/^\$[A-Za-z_0-9]*\$/);
      if (match) {
        const tag = match[0];
        if (quote === "$" && dollarTag === tag) {
          quote = null;
          dollarTag = "";
        } else if (!quote) {
          quote = "$";
          dollarTag = tag;
        }
        current += tag;
        index += tag.length - 1;
        continue;
      }
    }

    if (!quote && (character === "'" || character === '"')) {
      quote = character;
      current += character;
      continue;
    }

    if (quote === character && sql[index - 1] !== "\\") {
      quote = null;
      current += character;
      continue;
    }

    if (!quote) {
      if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth = Math.max(0, depth - 1);
      } else if (character === ";" && depth === 0) {
        if (current.trim()) {
          statements.push({
            statement: current.trim(),
            line: startLine
          });
        }
        current = "";
        startLine = line;
        continue;
      }
    }

    current += character;
    if (character === "\n") {
      line += 1;
      if (!current.trim()) {
        startLine = line;
      }
    }
  }

  if (current.trim()) {
    statements.push({
      statement: current.trim(),
      line: startLine
    });
  }

  return statements;
}

export function splitTopLevelComma(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let depth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] ?? "";
    if ((character === "'" || character === '"') && input[index - 1] !== "\\") {
      if (quote === character) {
        quote = null;
      } else if (!quote) {
        quote = character;
      }
    }

    if (!quote) {
      if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth = Math.max(0, depth - 1);
      } else if (character === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
    }

    current += character;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

export function tokenizeTopLevel(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let depth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] ?? "";
    if ((character === "'" || character === '"') && input[index - 1] !== "\\") {
      if (quote === character) {
        quote = null;
      } else if (!quote) {
        quote = character;
      }
    }

    if (!quote) {
      if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth = Math.max(0, depth - 1);
      } else if (/\s/.test(character) && depth === 0) {
        if (current) {
          tokens.push(current);
          current = "";
        }
        continue;
      }
    }

    current += character;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

export function parsePostgresStringArray(input: string): string[] {
  return splitTopLevelComma(input)
    .map((item) => item.trim())
    .map((item) => item.replace(/^'/, "").replace(/'$/, "").replace(/''/g, "'"))
    .filter(Boolean);
}

export function parseColumnList(input: string): string[] {
  const list = input.trim().replace(/^\(/, "").replace(/\)$/, "");
  return splitTopLevelComma(list).map((item) => normalizeIdentifier(item));
}

export function mergeWithPreviousLayout(
  parsedSchema: SchemaModel,
  previousSchema?: SchemaModel
): SchemaModel {
  if (!previousSchema) {
    return parsedSchema;
  }

  const nextSchema = cloneSchema(parsedSchema);
  for (const table of nextSchema.tables) {
    const previousTable = getTableByName(previousSchema, table.name, table.schema);
    if (!previousTable) {
      continue;
    }

    table.id = previousTable.id;
    nextSchema.layout[table.id] = previousSchema.layout[previousTable.id] ?? { x: 0, y: 0 };

    for (const column of table.columns) {
      const previousColumn = previousTable.columns.find(
        (candidate) => candidate.name === column.name
      );
      if (previousColumn) {
        column.id = previousColumn.id;
      }
    }
  }

  for (const relationship of nextSchema.relationships) {
    const sourceTable = nextSchema.tables.find((table) => table.id === relationship.sourceTableId);
    const targetTable = nextSchema.tables.find((table) => table.id === relationship.targetTableId);
    if (!sourceTable || !targetTable) {
      continue;
    }

    const previousMatch = previousSchema.relationships.find((candidate) => {
      const previousSourceTable = previousSchema.tables.find(
        (table) => table.id === candidate.sourceTableId
      );
      const previousTargetTable = previousSchema.tables.find(
        (table) => table.id === candidate.targetTableId
      );
      if (!previousSourceTable || !previousTargetTable) {
        return false;
      }

      const previousSourceColumn = previousSourceTable.columns.find(
        (column) => column.id === candidate.sourceColumnId
      );
      const previousTargetColumn = previousTargetTable.columns.find(
        (column) => column.id === candidate.targetColumnId
      );

      const nextSourceColumn = sourceTable.columns.find(
        (column) => column.id === relationship.sourceColumnId
      );
      const nextTargetColumn = targetTable.columns.find(
        (column) => column.id === relationship.targetColumnId
      );

      return (
        previousSourceTable.name === sourceTable.name &&
        previousTargetTable.name === targetTable.name &&
        previousSourceColumn?.name === nextSourceColumn?.name &&
        previousTargetColumn?.name === nextTargetColumn?.name
      );
    });

    if (previousMatch) {
      relationship.id = previousMatch.id;
    }
  }

  return syncColumnReferences(nextSchema);
}

export function resolveTable(
  schema: SchemaModel,
  tableName: string
): SchemaTable | undefined {
  const { schema: schemaName, name } = splitQualifiedName(tableName);
  return schema.tables.find(
    (table) => table.schema === schemaName && table.name === normalizeIdentifier(name)
  );
}

export function resolveColumn(
  table: SchemaTable,
  columnName: string
): SchemaColumn | undefined {
  return table.columns.find((column) => column.name === normalizeIdentifier(columnName));
}

export function createParseError(
  message: string,
  line: number,
  statement: string
): SchemaProblem {
  return createError("parse_error", message, {
    line,
    column: 1,
    statement
  });
}

export function createUnsupportedWarning(
  statement: string,
  reason: string
): SchemaProblem {
  return createWarning("unsupported_statement", reason, { statement });
}

export function createWorkingSchema(projectName?: string): SchemaModel {
  return createEmptySchema(projectName);
}

export function parseReferenceTarget(
  token: string
): { tableName: string; columnName: string } | null {
  const cleaned = token.trim();
  const match = cleaned.match(/^([A-Za-z0-9_."-]+)\s*\(([^)]+)\)$/);
  if (!match) {
    return null;
  }

  return {
    tableName: match[1] ?? "",
    columnName: normalizeIdentifier(match[2] ?? "")
  };
}

export function extractTrailingAction(
  tokens: string[],
  keyword: "DELETE" | "UPDATE"
): string | undefined {
  const index = tokens.findIndex(
    (token, tokenIndex) =>
      token.toUpperCase() === "ON" &&
      tokens[tokenIndex + 1]?.toUpperCase() === keyword
  );
  if (index === -1) {
    return undefined;
  }

  return tokens[index + 2]?.toUpperCase();
}

export function resolveTableAndColumn(
  schema: SchemaModel,
  tableName: string,
  columnName: string,
  contextStatement: string,
  line: number
): { table: SchemaTable; column: SchemaColumn } | SchemaProblem {
  const table = resolveTable(schema, tableName);
  if (!table) {
    return createParseError(
      `Referenced table "${tableName}" was not found.`,
      line,
      contextStatement
    );
  }

  const column = resolveColumn(table, columnName);
  if (!column) {
    return createParseError(
      `Referenced column "${columnName}" was not found on "${tableName}".`,
      line,
      contextStatement
    );
  }

  return { table, column };
}

export function createRelationship(
  schema: SchemaModel,
  sourceTable: SchemaTable,
  sourceColumn: SchemaColumn,
  targetTableName: string,
  targetColumnName: string,
  line: number,
  statement: string,
  constraintName?: string,
  onDelete?: string,
  onUpdate?: string
): SchemaForeignKey | SchemaProblem {
  const target = resolveTableAndColumn(
    schema,
    targetTableName,
    targetColumnName,
    statement,
    line
  );
  if ("severity" in target) {
    return target;
  }

  return {
    id: createId("fk"),
    sourceTableId: sourceTable.id,
    sourceColumnId: sourceColumn.id,
    targetTableId: target.table.id,
    targetColumnId: target.column.id,
    onDelete,
    onUpdate,
    constraintName
  };
}
