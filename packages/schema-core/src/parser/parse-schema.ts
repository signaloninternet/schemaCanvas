import type {
  ParseSchemaOptions,
  ParseSchemaResult,
  SchemaColumn,
  SchemaProblem,
  SchemaTable,
  TableConstraint
} from "../model/types";
import {
  createId,
  normalizeIdentifier,
  splitQualifiedName,
  syncColumnReferences
} from "../model/utils";
import {
  createParseError,
  createRelationship,
  createUnsupportedWarning,
  createWorkingSchema,
  extractTrailingAction,
  mergeWithPreviousLayout,
  parseColumnList,
  parsePostgresStringArray,
  parseReferenceTarget,
  resolveColumn,
  resolveTable,
  splitSqlStatements,
  splitTopLevelComma,
  tokenizeTopLevel
} from "./sql-helpers";

const COLUMN_CONSTRAINT_KEYWORDS = new Set([
  "CONSTRAINT",
  "PRIMARY",
  "NOT",
  "NULL",
  "UNIQUE",
  "DEFAULT",
  "REFERENCES",
  "CHECK"
]);

function parseCreateTypeEnum(
  statement: string,
  schema = createWorkingSchema()
): boolean {
  const match = statement.match(
    /^CREATE\s+TYPE\s+([A-Za-z0-9_."-]+)\s+AS\s+ENUM\s*\(([\s\S]+)\)$/i
  );
  if (!match) {
    return false;
  }

  const nameParts = splitQualifiedName(match[1] ?? "");
  schema.enums.push({
    id: createId("enum"),
    schema: nameParts.schema,
    name: nameParts.name,
    values: parsePostgresStringArray(match[2] ?? "")
  });
  return true;
}

function parseColumnDefinition(
  fragment: string,
  table: SchemaTable,
  schemaTables: ParseSchemaResult["schema"]["tables"],
  line: number,
  statement: string,
  problems: SchemaProblem[]
): { column?: SchemaColumn; relationships: ParseSchemaResult["schema"]["relationships"]; constraintName?: string } {
  const tokens = tokenizeTopLevel(fragment);
  if (tokens.length < 2) {
    problems.push(createParseError("Column definition is incomplete.", line, statement));
    return { relationships: [] };
  }

  const columnName = normalizeIdentifier(tokens[0] ?? "");
  const constraintStart = tokens.findIndex((token, index) => {
    if (index === 0) {
      return false;
    }

    return COLUMN_CONSTRAINT_KEYWORDS.has(token.toUpperCase());
  });

  const typeTokens =
    constraintStart === -1 ? tokens.slice(1) : tokens.slice(1, constraintStart);
  const constraintTokens =
    constraintStart === -1 ? [] : tokens.slice(constraintStart);

  const column: SchemaColumn = {
    id: createId("column"),
    name: columnName,
    type: typeTokens.join(" "),
    nullable: true,
    primaryKey: false,
    unique: false
  };

  let cursor = 0;
  let pendingConstraintName: string | undefined;
  const relationships: ParseSchemaResult["schema"]["relationships"] = [];

  while (cursor < constraintTokens.length) {
    const token = constraintTokens[cursor]?.toUpperCase();
    if (!token) {
      break;
    }

    if (token === "CONSTRAINT") {
      pendingConstraintName = normalizeIdentifier(constraintTokens[cursor + 1] ?? "");
      cursor += 2;
      continue;
    }

    if (token === "PRIMARY" && constraintTokens[cursor + 1]?.toUpperCase() === "KEY") {
      column.primaryKey = true;
      column.nullable = false;
      cursor += 2;
      continue;
    }

    if (token === "NOT" && constraintTokens[cursor + 1]?.toUpperCase() === "NULL") {
      column.nullable = false;
      cursor += 2;
      continue;
    }

    if (token === "NULL") {
      column.nullable = true;
      cursor += 1;
      continue;
    }

    if (token === "UNIQUE") {
      column.unique = true;
      cursor += 1;
      continue;
    }

    if (token === "DEFAULT") {
      let end = cursor + 1;
      while (
        end < constraintTokens.length &&
        !COLUMN_CONSTRAINT_KEYWORDS.has(constraintTokens[end]?.toUpperCase() ?? "")
      ) {
        end += 1;
      }
      column.defaultValue = constraintTokens.slice(cursor + 1, end).join(" ");
      cursor = end;
      continue;
    }

    if (token === "CHECK") {
      cursor += 1;
      continue;
    }

    if (token === "REFERENCES") {
      const referenceToken = constraintTokens[cursor + 1];
      if (!referenceToken) {
        problems.push(
          createParseError("REFERENCES clause is missing a target.", line, statement)
        );
        break;
      }

      const target = parseReferenceTarget(referenceToken);
      if (!target) {
        problems.push(
          createParseError(
            `Could not parse reference target "${referenceToken}".`,
            line,
            statement
          )
        );
        break;
      }

      const sourceTable = table;
      const tempSchema = {
        version: 1 as const,
        dialect: "postgresql" as const,
        tables: schemaTables,
        enums: [],
        indexes: [],
        relationships: [],
        layout: {},
        metadata: {
          projectName: "",
          lastUpdatedAt: new Date().toISOString(),
          unsupportedStatements: [],
          viewport: { x: 0, y: 0, zoom: 1 }
        }
      };

      const remaining = constraintTokens.slice(cursor + 2);
      const relationship = createRelationship(
        tempSchema,
        sourceTable,
        column,
        target.tableName,
        target.columnName,
        line,
        statement,
        pendingConstraintName,
        extractTrailingAction(remaining, "DELETE"),
        extractTrailingAction(remaining, "UPDATE")
      );
      if ("severity" in relationship) {
        problems.push(relationship);
      } else {
        relationships.push(relationship);
      }

      cursor = constraintTokens.length;
      continue;
    }

    cursor += 1;
  }

  return {
    column,
    relationships,
    constraintName: pendingConstraintName
  };
}

function parseTableConstraint(
  fragment: string,
  table: SchemaTable,
  fullSchema: ParseSchemaResult["schema"],
  line: number,
  statement: string,
  problems: SchemaProblem[]
): TableConstraint | undefined {
  const body = fragment.trim();
  const constraintMatch = body.match(/^CONSTRAINT\s+([A-Za-z0-9_."-]+)\s+([\s\S]+)$/i);
  const constraintName = constraintMatch
    ? normalizeIdentifier(constraintMatch[1] ?? "")
    : undefined;
  const content = constraintMatch ? constraintMatch[2] ?? "" : body;

  const primaryKeyMatch = content.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)$/i);
  if (primaryKeyMatch) {
    const columns = parseColumnList(primaryKeyMatch[1] ?? "");
    for (const columnName of columns) {
      const column = resolveColumn(table, columnName);
      if (column) {
        column.primaryKey = true;
        column.nullable = false;
      }
    }
    return {
      id: createId("constraint"),
      kind: "primary_key",
      name: constraintName,
      columns
    };
  }

  const uniqueMatch = content.match(/^UNIQUE\s*\(([^)]+)\)$/i);
  if (uniqueMatch) {
    const columns = parseColumnList(uniqueMatch[1] ?? "");
    if (columns.length === 1) {
      const column = resolveColumn(table, columns[0] ?? "");
      if (column) {
        column.unique = true;
      }
    }
    return {
      id: createId("constraint"),
      kind: "unique",
      name: constraintName,
      columns
    };
  }

  const checkMatch = content.match(/^CHECK\s*\(([\s\S]+)\)$/i);
  if (checkMatch) {
    return {
      id: createId("constraint"),
      kind: "check",
      name: constraintName,
      expression: checkMatch[1]?.trim() ?? ""
    };
  }

  const foreignKeyMatch = content.match(
    /^FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([A-Za-z0-9_."-]+)\s*\(([^)]+)\)([\s\S]*)$/i
  );
  if (foreignKeyMatch) {
    const sourceColumns = parseColumnList(foreignKeyMatch[1] ?? "");
    const targetTableName = foreignKeyMatch[2] ?? "";
    const targetColumns = parseColumnList(foreignKeyMatch[3] ?? "");
    const actionTokens = tokenizeTopLevel(foreignKeyMatch[4] ?? "");

    if (sourceColumns.length === 1 && targetColumns.length === 1) {
      const sourceColumn = resolveColumn(table, sourceColumns[0] ?? "");
      if (!sourceColumn) {
        problems.push(
          createParseError(
            `Foreign key column "${sourceColumns[0]}" was not found on "${table.name}".`,
            line,
            statement
          )
        );
        return undefined;
      }

      const relationship = createRelationship(
        fullSchema,
        table,
        sourceColumn,
        targetTableName,
        targetColumns[0] ?? "",
        line,
        statement,
        constraintName,
        extractTrailingAction(actionTokens, "DELETE"),
        extractTrailingAction(actionTokens, "UPDATE")
      );

      if ("severity" in relationship) {
        problems.push(relationship);
      } else {
        fullSchema.relationships.push(relationship);
      }
      return undefined;
    }

    problems.push(
      createParseError(
        "Composite foreign keys are not yet visualized and are preserved as raw SQL.",
        line,
        statement
      )
    );
    return undefined;
  }

  return undefined;
}

function parseCreateTable(
  statement: string,
  result: ParseSchemaResult,
  line: number
): boolean {
  const match = statement.match(/^CREATE\s+TABLE\s+([A-Za-z0-9_."-]+)\s*\(([\s\S]+)\)$/i);
  if (!match) {
    return false;
  }

  const nameParts = splitQualifiedName(match[1] ?? "");
  const table: SchemaTable = {
    id: createId("table"),
    schema: nameParts.schema,
    name: nameParts.name,
    columns: [],
    constraints: []
  };

  result.schema.tables.push(table);
  result.schema.layout[table.id] = {
    x: result.schema.tables.length * 300,
    y: 80
  };

  const fragments = splitTopLevelComma(match[2] ?? "");
  const pendingRelationshipFragments: string[] = [];

  for (const fragment of fragments) {
    const upper = fragment.trim().toUpperCase();
    if (
      upper.startsWith("CONSTRAINT") ||
      upper.startsWith("PRIMARY KEY") ||
      upper.startsWith("FOREIGN KEY") ||
      upper.startsWith("UNIQUE") ||
      upper.startsWith("CHECK")
    ) {
      pendingRelationshipFragments.push(fragment);
      continue;
    }

    const parsedColumn = parseColumnDefinition(
      fragment,
      table,
      result.schema.tables,
      line,
      statement,
      result.errors
    );
    if (parsedColumn.column) {
      table.columns.push(parsedColumn.column);
      result.schema.relationships.push(...parsedColumn.relationships);
    }
  }

  for (const fragment of pendingRelationshipFragments) {
    const constraint = parseTableConstraint(
      fragment,
      table,
      result.schema,
      line,
      statement,
      result.errors
    );
    if (constraint) {
      table.constraints.push(constraint);
    }
  }

  return true;
}

function parseCreateIndex(
  statement: string,
  result: ParseSchemaResult,
  line: number
): boolean {
  const match = statement.match(
    /^CREATE\s+(UNIQUE\s+)?INDEX\s+([A-Za-z0-9_."-]+)\s+ON\s+([A-Za-z0-9_."-]+)(?:\s+USING\s+([A-Za-z0-9_]+))?\s*\(([^)]+)\)$/i
  );
  if (!match) {
    return false;
  }

  const table = resolveTable(result.schema, match[3] ?? "");
  if (!table) {
    result.errors.push(
      createParseError(`Index target table "${match[3]}" was not found.`, line, statement)
    );
    return true;
  }

  result.schema.indexes.push({
    id: createId("index"),
    name: normalizeIdentifier(match[2] ?? ""),
    tableId: table.id,
    columns: parseColumnList(match[5] ?? ""),
    unique: Boolean(match[1]),
    method: match[4]?.toLowerCase()
  });
  return true;
}

function parseComment(
  statement: string,
  result: ParseSchemaResult
): boolean {
  const tableMatch = statement.match(
    /^COMMENT\s+ON\s+TABLE\s+([A-Za-z0-9_."-]+)\s+IS\s+'([\s\S]*)'$/i
  );
  if (tableMatch) {
    const table = resolveTable(result.schema, tableMatch[1] ?? "");
    if (table) {
      table.comment = tableMatch[2]?.replace(/''/g, "'") ?? "";
    }
    return true;
  }

  const columnMatch = statement.match(
    /^COMMENT\s+ON\s+COLUMN\s+([A-Za-z0-9_."-]+)\.([A-Za-z0-9_."-]+)\s+IS\s+'([\s\S]*)'$/i
  );
  if (columnMatch) {
    const table = resolveTable(result.schema, columnMatch[1] ?? "");
    const column = table ? resolveColumn(table, columnMatch[2] ?? "") : undefined;
    if (column) {
      column.comment = columnMatch[3]?.replace(/''/g, "'") ?? "";
    }
    return true;
  }

  return false;
}

export function parseSchemaSql(
  sql: string,
  options: ParseSchemaOptions = {}
): ParseSchemaResult {
  const result: ParseSchemaResult = {
    schema: createWorkingSchema(options.projectName),
    warnings: [],
    errors: [],
    unsupportedStatements: []
  };

  const statements = splitSqlStatements(sql);
  for (const entry of statements) {
    const statement = entry.statement.trim().replace(/;$/, "");
    if (!statement) {
      continue;
    }

    if (parseCreateTypeEnum(statement, result.schema)) {
      continue;
    }

    if (parseCreateTable(statement, result, entry.line)) {
      continue;
    }

    if (parseCreateIndex(statement, result, entry.line)) {
      continue;
    }

    if (parseComment(statement, result)) {
      continue;
    }

    result.unsupportedStatements.push({
      id: createId("unsupported"),
      statement,
      reason: "Statement is currently preserved as raw SQL."
    });
    result.warnings.push(
      createUnsupportedWarning(
        statement,
        "This SQL statement is currently not visualized, but it is preserved as raw SQL."
      )
    );
  }

  result.schema.metadata.unsupportedStatements = result.unsupportedStatements;
  result.schema = mergeWithPreviousLayout(
    syncColumnReferences(result.schema),
    options.previousSchema
  );
  return result;
}
