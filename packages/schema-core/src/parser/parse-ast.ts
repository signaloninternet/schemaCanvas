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
  const nodeId = `stmt_${statementIndex}_column_${columnIndex}`;
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
  const constraintChildren: SchemaAstNode[] = [];

  const addConstraint = (
    label: string,
    raw: string,
    attributes: NonNullable<SchemaAstNode["attributes"]>,
    children: SchemaAstNode[] = [],
  ): void => {
    constraintChildren.push(
      createAstNode(
        `${nodeId}_constraint_${constraintChildren.length}`,
        "column_constraint",
        label,
        line,
        raw,
        attributes,
        children,
      ),
    );
  };

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
      addConstraint("primary key", "PRIMARY KEY", {
        kind: "primary_key",
        nullable: false,
      });
      cursor += 2;
      continue;
    }

    if (
      token === "NOT" &&
      constraintTokens[cursor + 1]?.toUpperCase() === "NULL"
    ) {
      attributes.nullable = false;
      addConstraint("not null", "NOT NULL", {
        kind: "not_null",
        nullable: false,
      });
      cursor += 2;
      continue;
    }

    if (token === "NULL") {
      attributes.nullable = true;
      addConstraint("nullable", "NULL", {
        kind: "null",
        nullable: true,
      });
      cursor += 1;
      continue;
    }

    if (token === "UNIQUE") {
      attributes.unique = true;
      addConstraint("unique", "UNIQUE", {
        kind: "unique",
      });
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
      addConstraint("default", `DEFAULT ${attributes.defaultValue}`, {
        kind: "default",
        value: attributes.defaultValue,
      });
      cursor = end;
      continue;
    }

    if (token === "REFERENCES") {
      attributes.references = constraintTokens[cursor + 1] ?? "";
      addConstraint(
        "references",
        `REFERENCES ${attributes.references}`,
        {
          kind: "references",
        },
        [
          createAstNode(
            `${nodeId}_reference`,
            "reference",
            attributes.references,
            line,
            attributes.references,
            {
              target: attributes.references,
            },
          ),
        ],
      );
      cursor += 2;
      continue;
    }

    if (token === "CHECK") {
      attributes.check = true;
      addConstraint("check", "CHECK", {
        kind: "check",
      });
      cursor += 1;
      continue;
    }

    cursor += 1;
  }

  return createAstNode(
    nodeId,
    "column",
    columnName || "column",
    line,
    fragment,
    attributes,
    [
      createAstNode(
        `${nodeId}_type`,
        "data_type",
        String(attributes.type),
        line,
        typeTokens.join(" "),
        {
          type: String(attributes.type),
        },
      ),
      createAstNode(
        `${nodeId}_constraints`,
        "constraints",
        "constraints",
        line,
        constraintTokens.join(" "),
        {
          count: constraintChildren.length,
        },
        constraintChildren,
      ),
    ],
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
  const children: SchemaAstNode[] = [];

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
    children.push(
      createAstNode(
        `stmt_${statementIndex}_constraint_${constraintIndex}_expression`,
        "expression",
        "check expression",
        line,
        attributes.expression,
        {
          expression: attributes.expression,
        },
      ),
    );
  }

  const foreignKeyMatch = content.match(
    /^FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([A-Za-z0-9_."-]+)\s*\(([^)]+)\)([\s\S]*)$/i,
  );
  if (foreignKeyMatch) {
    attributes.kind = "foreign_key";
    attributes.columns = parseColumnList(foreignKeyMatch[1] ?? "");
    attributes.references = `${foreignKeyMatch[2] ?? ""}(${foreignKeyMatch[3] ?? ""})`;
    children.push(
      createAstNode(
        `stmt_${statementIndex}_constraint_${constraintIndex}_reference`,
        "reference",
        attributes.references,
        line,
        attributes.references,
        {
          target: attributes.references,
        },
      ),
    );
  }

  if (!attributes.kind) {
    attributes.kind = "unknown";
  }

  if (Array.isArray(attributes.columns)) {
    children.unshift(
      createAstNode(
        `stmt_${statementIndex}_constraint_${constraintIndex}_columns`,
        "columns",
        "columns",
        line,
        attributes.columns.join(", "),
        {
          count: attributes.columns.length,
        },
        attributes.columns.map((column, columnIndex) =>
          createAstNode(
            `stmt_${statementIndex}_constraint_${constraintIndex}_column_${columnIndex}`,
            "identifier",
            column,
            line,
            column,
            {
              name: column,
            },
          ),
        ),
      ),
    );
  }

  return createAstNode(
    `stmt_${statementIndex}_constraint_${constraintIndex}`,
    "table_constraint",
    String(attributes.kind),
    line,
    fragment,
    attributes,
    children,
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
  const columnNodes: SchemaAstNode[] = [];
  const constraintNodes: SchemaAstNode[] = [];

  for (const [fragmentIndex, fragment] of fragments.entries()) {
    const upper = fragment.trim().toUpperCase();
    if (
      upper.startsWith("CONSTRAINT") ||
      upper.startsWith("PRIMARY KEY") ||
      upper.startsWith("FOREIGN KEY") ||
      upper.startsWith("UNIQUE") ||
      upper.startsWith("CHECK")
    ) {
      constraintNodes.push(
        parseTableConstraintAst(fragment, line, statementIndex, fragmentIndex),
      );
      continue;
    }

    columnNodes.push(
      parseColumnAst(fragment, line, statementIndex, fragmentIndex),
    );
  }

  return createAstNode(
    `stmt_${statementIndex}`,
    "create_table",
    nameParts.name,
    line,
    statement,
    {
      schema: nameParts.schema,
      name: nameParts.name,
      columns: columnNodes.length,
      constraints: constraintNodes.length,
    },
    [
      createAstNode(
        `stmt_${statementIndex}_columns`,
        "columns",
        "columns",
        line,
        match[2] ?? "",
        {
          count: columnNodes.length,
        },
        columnNodes,
      ),
      createAstNode(
        `stmt_${statementIndex}_constraints`,
        "constraints",
        "table constraints",
        line,
        match[2] ?? "",
        {
          count: constraintNodes.length,
        },
        constraintNodes,
      ),
    ],
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
