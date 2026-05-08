import type { SchemaAst, SchemaAstNode } from "../model/types";
import { normalizeIdentifier, splitQualifiedName } from "../model/utils";
import {
  parseColumnList,
  parsePostgresStringArray,
  splitSqlStatements,
  splitTopLevelComma,
  tokenizeTopLevel,
} from "./sql-helpers";

const COLUMN_CONSTRAINT_KEYWORDS = new Set([
  "CONSTRAINT",
  "PRIMARY",
  "NOT",
  "NULL",
  "UNIQUE",
  "DEFAULT",
  "REFERENCES",
  "CHECK",
]);

function createAstNode(
  id: string,
  kind: SchemaAstNode["kind"],
  label: string,
  line: number,
  raw: string,
  attributes: SchemaAstNode["attributes"] = {},
  children: SchemaAstNode[] = [],
  status: SchemaAstNode["status"] = "parsed",
): SchemaAstNode {
  return {
    id,
    kind,
    label,
    line,
    raw,
    status,
    attributes,
    children,
  };
}

function parseColumnAst(
  fragment: string,
  line: number,
  statementIndex: number,
  columnIndex: number,
): SchemaAstNode {
  const tokens = tokenizeTopLevel(fragment);
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

  const attributes: NonNullable<SchemaAstNode["attributes"]> = {
    name: columnName,
    type: typeTokens.join(" ") || "unknown",
    nullable: true,
    primaryKey: false,
    unique: false,
  };

  let cursor = 0;
  while (cursor < constraintTokens.length) {
    const token = constraintTokens[cursor]?.toUpperCase();
    if (!token) {
      break;
    }

    if (token === "CONSTRAINT") {
      attributes.constraintName = normalizeIdentifier(
        constraintTokens[cursor + 1] ?? "",
      );
      cursor += 2;
      continue;
    }

    if (
      token === "PRIMARY" &&
      constraintTokens[cursor + 1]?.toUpperCase() === "KEY"
    ) {
      attributes.primaryKey = true;
      attributes.nullable = false;
      cursor += 2;
      continue;
    }

    if (
      token === "NOT" &&
      constraintTokens[cursor + 1]?.toUpperCase() === "NULL"
    ) {
      attributes.nullable = false;
      cursor += 2;
      continue;
    }

    if (token === "NULL") {
      attributes.nullable = true;
      cursor += 1;
      continue;
    }

    if (token === "UNIQUE") {
      attributes.unique = true;
      cursor += 1;
      continue;
    }

    if (token === "DEFAULT") {
      let end = cursor + 1;
      while (
        end < constraintTokens.length &&
        !COLUMN_CONSTRAINT_KEYWORDS.has(
          constraintTokens[end]?.toUpperCase() ?? "",
        )
      ) {
        end += 1;
      }
      attributes.defaultValue = constraintTokens
        .slice(cursor + 1, end)
        .join(" ");
      cursor = end;
      continue;
    }

    if (token === "REFERENCES") {
      attributes.references = constraintTokens[cursor + 1] ?? "";
      cursor += 2;
      continue;
    }

    if (token === "CHECK") {
      attributes.check = true;
      cursor += 1;
      continue;
    }

    cursor += 1;
  }

  return createAstNode(
    `stmt_${statementIndex}_column_${columnIndex}`,
    "column",
    columnName || "column",
    line,
    fragment,
    attributes,
  );
}

function parseTableConstraintAst(
  fragment: string,
  line: number,
  statementIndex: number,
  constraintIndex: number,
): SchemaAstNode {
  const body = fragment.trim();
  const constraintMatch = body.match(
    /^CONSTRAINT\s+([A-Za-z0-9_."-]+)\s+([\s\S]+)$/i,
  );
  const constraintName = constraintMatch
    ? normalizeIdentifier(constraintMatch[1] ?? "")
    : undefined;
  const content = constraintMatch ? (constraintMatch[2] ?? "") : body;
  const attributes: NonNullable<SchemaAstNode["attributes"]> = {};

  if (constraintName) {
    attributes.name = constraintName;
  }

  const primaryKeyMatch = content.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)$/i);
  if (primaryKeyMatch) {
    attributes.kind = "primary_key";
    attributes.columns = parseColumnList(primaryKeyMatch[1] ?? "");
  }

  const uniqueMatch = content.match(/^UNIQUE\s*\(([^)]+)\)$/i);
  if (uniqueMatch) {
    attributes.kind = "unique";
    attributes.columns = parseColumnList(uniqueMatch[1] ?? "");
  }

  const checkMatch = content.match(/^CHECK\s*\(([\s\S]+)\)$/i);
  if (checkMatch) {
    attributes.kind = "check";
    attributes.expression = checkMatch[1]?.trim() ?? "";
  }

  const foreignKeyMatch = content.match(
    /^FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([A-Za-z0-9_."-]+)\s*\(([^)]+)\)([\s\S]*)$/i,
  );
  if (foreignKeyMatch) {
    attributes.kind = "foreign_key";
    attributes.columns = parseColumnList(foreignKeyMatch[1] ?? "");
    attributes.references = `${foreignKeyMatch[2] ?? ""}(${foreignKeyMatch[3] ?? ""})`;
  }

  if (!attributes.kind) {
    attributes.kind = "unknown";
  }

  return createAstNode(
    `stmt_${statementIndex}_constraint_${constraintIndex}`,
    "table_constraint",
    String(attributes.kind),
    line,
    fragment,
    attributes,
  );
}

function parseCreateTypeEnumAst(
  statement: string,
  line: number,
  statementIndex: number,
): SchemaAstNode | undefined {
  const match = statement.match(
    /^CREATE\s+TYPE\s+([A-Za-z0-9_."-]+)\s+AS\s+ENUM\s*\(([\s\S]+)\)$/i,
  );
  if (!match) {
    return undefined;
  }

  const nameParts = splitQualifiedName(match[1] ?? "");
  const values = parsePostgresStringArray(match[2] ?? "");

  return createAstNode(
    `stmt_${statementIndex}`,
    "create_type_enum",
    nameParts.name,
    line,
    statement,
    {
      schema: nameParts.schema,
      name: nameParts.name,
      values,
    },
    values.map((value, valueIndex) =>
      createAstNode(
        `stmt_${statementIndex}_enum_value_${valueIndex}`,
        "enum_value",
        value,
        line,
        value,
        { value },
      ),
    ),
  );
}

function parseCreateTableAst(
  statement: string,
  line: number,
  statementIndex: number,
): SchemaAstNode | undefined {
  const match = statement.match(
    /^CREATE\s+TABLE\s+([A-Za-z0-9_."-]+)\s*\(([\s\S]+)\)$/i,
  );
  if (!match) {
    return undefined;
  }

  const nameParts = splitQualifiedName(match[1] ?? "");
  const fragments = splitTopLevelComma(match[2] ?? "");
  const children = fragments.map((fragment, fragmentIndex) => {
    const upper = fragment.trim().toUpperCase();
    if (
      upper.startsWith("CONSTRAINT") ||
      upper.startsWith("PRIMARY KEY") ||
      upper.startsWith("FOREIGN KEY") ||
      upper.startsWith("UNIQUE") ||
      upper.startsWith("CHECK")
    ) {
      return parseTableConstraintAst(
        fragment,
        line,
        statementIndex,
        fragmentIndex,
      );
    }

    return parseColumnAst(fragment, line, statementIndex, fragmentIndex);
  });

  return createAstNode(
    `stmt_${statementIndex}`,
    "create_table",
    nameParts.name,
    line,
    statement,
    {
      schema: nameParts.schema,
      name: nameParts.name,
      columns: children.filter((child) => child.kind === "column").length,
      constraints: children.filter((child) => child.kind === "table_constraint")
        .length,
    },
    children,
  );
}

function parseCreateIndexAst(
  statement: string,
  line: number,
  statementIndex: number,
): SchemaAstNode | undefined {
  const match = statement.match(
    /^CREATE\s+(UNIQUE\s+)?INDEX\s+([A-Za-z0-9_."-]+)\s+ON\s+([A-Za-z0-9_."-]+)(?:\s+USING\s+([A-Za-z0-9_]+))?\s*\(([^)]+)\)$/i,
  );
  if (!match) {
    return undefined;
  }

  return createAstNode(
    `stmt_${statementIndex}`,
    "create_index",
    normalizeIdentifier(match[2] ?? ""),
    line,
    statement,
    {
      name: normalizeIdentifier(match[2] ?? ""),
      table: normalizeIdentifier(match[3] ?? ""),
      unique: Boolean(match[1]),
      method: match[4]?.toLowerCase() ?? "btree",
      columns: parseColumnList(match[5] ?? ""),
    },
  );
}

function parseCommentAst(
  statement: string,
  line: number,
  statementIndex: number,
): SchemaAstNode | undefined {
  const tableMatch = statement.match(
    /^COMMENT\s+ON\s+TABLE\s+([A-Za-z0-9_."-]+)\s+IS\s+'([\s\S]*)'$/i,
  );
  if (tableMatch) {
    return createAstNode(
      `stmt_${statementIndex}`,
      "comment",
      `table ${normalizeIdentifier(tableMatch[1] ?? "")}`,
      line,
      statement,
      {
        target: "table",
        table: normalizeIdentifier(tableMatch[1] ?? ""),
      },
    );
  }

  const columnMatch = statement.match(
    /^COMMENT\s+ON\s+COLUMN\s+([A-Za-z0-9_."-]+)\.([A-Za-z0-9_."-]+)\s+IS\s+'([\s\S]*)'$/i,
  );
  if (columnMatch) {
    return createAstNode(
      `stmt_${statementIndex}`,
      "comment",
      `column ${normalizeIdentifier(columnMatch[2] ?? "")}`,
      line,
      statement,
      {
        target: "column",
        table: normalizeIdentifier(columnMatch[1] ?? ""),
        column: normalizeIdentifier(columnMatch[2] ?? ""),
      },
    );
  }

  return undefined;
}

function parseStatementAst(
  statement: string,
  line: number,
  statementIndex: number,
): SchemaAstNode {
  const normalizedStatement = statement.trim().replace(/;$/, "");
  return (
    parseCreateTypeEnumAst(normalizedStatement, line, statementIndex) ??
    parseCreateTableAst(normalizedStatement, line, statementIndex) ??
    parseCreateIndexAst(normalizedStatement, line, statementIndex) ??
    parseCommentAst(normalizedStatement, line, statementIndex) ??
    createAstNode(
      `stmt_${statementIndex}`,
      "unsupported",
      "unsupported statement",
      line,
      normalizedStatement,
      {
        reason: "Statement is preserved as raw SQL.",
      },
      [],
      "warning",
    )
  );
}

export function parseSqlAst(sql: string): SchemaAst {
  const statements = splitSqlStatements(sql);
  const children = statements.map((entry, statementIndex) =>
    parseStatementAst(entry.statement, entry.line, statementIndex),
  );
  const unsupportedStatementCount = children.filter(
    (child) => child.kind === "unsupported",
  ).length;

  return {
    root: createAstNode(
      "script",
      "script",
      "SQL script",
      1,
      sql,
      {
        statements: children.length,
      },
      children,
      unsupportedStatementCount > 0 ? "warning" : "parsed",
    ),
    statementCount: children.length,
    supportedStatementCount: children.length - unsupportedStatementCount,
    unsupportedStatementCount,
  };
}
