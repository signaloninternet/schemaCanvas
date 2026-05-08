"use client";

import { useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { AlertTriangle, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";

export function SqlEditorPanel(): React.ReactElement {
  const sqlDraft = useSchemaWorkspaceStore((state) => state.sqlDraft);
  const parserErrors = useSchemaWorkspaceStore((state) => state.parserErrors);
  const parserWarnings = useSchemaWorkspaceStore(
    (state) => state.parserWarnings,
  );
  const setSqlDraft = useSchemaWorkspaceStore((state) => state.setSqlDraft);
  const parseSql = useSchemaWorkspaceStore((state) => state.parseSql);
  const formatSql = useSchemaWorkspaceStore((state) => state.formatSql);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      parseSql();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [sqlDraft, parseSql]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              SQL editor
            </h2>
            <p className="text-xs text-muted-foreground">
              PostgreSQL DDL with live parsing and last-valid-schema protection.
            </p>
          </div>
          {parserErrors.length > 0 ? (
            <Badge variant="destructive">{parserErrors.length} errors</Badge>
          ) : parserWarnings.length > 0 ? (
            <Badge variant="warning">{parserWarnings.length} warnings</Badge>
          ) : (
            <Badge variant="success">Synced</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={formatSql}>
            <Sparkles className="h-4 w-4" />
            Format
          </Button>
          <Button variant="secondary" size="sm" onClick={parseSql}>
            <Play className="h-4 w-4" />
            Parse
          </Button>
        </div>
      </div>
      {parserErrors[0] ? (
        <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          <AlertTriangle className="h-4 w-4" />
          <span>
            {parserErrors[0].message}
            {parserErrors[0].location?.line
              ? ` Line ${parserErrors[0].location.line}.`
              : null}
          </span>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto">
        <CodeMirror
          value={sqlDraft}
          className="h-full"
          height="100%"
          theme="dark"
          extensions={[sql({ dialect: PostgreSQL })]}
          basicSetup={{
            autocompletion: true,
            lineNumbers: true,
            foldGutter: true,
          }}
          onChange={(value) => setSqlDraft(value)}
        />
      </div>
    </div>
  );
}
