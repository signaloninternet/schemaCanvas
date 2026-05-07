"use client";

import { AlertTriangle, Code2, FileJson, ScrollText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSchemaWorkspaceStore, getDocumentationExport } from "@/lib/schema-workspace-store";

export function BottomPanel(): React.ReactElement {
  const activeBottomTab = useSchemaWorkspaceStore((state) => state.activeBottomTab);
  const setActiveBottomTab = useSchemaWorkspaceStore((state) => state.setActiveBottomTab);
  const schema = useSchemaWorkspaceStore((state) => state.schema);
  const parserErrors = useSchemaWorkspaceStore((state) => state.parserErrors);
  const parserWarnings = useSchemaWorkspaceStore((state) => state.parserWarnings);
  const validationProblems = useSchemaWorkspaceStore(
    (state) => state.validationProblems
  );
  const migrationPreview = useSchemaWorkspaceStore((state) => state.migrationPreview);

  const problems = [...parserErrors, ...parserWarnings, ...validationProblems];
  const docs = getDocumentationExport(schema);
  const json = JSON.stringify(schema, null, 2);

  return (
    <Tabs
      value={activeBottomTab}
      onValueChange={(value) => setActiveBottomTab(value as typeof activeBottomTab)}
      className="flex h-full flex-col"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Review</h2>
          <p className="text-xs text-muted-foreground">
            Problems, migration preview, generated docs, and raw schema JSON.
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
