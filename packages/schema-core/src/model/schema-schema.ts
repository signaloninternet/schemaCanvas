import { z } from "zod";

export const layoutPositionSchema = z.object({
  x: z.number(),
  y: z.number()
});

export const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number()
});

export const relationshipReferenceSchema = z.object({
  tableId: z.string(),
  columnId: z.string()
});

export const columnSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  nullable: z.boolean(),
  primaryKey: z.boolean(),
  unique: z.boolean(),
  defaultValue: z.string().optional(),
  references: relationshipReferenceSchema.optional(),
  comment: z.string().optional(),
  notes: z.string().optional()
});

export const primaryKeyConstraintSchema = z.object({
  id: z.string(),
  kind: z.literal("primary_key"),
  name: z.string().optional(),
  columns: z.array(z.string()).min(1)
});

export const uniqueConstraintSchema = z.object({
  id: z.string(),
  kind: z.literal("unique"),
  name: z.string().optional(),
  columns: z.array(z.string()).min(1)
});

export const checkConstraintSchema = z.object({
  id: z.string(),
  kind: z.literal("check"),
  name: z.string().optional(),
  expression: z.string()
});

export const tableConstraintSchema = z.discriminatedUnion("kind", [
  primaryKeyConstraintSchema,
  uniqueConstraintSchema,
  checkConstraintSchema
]);

export const tableSchema = z.object({
  id: z.string(),
  name: z.string(),
  schema: z.string(),
  columns: z.array(columnSchema),
  constraints: z.array(tableConstraintSchema),
  comment: z.string().optional(),
  notes: z.string().optional()
});

export const relationshipSchema = z.object({
  id: z.string(),
  sourceTableId: z.string(),
  sourceColumnId: z.string(),
  targetTableId: z.string(),
  targetColumnId: z.string(),
  onDelete: z.string().optional(),
  onUpdate: z.string().optional(),
  constraintName: z.string().optional(),
  notes: z.string().optional()
});

export const enumSchema = z.object({
  id: z.string(),
  name: z.string(),
  schema: z.string(),
  values: z.array(z.string()).min(1),
  comment: z.string().optional()
});

export const indexSchema = z.object({
  id: z.string(),
  name: z.string(),
  tableId: z.string(),
  columns: z.array(z.string()).min(1),
  unique: z.boolean(),
  method: z.string().optional(),
  comment: z.string().optional()
});

export const unsupportedStatementSchema = z.object({
  id: z.string(),
  statement: z.string(),
  reason: z.string()
});

export const metadataSchema = z.object({
  projectName: z.string(),
  lastUpdatedAt: z.string(),
  unsupportedStatements: z.array(unsupportedStatementSchema),
  viewport: viewportSchema
});

export const schemaModelSchema = z.object({
  version: z.literal(1),
  dialect: z.literal("postgresql"),
  tables: z.array(tableSchema),
  enums: z.array(enumSchema),
  indexes: z.array(indexSchema),
  relationships: z.array(relationshipSchema),
  layout: z.record(layoutPositionSchema),
  metadata: metadataSchema
});

export type SchemaModelInput = z.infer<typeof schemaModelSchema>;
