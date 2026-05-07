import { describe, expect, it } from "vitest";
import { generateMigrationPreview } from "../diff/generate-migration-preview";
import { generateMarkdownDocs } from "../docs/generate-markdown-docs";
import { simpleEcommerceSql } from "../examples/simple-ecommerce";
import { generateSchemaSql } from "../generator/generate-sql";
import {
  addColumn,
  addForeignKey,
  addTable
} from "../operations/schema-operations";
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
      "orders"
    ]);
    expect(result.schema.relationships).toHaveLength(1);
  });

  it("generates readable sql and markdown", () => {
    const parsed = parseSchemaSql(simpleEcommerceSql);
    const sql = generateSchemaSql(parsed.schema, { includeUnsupportedStatements: true });
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
      position: { x: 900, y: 220 }
    }).schema;
    const invoiceEvents = withInvoices.tables.find(
      (table) => table.name === "invoice_events"
    );
    const payments = withInvoices.tables.find((table) => table.name === "payments");
    expect(invoiceEvents).toBeDefined();
    expect(payments).toBeDefined();

    const withColumns = addColumn(withInvoices, invoiceEvents!.id, {
      name: "payment_id",
      type: "UUID",
      nullable: false
    }).schema;
    const paymentIdColumn = withColumns.tables
      .find((table) => table.id === invoiceEvents!.id)
      ?.columns.find((column) => column.name === "payment_id");
    expect(paymentIdColumn).toBeDefined();

    const withRelationship = addForeignKey(withColumns, {
      sourceTableId: invoiceEvents!.id,
      sourceColumnId: paymentIdColumn!.id,
      targetTableId: payments!.id,
      targetColumnId: payments!.columns[0]!.id
    }).schema;

    const migration = generateMigrationPreview(parsed.schema, withRelationship);
    expect(migration).toContain("CREATE TABLE invoice_events");
    expect(migration).toContain("payment_id UUID NOT NULL");
    expect(migration).toContain("FOREIGN KEY (payment_id) REFERENCES payments(id)");
  });

  it("produces deterministic warnings", () => {
    const parsed = parseSchemaSql(`CREATE TABLE session (
  token TEXT,
  user_id UUID
);`);
    const validation = validateSchema(parsed.schema);
    expect(validation.problems.some((problem) => problem.code === "missing_primary_key")).toBe(
      true
    );
    expect(
      validation.problems.some((problem) => problem.code === "possible_missing_foreign_key")
    ).toBe(true);
  });
});
