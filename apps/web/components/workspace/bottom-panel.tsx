"use client";

import { useRef } from "react";
import type { SchemaAstNode, SchemaModel } from "@schemacanvas/schema-core";
import { toPng } from "html-to-image";
import {
  AlertTriangle,
  Braces,
  Code2,
  Database,
  Download,
  FileJson,
  ImageDown,
  Network,
  ScrollText,
  Workflow,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useSchemaWorkspaceStore,
  getDocumentationExport,
} from "@/lib/schema-workspace-store";
import { downloadTextFile } from "@/lib/utils";

function formatNodeKind(kind: SchemaAstNode["kind"]): string {
  return kind.replace(/_/g, " ");
}

function formatAttributeValue(
  value: string | number | boolean | string[],
): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

function statusVariant(status: SchemaAstNode["status"]): BadgeProps["variant"] {
  if (status === "warning") {
    return "warning";
  }

  if (status === "error") {
    return "destructive";
  }

  return "success";
}

function countMigrationSteps(migrationPreview: string): number {
  return migrationPreview.match(/;\s*$/gm)?.length ?? 0;
}

interface MindMapNode {
  id: string;
  label: string;
  detail?: string;
  tone:
    | "root"
    | "tables"
    | "columns"
    | "relationships"
    | "enums"
    | "indexes"
    | "warnings";
  children: MindMapNode[];
}

function getTableLabel(schema: SchemaModel, tableId: string): string {
  const table = schema.tables.find((candidate) => candidate.id === tableId);
  if (!table) {
    return "unknown_table";
  }

  return table.schema === "public"
    ? table.name
    : `${table.schema}.${table.name}`;
}

function getColumnLabel(
  schema: SchemaModel,
  tableId: string,
  columnId: string,
): string {
  const table = schema.tables.find((candidate) => candidate.id === tableId);
  const column = table?.columns.find((candidate) => candidate.id === columnId);
  return column?.name ?? "unknown_column";
}

function columnDetail(
  column: SchemaModel["tables"][number]["columns"][number],
): string {
  const markers = [
    column.primaryKey ? "PK" : undefined,
    column.unique ? "UNIQUE" : undefined,
    column.nullable ? "NULL" : "NOT NULL",
    column.defaultValue ? `DEFAULT ${column.defaultValue}` : undefined,
  ].filter(Boolean);

  return [column.type, ...markers].join(" · ");
}

function constraintDetail(
  constraint: SchemaModel["tables"][number]["constraints"][number],
): string {
  if (constraint.kind === "check") {
    return `CHECK (${constraint.expression})`;
  }

  return `${constraint.kind.replace(/_/g, " ")} (${constraint.columns.join(", ")})`;
}

function buildSchemaMindMap(
  schema: SchemaModel,
  projectName: string,
): MindMapNode {
  const tableNodes: MindMapNode[] = schema.tables.map((table) => ({
    id: table.id,
    label:
      table.schema === "public" ? table.name : `${table.schema}.${table.name}`,
    detail: `${table.columns.length} columns${
      table.constraints.length
        ? ` · ${table.constraints.length} constraints`
        : ""
    }${table.comment ? ` · ${table.comment}` : ""}`,
    tone: "tables",
    children: [
      ...table.columns.map((column) => ({
        id: column.id,
        label: column.name,
        detail: columnDetail(column),
        tone: "columns" as const,
        children: [],
      })),
      ...table.constraints.map((constraint) => ({
        id: constraint.id,
        label: constraint.kind.replace(/_/g, " "),
        detail: constraintDetail(constraint),
        tone: "columns" as const,
        children: [],
      })),
    ],
  }));

  const relationshipNodes: MindMapNode[] = schema.relationships.map(
    (relationship) => {
      const source = `${getTableLabel(
        schema,
        relationship.sourceTableId,
      )}.${getColumnLabel(schema, relationship.sourceTableId, relationship.sourceColumnId)}`;
      const target = `${getTableLabel(
        schema,
        relationship.targetTableId,
      )}.${getColumnLabel(schema, relationship.targetTableId, relationship.targetColumnId)}`;

      return {
        id: relationship.id,
        label: `${source} -> ${target}`,
        detail: [
          relationship.constraintName,
          relationship.onDelete
            ? `ON DELETE ${relationship.onDelete}`
            : undefined,
          relationship.onUpdate
            ? `ON UPDATE ${relationship.onUpdate}`
            : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
        tone: "relationships",
        children: [],
      };
    },
  );

  const enumNodes: MindMapNode[] = schema.enums.map((enumeration) => ({
    id: enumeration.id,
    label:
      enumeration.schema === "public"
        ? enumeration.name
        : `${enumeration.schema}.${enumeration.name}`,
    detail: `${enumeration.values.length} values`,
    tone: "enums",
    children: enumeration.values.map((value) => ({
      id: `${enumeration.id}_${value}`,
      label: value,
      tone: "enums" as const,
      children: [],
    })),
  }));

  const indexNodes: MindMapNode[] = schema.indexes.map((index) => ({
    id: index.id,
    label: index.name,
    detail: `${index.unique ? "UNIQUE " : ""}${index.method ?? "btree"} on ${getTableLabel(
      schema,
      index.tableId,
    )} (${index.columns.join(", ")})`,
    tone: "indexes",
    children: [],
  }));

  const unsupportedNodes: MindMapNode[] =
    schema.metadata.unsupportedStatements.map((statement) => ({
      id: statement.id,
      label: statement.reason,
      detail: statement.statement,
      tone: "warnings",
      children: [],
    }));

  return {
    id: "schema-root",
    label: projectName || "SchemaCanvas",
    detail: `${schema.tables.length} tables · ${schema.relationships.length} relationships · ${schema.enums.length} enums · ${schema.indexes.length} indexes`,
    tone: "root",
    children: [
      {
        id: "tables",
        label: "Tables",
        detail: `${tableNodes.length} parsed tables`,
        tone: "tables",
        children: tableNodes,
      },
      {
        id: "relationships",
        label: "Relationships",
        detail: `${relationshipNodes.length} foreign keys`,
        tone: "relationships",
        children: relationshipNodes,
      },
      {
        id: "enums",
        label: "Enums",
        detail: `${enumNodes.length} enum types`,
        tone: "enums",
        children: enumNodes,
      },
      {
        id: "indexes",
        label: "Indexes",
        detail: `${indexNodes.length} indexes`,
        tone: "indexes",
        children: indexNodes,
      },
      {
        id: "unsupported",
        label: "Unsupported SQL",
        detail: `${unsupportedNodes.length} preserved statements`,
        tone: "warnings",
        children: unsupportedNodes,
      },
    ],
  };
}

function mindMapToneClass(tone: MindMapNode["tone"]): string {
  const classes: Record<MindMapNode["tone"], string> = {
    root: "border-sky-400/40 bg-sky-400/15 text-sky-100",
    tables: "border-emerald-400/35 bg-emerald-400/10 text-emerald-100",
    columns: "border-slate-400/25 bg-slate-400/10 text-slate-100",
    relationships: "border-violet-400/35 bg-violet-400/10 text-violet-100",
    enums: "border-amber-400/35 bg-amber-400/10 text-amber-100",
    indexes: "border-rose-400/35 bg-rose-400/10 text-rose-100",
    warnings: "border-red-400/35 bg-red-400/10 text-red-100",
  };

  return classes[tone];
}

function MindMapCard({
  node,
  compact = false,
}: {
  node: MindMapNode;
  compact?: boolean;
}): React.ReactElement {
  return (
    <div
      className={`rounded-md border px-3 py-2 shadow-sm ${mindMapToneClass(node.tone)}`}
    >
      <p
        className={compact ? "text-xs font-semibold" : "text-sm font-semibold"}
      >
        {node.label}
      </p>
      {node.detail ? (
        <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-muted-foreground">
          {node.detail}
        </p>
      ) : null}
    </div>
  );
}

function MindMapBranch({ node }: { node: MindMapNode }): React.ReactElement {
  return (
    <section className="rounded-lg border border-border bg-background/80 p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-px w-8 bg-border" />
        <MindMapCard node={node} />
      </div>

      {node.children.length > 0 ? (
        <div className="space-y-3 border-l border-border/80 pl-4">
          {node.children.map((child) => (
            <div key={child.id} className="relative">
              <div className="absolute -left-4 top-5 h-px w-4 bg-border/80" />
              <MindMapCard node={child} compact />
              {child.children.length > 0 ? (
                <div className="mt-2 space-y-2 border-l border-border/60 pl-4">
                  {child.children.map((grandchild) => (
                    <div key={grandchild.id} className="relative">
                      <div className="absolute -left-4 top-4 h-px w-4 bg-border/60" />
                      <MindMapCard node={grandchild} compact />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No entries in this branch.
        </p>
      )}
    </section>
  );
}

function SchemaMindMap({
  schema,
  projectName,
}: {
  schema: SchemaModel;
  projectName: string;
}): React.ReactElement {
  const mindMap = buildSchemaMindMap(schema, projectName);

  return (
    <div className="min-w-[1180px] bg-background p-6">
      <div className="mx-auto max-w-[1360px]">
        <div className="flex justify-center">
          <div className="min-w-[360px]">
            <MindMapCard node={mindMap} />
          </div>
        </div>
        <div className="mx-auto my-4 h-8 w-px bg-border" />
        <div className="grid grid-cols-2 gap-4">
          {mindMap.children.map((branch) => (
            <MindMapBranch key={branch.id} node={branch} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AstTreeNode({
  node,
  depth = 0,
}: {
  node: SchemaAstNode;
  depth?: number;
}): React.ReactElement {
  const attributes = Object.entries(node.attributes ?? {});

  return (
    <div className="space-y-2">
      <div
        className="rounded-md border border-border bg-background/60 p-3"
        style={{ marginLeft: `${depth * 18}px` }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(node.status)}>{node.status}</Badge>
          <Badge>{formatNodeKind(node.kind)}</Badge>
          <p className="text-sm font-medium text-foreground">{node.label}</p>
          <p className="text-xs text-muted-foreground">line {node.line}</p>
        </div>

        {attributes.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {attributes.map(([key, value]) => (
              <span
                key={key}
                className="rounded border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground"
              >
                <span className="text-foreground">{key}</span>:{" "}
                {formatAttributeValue(value)}
              </span>
            ))}
          </div>
        ) : null}

        {node.raw && node.kind !== "script" ? (
          <pre className="mt-3 max-h-24 overflow-auto whitespace-pre-wrap rounded border border-border/70 bg-card/80 p-2 text-[11px] text-muted-foreground">
            {node.raw}
          </pre>
        ) : null}
      </div>

      {node.children.map((child) => (
        <AstTreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function BottomPanel(): React.ReactElement {
  const astExportRef = useRef<HTMLDivElement>(null);
  const mindMapExportRef = useRef<HTMLDivElement>(null);
  const activeBottomTab = useSchemaWorkspaceStore(
    (state) => state.activeBottomTab,
  );
  const setActiveBottomTab = useSchemaWorkspaceStore(
    (state) => state.setActiveBottomTab,
  );
  const schema = useSchemaWorkspaceStore((state) => state.schema);
  const projectName = useSchemaWorkspaceStore((state) => state.projectName);
  const parserAst = useSchemaWorkspaceStore((state) => state.parserAst);
  const parserErrors = useSchemaWorkspaceStore((state) => state.parserErrors);
  const parserWarnings = useSchemaWorkspaceStore(
    (state) => state.parserWarnings,
  );
  const validationProblems = useSchemaWorkspaceStore(
    (state) => state.validationProblems,
  );
  const migrationPreview = useSchemaWorkspaceStore(
    (state) => state.migrationPreview,
  );
  const migrationSourceLabel = useSchemaWorkspaceStore(
    (state) => state.migrationSourceLabel ?? "Previous version",
  );
  const migrationTargetLabel = useSchemaWorkspaceStore(
    (state) => state.migrationTargetLabel ?? "Current workspace",
  );

  const problems = [...parserErrors, ...parserWarnings, ...validationProblems];
  const docs = getDocumentationExport(schema);
  const json = JSON.stringify(schema, null, 2);
  const generatorCount = 5;
  const migrationStepCount = countMigrationSteps(migrationPreview);
  const fileBaseName =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "schemacanvas";

  const downloadAstJson = (): void => {
    downloadTextFile(
      `${fileBaseName}-ast.json`,
      JSON.stringify(parserAst, null, 2),
      "application/json",
    );
  };

  const downloadAstPng = async (): Promise<void> => {
    if (!astExportRef.current) {
      return;
    }

    const dataUrl = await toPng(astExportRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#020617",
    });
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${fileBaseName}-ast.png`;
    anchor.click();
  };

  const downloadMindMapPng = async (): Promise<void> => {
    if (!mindMapExportRef.current) {
      return;
    }

    const dataUrl = await toPng(mindMapExportRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#020617",
    });
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${fileBaseName}-mind-map.png`;
    anchor.click();
  };

  return (
    <Tabs
      value={activeBottomTab}
      onValueChange={(value) =>
        setActiveBottomTab(value as typeof activeBottomTab)
      }
      className="flex h-full flex-col"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Review</h2>
          <p className="text-xs text-muted-foreground">
            Problems, migration preview, generated docs, parser pipeline, and
            raw schema JSON.
          </p>
        </div>
        <TabsList>
          <TabsTrigger value="problems">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Problems
          </TabsTrigger>
          <TabsTrigger value="migration">
            <Code2 className="mr-2 h-4 w-4" />
            Migration
          </TabsTrigger>
          <TabsTrigger value="documentation">
            <ScrollText className="mr-2 h-4 w-4" />
            Documentation
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <Workflow className="mr-2 h-4 w-4" />
            AST
          </TabsTrigger>
          <TabsTrigger value="mindmap">
            <Network className="mr-2 h-4 w-4" />
            Mind Map
          </TabsTrigger>
          <TabsTrigger value="json">
            <FileJson className="mr-2 h-4 w-4" />
            Schema JSON
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="min-h-0 flex-1">
        <TabsContent value="problems" className="h-full">
          <ScrollArea className="h-full px-4 py-3">
            <div className="space-y-3">
              {problems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No deterministic issues detected.
                </p>
              ) : (
                problems.map((problem) => (
                  <div
                    key={problem.id}
                    className="rounded-md border border-border bg-background/60 p-3"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {problem.message}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                      {problem.severity} · {problem.code}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="migration" className="h-full">
          <ScrollArea className="h-full px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/70 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Migration diff
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {migrationSourceLabel} -&gt; {migrationTargetLabel}
                  </p>
                </div>
                <Badge variant={migrationStepCount > 0 ? "info" : "default"}>
                  {migrationStepCount} SQL{" "}
                  {migrationStepCount === 1 ? "step" : "steps"}
                </Badge>
              </div>
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-background/70 p-4 text-xs text-foreground">
                {migrationPreview}
              </pre>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="documentation" className="h-full">
          <ScrollArea className="h-full px-4 py-3">
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-background/70 p-4 text-xs text-foreground">
              {docs}
            </pre>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="pipeline" className="h-full">
          <ScrollArea className="h-full px-4 py-3">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/70 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Parser artifact
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Download the current AST as a visual PNG or structured JSON.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void downloadAstPng()}
                  >
                    <ImageDown className="h-4 w-4" />
                    Download PNG
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadAstJson}>
                    <Download className="h-4 w-4" />
                    Download JSON
                  </Button>
                </div>
              </div>

              <div ref={astExportRef} className="space-y-4 bg-background p-1">
                <div className="grid gap-3 md:grid-cols-5">
                  <div className="rounded-md border border-border bg-background/70 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Code2 className="h-4 w-4 text-sky-300" />
                      SQL
                    </div>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {parserAst.statementCount}
                    </p>
                    <p className="text-xs text-muted-foreground">statements</p>
                  </div>

                  <div className="rounded-md border border-border bg-background/70 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Workflow className="h-4 w-4 text-emerald-300" />
                      Parser
                    </div>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {parserAst.supportedStatementCount}
                    </p>
                    <p className="text-xs text-muted-foreground">supported</p>
                  </div>

                  <div className="rounded-md border border-border bg-background/70 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Braces className="h-4 w-4 text-violet-300" />
                      AST
                    </div>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {parserAst.root.children.length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      root children
                    </p>
                  </div>

                  <div className="rounded-md border border-border bg-background/70 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Database className="h-4 w-4 text-amber-300" />
                      SchemaModel
                    </div>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {schema.tables.length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      tables · {schema.relationships.length} relationships
                    </p>
                  </div>

                  <div className="rounded-md border border-border bg-background/70 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <FileJson className="h-4 w-4 text-rose-300" />
                      Generators
                    </div>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {generatorCount}
                    </p>
                    <p className="text-xs text-muted-foreground">outputs</p>
                  </div>
                </div>

                <div className="rounded-md border border-border bg-background/70 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="info">
                      SQL -&gt; Parser -&gt; AST -&gt; SchemaModel -&gt;
                      Generators
                    </Badge>
                    {parserAst.unsupportedStatementCount > 0 ? (
                      <Badge variant="warning">
                        {parserAst.unsupportedStatementCount} unsupported
                        preserved
                      </Badge>
                    ) : null}
                  </div>
                  <AstTreeNode node={parserAst.root} />
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="mindmap" className="h-full">
          <ScrollArea className="h-full px-4 py-3">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/70 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    SQL mind map
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A downloadable PNG overview generated from the entire parsed
                    SQL.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void downloadMindMapPng()}
                >
                  <ImageDown className="h-4 w-4" />
                  Download Mind Map PNG
                </Button>
              </div>

              <div
                ref={mindMapExportRef}
                className="overflow-hidden rounded-md border border-border bg-background"
              >
                <SchemaMindMap schema={schema} projectName={projectName} />
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="json" className="h-full">
          <ScrollArea className="h-full px-4 py-3">
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-background/70 p-4 text-xs text-foreground">
              {json}
            </pre>
          </ScrollArea>
        </TabsContent>
      </div>
    </Tabs>
  );
}
