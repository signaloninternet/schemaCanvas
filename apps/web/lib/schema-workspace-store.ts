"use client";

import {
  addColumn as addColumnOperation,
  addEnum as addEnumOperation,
  addForeignKey as addForeignKeyOperation,
  addTable as addTableOperation,
  cloneSchema,
  createEmptySchema,
  deleteColumn as deleteColumnOperation,
  deleteForeignKey as deleteForeignKeyOperation,
  deleteTable as deleteTableOperation,
  generateMarkdownDocs,
  generateMigrationPreview,
  generateSchemaSql,
  parseSchemaSql,
  schemaModelSchema,
  simpleEcommerceSql,
  projectManagementSql,
  updateColumn as updateColumnOperation,
  updateColumnComment as updateColumnCommentOperation,
  updateLayout as updateLayoutOperation,
  updateTableComment as updateTableCommentOperation,
  updateViewport as updateViewportOperation,
  renameTable as renameTableOperation,
  validateSchema,
  valetPlatformSql,
  type SchemaColumn,
  type SchemaModel,
  type SchemaProblem
} from "@schemacanvas/schema-core";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { autoLayoutSchema } from "@/lib/auto-layout";
import { uniqueName } from "@/lib/utils";

export type BottomTab = "problems" | "migration" | "documentation" | "json";
export type ExamplePreset =
  | "blank"
  | "ecommerce"
  | "project-management"
  | "valet-platform";

interface SchemaSelection {
  tableId?: string;
  columnId?: string;
  relationshipId?: string;
}

interface WorkspaceSnapshot {
  projectName: string;
  sqlDraft: string;
  schema: SchemaModel;
  parserWarnings: SchemaProblem[];
  parserErrors: SchemaProblem[];
  validationProblems: SchemaProblem[];
  migrationPreview: string;
  activeBottomTab: BottomTab;
  selection: SchemaSelection;
  currentPreset: ExamplePreset;
}

interface WorkspaceState extends WorkspaceSnapshot {
  setProjectName: (projectName: string) => void;
  setSqlDraft: (sql: string) => void;
  parseSql: () => void;
  formatSql: () => void;
  validateCurrent: () => void;
  setActiveBottomTab: (tab: BottomTab) => void;
  selectTable: (tableId?: string) => void;
  selectColumn: (tableId: string, columnId: string) => void;
  selectRelationship: (relationshipId?: string) => void;
  addTable: () => void;
  deleteTable: (tableId: string) => void;
  renameTable: (tableId: string, name: string) => void;
  addColumn: (tableId: string) => void;
  updateColumn: (
    tableId: string,
    columnId: string,
    patch: Partial<SchemaColumn>
  ) => void;
  deleteColumn: (tableId: string, columnId: string) => void;
  addForeignKey: (
    sourceTableId: string,
    sourceColumnId: string,
    targetTableId: string,
    targetColumnId: string
  ) => void;
  deleteForeignKey: (relationshipId: string) => void;
  addEnum: (name: string, values: string[]) => void;
  updateTableComment: (tableId: string, comment: string) => void;
  updateColumnComment: (
    tableId: string,
    columnId: string,
    comment: string
  ) => void;
  updateTablePosition: (tableId: string, position: { x: number; y: number }) => void;
  updateViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  autoLayout: () => void;
  loadPreset: (preset: ExamplePreset) => void;
  importSql: (sql: string, projectName?: string) => void;
  importSchemaModel: (payload: string) => void;
  resetToBlank: () => void;
}

function buildSnapshotFromSchema(
  schema: SchemaModel,
  sqlDraft: string,
  partial?: Partial<WorkspaceSnapshot>
): WorkspaceSnapshot {
  const validationProblems = validateSchema(schema).problems;
  return {
    projectName: partial?.projectName ?? schema.metadata.projectName,
    schema,
    sqlDraft,
    parserWarnings: partial?.parserWarnings ?? [],
    parserErrors: partial?.parserErrors ?? [],
    validationProblems,
    migrationPreview:
      partial?.migrationPreview ??
      generateMigrationPreview(null, schema),
    activeBottomTab: partial?.activeBottomTab ?? "problems",
    selection: partial?.selection ?? {},
    currentPreset: partial?.currentPreset ?? "ecommerce"
  };
}

function parsePresetSql(
  sql: string,
  projectName: string,
  preset: ExamplePreset
): WorkspaceSnapshot {
  const parsed = parseSchemaSql(sql, { projectName });
  const layoutApplied = autoLayoutSchema(parsed.schema);
  const nextSql = generateSchemaSql(layoutApplied, {
    includeUnsupportedStatements: true
  });

  return buildSnapshotFromSchema(layoutApplied, nextSql, {
    parserWarnings: parsed.warnings,
    parserErrors: parsed.errors,
    projectName,
    currentPreset: preset,
    migrationPreview: generateMigrationPreview(null, layoutApplied)
  });
}

function createBlankSnapshot(): WorkspaceSnapshot {
  const schema = createEmptySchema("SchemaCanvas");
  return buildSnapshotFromSchema(schema, "", {
    projectName: "SchemaCanvas",
    currentPreset: "blank",
    migrationPreview: "-- No schema changes detected."
  });
}

const presetSnapshots: Record<Exclude<ExamplePreset, "blank">, WorkspaceSnapshot> = {
  ecommerce: parsePresetSql(simpleEcommerceSql, "SchemaCanvas Demo", "ecommerce"),
  "project-management": parsePresetSql(
    projectManagementSql,
    "Project Management",
    "project-management"
  ),
  "valet-platform": parsePresetSql(
    valetPlatformSql,
    "Valet Platform",
    "valet-platform"
  )
};

function applySchemaUpdate(
  previousSchema: SchemaModel,
  nextSchema: SchemaModel,
  projectName: string
): Pick<
  WorkspaceSnapshot,
  | "schema"
  | "sqlDraft"
  | "parserErrors"
  | "parserWarnings"
  | "validationProblems"
  | "migrationPreview"
  | "projectName"
> {
  const schema = cloneSchema(nextSchema);
  schema.metadata.projectName = projectName;
  const sqlDraft = generateSchemaSql(schema, {
    includeUnsupportedStatements: true
  });
  return {
    schema,
    sqlDraft,
    parserErrors: [],
    parserWarnings: [],
    validationProblems: validateSchema(schema).problems,
    migrationPreview: generateMigrationPreview(previousSchema, schema),
    projectName
  };
}

export function getDocumentationExport(schema: SchemaModel): string {
  return generateMarkdownDocs(schema);
}

export const useSchemaWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      ...presetSnapshots.ecommerce,
      setProjectName: (projectName) => {
        set((state) => {
          const schema = cloneSchema(state.schema);
          schema.metadata.projectName = projectName;
          return { projectName, schema };
        });
      },
      setSqlDraft: (sqlDraft) => set({ sqlDraft }),
      parseSql: () => {
        const state = get();
        if (!state.sqlDraft.trim()) {
          const blank = createBlankSnapshot();
          set(blank);
          return;
        }

        const parsed = parseSchemaSql(state.sqlDraft, {
          previousSchema: state.schema,
          projectName: state.projectName
        });

        if (parsed.errors.length > 0) {
          set({
            parserErrors: parsed.errors,
            parserWarnings: parsed.warnings,
            validationProblems: validateSchema(state.schema).problems
          });
          return;
        }

        const schema = cloneSchema(parsed.schema);
        schema.metadata.projectName = state.projectName;
        set({
          schema,
          parserErrors: [],
          parserWarnings: parsed.warnings,
          validationProblems: validateSchema(schema).problems,
          migrationPreview: generateMigrationPreview(null, schema),
          selection: {}
        });
      },
      formatSql: () => {
        const state = get();
        const parsed = parseSchemaSql(state.sqlDraft, {
          previousSchema: state.schema,
          projectName: state.projectName
        });

        if (parsed.errors.length > 0) {
          set({
            parserErrors: parsed.errors,
            parserWarnings: parsed.warnings
          });
          return;
        }

        const sqlDraft = generateSchemaSql(parsed.schema, {
          includeUnsupportedStatements: true
        });
        set({
          schema: parsed.schema,
          sqlDraft,
          parserErrors: [],
          parserWarnings: parsed.warnings,
          validationProblems: validateSchema(parsed.schema).problems
        });
      },
      validateCurrent: () => {
        const state = get();
        set({
          validationProblems: validateSchema(state.schema).problems,
          activeBottomTab: "problems"
        });
      },
      setActiveBottomTab: (activeBottomTab) => set({ activeBottomTab }),
      selectTable: (tableId) =>
        set({
          selection: {
            tableId
          }
        }),
      selectColumn: (tableId, columnId) =>
        set({
          selection: {
            tableId,
            columnId
          }
        }),
      selectRelationship: (relationshipId) =>
        set({
          selection: {
            relationshipId
          }
        }),
      addTable: () => {
        const state = get();
        const name = uniqueName(
          "new_table",
          state.schema.tables.map((table) => table.name)
        );
        const result = addTableOperation(state.schema, {
          name,
          position: {
            x: 120 + state.schema.tables.length * 60,
            y: 80 + state.schema.tables.length * 40
          }
        });
        set({
          ...applySchemaUpdate(state.schema, result.schema, state.projectName),
          selection: { tableId: result.schema.tables.at(-1)?.id },
          activeBottomTab: "migration"
        });
      },
      deleteTable: (tableId) => {
        const state = get();
        const result = deleteTableOperation(state.schema, tableId);
        set({
          ...applySchemaUpdate(state.schema, result.schema, state.projectName),
          selection: {}
        });
      },
      renameTable: (tableId, name) => {
        const state = get();
        const result = renameTableOperation(state.schema, tableId, name);
        set(applySchemaUpdate(state.schema, result.schema, state.projectName));
      },
      addColumn: (tableId) => {
        const state = get();
        const table = state.schema.tables.find((item) => item.id === tableId);
        if (!table) {
          return;
        }

        const result = addColumnOperation(state.schema, tableId, {
          name: uniqueName(
            "new_column",
            table.columns.map((column) => column.name)
          ),
          type: "TEXT",
          nullable: true
        });
        set({
          ...applySchemaUpdate(state.schema, result.schema, state.projectName),
          selection: {
            tableId,
            columnId: result.schema.tables
              .find((item) => item.id === tableId)
              ?.columns.at(-1)?.id
          },
          activeBottomTab: "migration"
        });
      },
      updateColumn: (tableId, columnId, patch) => {
        const state = get();
        const result = updateColumnOperation(state.schema, tableId, columnId, patch);
        set(applySchemaUpdate(state.schema, result.schema, state.projectName));
      },
      deleteColumn: (tableId, columnId) => {
        const state = get();
        const result = deleteColumnOperation(state.schema, tableId, columnId);
        set({
          ...applySchemaUpdate(state.schema, result.schema, state.projectName),
          selection: { tableId }
        });
      },
      addForeignKey: (
        sourceTableId,
        sourceColumnId,
        targetTableId,
        targetColumnId
      ) => {
        const state = get();
        const result = addForeignKeyOperation(state.schema, {
          sourceTableId,
          sourceColumnId,
          targetTableId,
          targetColumnId,
          constraintName: `${state.schema.tables.find((table) => table.id === sourceTableId)?.name}_${state.schema.tables
            .find((table) => table.id === sourceTableId)
            ?.columns.find((column) => column.id === sourceColumnId)?.name}_fkey`
        });
        set({
          ...applySchemaUpdate(state.schema, result.schema, state.projectName),
          selection: { relationshipId: result.schema.relationships.at(-1)?.id },
          activeBottomTab: "migration"
        });
      },
      deleteForeignKey: (relationshipId) => {
        const state = get();
        const result = deleteForeignKeyOperation(state.schema, relationshipId);
        set({
          ...applySchemaUpdate(state.schema, result.schema, state.projectName),
          selection: {}
        });
      },
      addEnum: (name, values) => {
        const state = get();
        const result = addEnumOperation(state.schema, {
          name,
          values
        });
        set(applySchemaUpdate(state.schema, result.schema, state.projectName));
      },
      updateTableComment: (tableId, comment) => {
        const state = get();
        const result = updateTableCommentOperation(state.schema, tableId, comment);
        set(applySchemaUpdate(state.schema, result.schema, state.projectName));
      },
      updateColumnComment: (tableId, columnId, comment) => {
        const state = get();
        const result = updateColumnCommentOperation(
          state.schema,
          tableId,
          columnId,
          comment
        );
        set(applySchemaUpdate(state.schema, result.schema, state.projectName));
      },
      updateTablePosition: (tableId, position) => {
        const state = get();
        const result = updateLayoutOperation(state.schema, tableId, position);
        set({
          schema: result.schema
        });
      },
      updateViewport: (viewport) => {
        const state = get();
        const result = updateViewportOperation(state.schema, viewport);
        set({
          schema: result.schema
        });
      },
      autoLayout: () => {
        const state = get();
        const nextSchema = autoLayoutSchema(state.schema);
        set({
          ...applySchemaUpdate(state.schema, nextSchema, state.projectName)
        });
      },
      loadPreset: (preset) => {
        if (preset === "blank") {
          set(createBlankSnapshot());
          return;
        }

        set(structuredClone(presetSnapshots[preset]));
      },
      importSql: (sql, projectName) => {
        const state = get();
        const parsed = parseSchemaSql(sql, {
          previousSchema: state.schema,
          projectName: projectName ?? state.projectName
        });

        if (parsed.errors.length > 0) {
          set({
            sqlDraft: sql,
            parserErrors: parsed.errors,
            parserWarnings: parsed.warnings,
            activeBottomTab: "problems"
          });
          return;
        }

        const schema = autoLayoutSchema(parsed.schema);
        set({
          ...buildSnapshotFromSchema(
            schema,
            generateSchemaSql(schema, { includeUnsupportedStatements: true }),
            {
              projectName: projectName ?? state.projectName,
              parserWarnings: parsed.warnings,
              parserErrors: [],
              activeBottomTab: "migration",
              currentPreset: "blank"
            }
          )
        });
      },
      importSchemaModel: (payload) => {
        const parsed = schemaModelSchema.safeParse(JSON.parse(payload));
        if (!parsed.success) {
          throw new Error("SchemaModel JSON is invalid.");
        }

        const schema = cloneSchema(parsed.data);
        const sqlDraft = generateSchemaSql(schema, {
          includeUnsupportedStatements: true
        });
        set(
          buildSnapshotFromSchema(schema, sqlDraft, {
            projectName: schema.metadata.projectName,
            currentPreset: "blank",
            activeBottomTab: "json"
          })
        );
      },
      resetToBlank: () => set(createBlankSnapshot())
    }),
    {
      name: "schemacanvas-workspace",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projectName: state.projectName,
        sqlDraft: state.sqlDraft,
        schema: state.schema,
        parserWarnings: state.parserWarnings,
        parserErrors: state.parserErrors,
        validationProblems: state.validationProblems,
        migrationPreview: state.migrationPreview,
        activeBottomTab: state.activeBottomTab,
        selection: state.selection,
        currentPreset: state.currentPreset
      })
    }
  )
);
