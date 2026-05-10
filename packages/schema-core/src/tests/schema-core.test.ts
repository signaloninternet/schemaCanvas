import { describe, expect, it } from "vitest";
import { generateMigrationPreview } from "../diff/generate-migration-preview";
import { generateMarkdownDocs } from "../docs/generate-markdown-docs";
import { simpleEcommerceSql } from "../examples/simple-ecommerce";
import { generateSchemaSql } from "../generator/generate-sql";
import {
  addColumn,
  deleteColumn,
  addForeignKey,
  addTable,
  renameTable,
  updateColumn,
} from "../operations/schema-operations";
import { parseSqlAst } from "../parser/parse-ast";
import { parseSchemaSql } from "../parser/parse-schema";
import { validateSchema } from "../validator/validate-schema";

describe("schema core", () => {
  it("parses the acceptance-criteria SQL into tables, enum, and relationship", () => {
    const sql = `CREATE TYPE order_status AS ENUM ('pending', 'paid', 'cancelled');

CREATE TABLE customers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  total_amount NUMERIC(10,2) NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now()
);`;

    const result = parseSchemaSql(sql);
    expect(result.errors).toHaveLength(0);
    expect(result.schema.enums).toHaveLength(1);
    expect(result.schema.tables.map((table) => table.name)).toEqual([
      "customers",
      "orders",
    ]);
    expect(result.schema.relationships).toHaveLength(1);
    expect(result.ast.statementCount).toBe(3);
    expect(result.ast.root.children.map((node) => node.kind)).toEqual([
      "create_type_enum",
      "create_table",
      "create_table",
    ]);
  });

  it("generates readable sql and markdown", () => {
    const parsed = parseSchemaSql(simpleEcommerceSql);
    const sql = generateSchemaSql(parsed.schema, {
      includeUnsupportedStatements: true,
    });
    const markdown = generateMarkdownDocs(parsed.schema);

    expect(sql).toContain("CREATE TYPE order_status AS ENUM");
    expect(sql).toContain("CREATE TABLE customers");
    expect(markdown).toContain("# Database Schema Documentation");
    expect(markdown).toContain("## customers");
  });

  it("supports visual schema operations and migration preview", () => {
    const parsed = parseSchemaSql(simpleEcommerceSql);
    const withInvoices = addTable(parsed.schema, {
      name: "invoice_events",
      position: { x: 900, y: 220 },
    }).schema;
    const invoiceEvents = withInvoices.tables.find(
      (table) => table.name === "invoice_events",
    );
    const payments = withInvoices.tables.find(
      (table) => table.name === "payments",
    );
    expect(invoiceEvents).toBeDefined();
    expect(payments).toBeDefined();

    const withColumns = addColumn(withInvoices, invoiceEvents!.id, {
      name: "payment_id",
      type: "UUID",
      nullable: false,
    }).schema;
    const paymentIdColumn = withColumns.tables
      .find((table) => table.id === invoiceEvents!.id)
      ?.columns.find((column) => column.name === "payment_id");
    expect(paymentIdColumn).toBeDefined();

    const withRelationship = addForeignKey(withColumns, {
      sourceTableId: invoiceEvents!.id,
      sourceColumnId: paymentIdColumn!.id,
      targetTableId: payments!.id,
      targetColumnId: payments!.columns[0]!.id,
    }).schema;

    const migration = generateMigrationPreview(parsed.schema, withRelationship);
    expect(migration).toContain("CREATE TABLE invoice_events");
    expect(migration).toContain("payment_id UUID NOT NULL");
    expect(migration).toContain(
      "FOREIGN KEY (payment_id) REFERENCES payments(id)",
    );
  });

  it("produces deterministic warnings", () => {
    const parsed = parseSchemaSql(`CREATE TABLE session (
  token TEXT,
  user_id UUID
);`);
    const validation = validateSchema(parsed.schema);
    expect(
      validation.problems.some(
        (problem) => problem.code === "missing_primary_key",
      ),
    ).toBe(true);
    expect(
      validation.problems.some(
        (problem) => problem.code === "possible_missing_foreign_key",
      ),
    ).toBe(true);
  });

  it("builds a parser AST with unsupported statement preservation", () => {
    const ast = parseSqlAst(`CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE
);

CREATE TRIGGER sync_accounts AFTER INSERT ON accounts EXECUTE FUNCTION sync();`);

    expect(ast.statementCount).toBe(2);
    expect(ast.supportedStatementCount).toBe(1);
    expect(ast.unsupportedStatementCount).toBe(1);
    expect(ast.root.children[0]?.children.map((node) => node.kind)).toEqual([
      "columns",
      "constraints",
    ]);
    expect(
      ast.root.children[0]?.children[0]?.children[0]?.children.map(
        (node) => node.kind,
      ),
    ).toEqual(["data_type", "constraints"]);
    expect(
      ast.root.children[0]?.children[0]?.children[0]?.children[1]?.children.map(
        (node) => node.kind,
      ),
    ).toContain("column_constraint");
    expect(ast.root.children[1]?.kind).toBe("unsupported");
  });

  it("detects migration renames and destructive changes", () => {
    const parsed = parseSchemaSql(simpleEcommerceSql);
    const customers = parsed.schema.tables.find(
      (table) => table.name === "customers",
    );
    expect(customers).toBeDefined();
    const email = customers!.columns.find((column) => column.name === "email");
    expect(email).toBeDefined();

    const renamedTable = renameTable(
      parsed.schema,
      customers!.id,
      "shop_customers",
    ).schema;
    const renamedColumn = updateColumn(renamedTable, customers!.id, email!.id, {
      name: "email_address",
      type: "VARCHAR(128)",
      nullable: false,
    }).schema;
    const droppedColumn = deleteColumn(
      renamedColumn,
      customers!.id,
      customers!.columns[0]!.id,
    ).schema;

    const migration = generateMigrationPreview(parsed.schema, droppedColumn);

    expect(migration).toContain(
      "ALTER TABLE customers RENAME TO shop_customers;",
    );
    expect(migration).toContain(
      "ALTER TABLE shop_customers RENAME COLUMN email TO email_address;",
    );
    expect(migration).toContain("-- WARNING:");
    expect(migration).toContain("DROP COLUMN id;");
  });

  it("diffs enum values by qualified name when schema versions have different ids", () => {
    const previous = parseSchemaSql(
      `CREATE TYPE order_status AS ENUM ('pending', 'paid');`,
    );
    const next = parseSchemaSql(
      `CREATE TYPE order_status AS ENUM ('pending', 'paid', 'cancelled');`,
    );

    const migration = generateMigrationPreview(previous.schema, next.schema);

    expect(migration).toContain(
      "ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cancelled';",
    );
    expect(migration).not.toContain("CREATE TYPE order_status");
  });

  it("does not re-add unchanged foreign keys after parsing a newer SQL version", () => {
    const previousSql = `CREATE TABLE customers (
  id UUID PRIMARY KEY
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id)
);`;
    const nextSql = `CREATE TABLE customers (
  id UUID PRIMARY KEY,
  phone TEXT
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id)
);`;

    const previous = parseSchemaSql(previousSql);
    const next = parseSchemaSql(nextSql, { previousSchema: previous.schema });
    const migration = generateMigrationPreview(previous.schema, next.schema);

    expect(migration).toContain("ALTER TABLE customers ADD COLUMN phone TEXT;");
    expect(migration).not.toContain("ADD FOREIGN KEY (customer_id)");
  });
});
