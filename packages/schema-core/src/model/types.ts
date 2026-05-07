export type Dialect = "postgresql";

export interface SchemaLayoutPosition {
  x: number;
  y: number;
}

export interface SchemaViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface RelationshipReference {
  tableId: string;
  columnId: string;
}

export interface SchemaColumn {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue?: string;
  references?: RelationshipReference;
  comment?: string;
  notes?: string;
}

export interface PrimaryKeyConstraint {
  id: string;
  kind: "primary_key";
  name?: string;
  columns: string[];
}

export interface UniqueConstraint {
  id: string;
  kind: "unique";
  name?: string;
  columns: string[];
}

export interface CheckConstraint {
  id: string;
  kind: "check";
  name?: string;
  expression: string;
}

export type TableConstraint =
  | PrimaryKeyConstraint
  | UniqueConstraint
  | CheckConstraint;

export interface SchemaTable {
  id: string;
  name: string;
  schema: string;
  columns: SchemaColumn[];
  constraints: TableConstraint[];
  comment?: string;
  notes?: string;
}

export interface SchemaForeignKey {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  onDelete?: string;
  onUpdate?: string;
  constraintName?: string;
  notes?: string;
}

export interface SchemaEnum {
  id: string;
  name: string;
  schema: string;
  values: string[];
  comment?: string;
}

export interface SchemaIndex {
  id: string;
  name: string;
  tableId: string;
  columns: string[];
  unique: boolean;
  method?: string;
  comment?: string;
}

export interface UnsupportedStatement {
  id: string;
  statement: string;
  reason: string;
}

export type ProblemSeverity = "error" | "warning" | "info";

export interface SchemaProblem {
  id: string;
  severity: ProblemSeverity;
  code: string;
  message: string;
  location?: {
    line?: number;
    column?: number;
    statement?: string;
    tableId?: string;
    columnId?: string;
  };
}

export interface SchemaMetadata {
  projectName: string;
  lastUpdatedAt: string;
  unsupportedStatements: UnsupportedStatement[];
  viewport: SchemaViewport;
}

export interface SchemaModel {
  version: 1;
  dialect: Dialect;
  tables: SchemaTable[];
  enums: SchemaEnum[];
  indexes: SchemaIndex[];
  relationships: SchemaForeignKey[];
  layout: Record<string, SchemaLayoutPosition>;
  metadata: SchemaMetadata;
}

export interface ParseSchemaOptions {
  previousSchema?: SchemaModel;
  projectName?: string;
}

export interface ParseSchemaResult {
  schema: SchemaModel;
  warnings: SchemaProblem[];
  errors: SchemaProblem[];
  unsupportedStatements: UnsupportedStatement[];
}

export interface SchemaOperationResult {
  schema: SchemaModel;
  warnings: SchemaProblem[];
}

export interface CreateTableInput {
  name: string;
  schema?: string;
  comment?: string;
  position?: SchemaLayoutPosition;
}

export interface CreateColumnInput {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  defaultValue?: string;
  comment?: string;
}

export interface CreateEnumInput {
  name: string;
  schema?: string;
  values: string[];
}

export interface CreateForeignKeyInput {
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  onDelete?: string;
  onUpdate?: string;
  constraintName?: string;
}
