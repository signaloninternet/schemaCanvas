"use client";

import type { SchemaAstNode } from "@schemacanvas/schema-core";
import {
  AlertTriangle,
  Braces,
  Code2,
  Database,
  FileJson,
  ScrollText,
  Workflow,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useSchemaWorkspaceStore,
  getDocumentationExport,
} from "@/lib/schema-workspace-store";

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
  const activeBottomTab = useSchemaWorkspaceStore(
    (state) => state.activeBottomTab,
  );
  const setActiveBottomTab = useSchemaWorkspaceStore(
    (state) => state.setActiveBottomTab,
  );
  const schema = useSchemaWorkspaceStore((state) => state.schema);
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

  const problems = [...parserErrors, ...parserWarnings, ...validationProblems];
  const docs = getDocumentationExport(schema);
  const json = JSON.stringify(schema, null, 2);
  const generatorCount = 5;

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
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-background/70 p-4 text-xs text-foreground">
              {migrationPreview}
            </pre>
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
                  <p className="text-xs text-muted-foreground">root children</p>
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
