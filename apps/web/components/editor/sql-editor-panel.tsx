"use client";

import { useEffect, useMemo } from "react";
import { FileText, Play, ShieldCheck, Wand2 } from "lucide-react";
import { SqlEditor } from "@/components/editor/sql-editor";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";

export function SqlEditorPanel(): React.ReactElement {
  const sqlDraft = useSchemaWorkspaceStore((state) => state.sqlDraft);
  const parserErrors = useSchemaWorkspaceStore((state) => state.parserErrors);
  const parserWarnings = useSchemaWorkspaceStore(
    (state) => state.parserWarnings
  );
  const validationProblems = useSchemaWorkspaceStore(
    (state) => state.validationProblems
  );
  const setSqlDraft = useSchemaWorkspaceStore((state) => state.setSqlDraft);
  const parseSql = useSchemaWorkspaceStore((state) => state.parseSql);
  const formatSql = useSchemaWorkspaceStore((state) => state.formatSql);
  const validateCurrent = useSchemaWorkspaceStore(
    (state) => state.validateCurrent
  );
  const jumpedLine = useSchemaWorkspaceStore((state) => state.jumpedLine);

  // Debounced live parse — same pipeline as before, just relocated.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      parseSql();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [sqlDraft, parseSql]);

  const flaggedLines = useMemo(() => {
    const set = new Set<number>();
    for (const problem of [
      ...parserErrors,
      ...parserWarnings,
      ...validationProblems
    ]) {
      const line = problem.location?.line;
      if (typeof line === "number" && line > 0) {
        set.add(line);
      }
    }
    return Array.from(set);
  }, [parserErrors, parserWarnings, validationProblems]);

  const status: "ok" | "warn" | "err" =
    parserErrors.length > 0
      ? "err"
      : parserWarnings.length + validationProblems.length > 0
        ? "warn"
        : "ok";

  const chipLabel =
    status === "err"
      ? `${parserErrors.length} ERROR${parserErrors.length === 1 ? "" : "S"}`
      : status === "warn"
        ? `${parserWarnings.length + validationProblems.length} WARN`
        : "SYNCED";

  const chipClass =
    status === "err" ? "chip chip-err" : status === "warn" ? "chip chip-warn" : "chip chip-ok";

  return (
    <div className="pane">
      <div className="pane-hdr">
        <div className="title">
          <FileText size={13} strokeWidth={1.5} className="ico" />
          <span>schema.sql</span>
          <span className={chipClass}>{chipLabel}</span>
        </div>
        <div className="grow" />
        <button type="button" className="btn" onClick={formatSql}>
          <Wand2 size={13} strokeWidth={1.5} />
          Format
          <span className="kbd">⇧⌥F</span>
        </button>
        <button
          type="button"
          className="btn btn-soft"
          onClick={validateCurrent}
        >
          <ShieldCheck size={13} strokeWidth={1.5} />
          Validate
        </button>
        <button type="button" className="btn btn-primary" onClick={parseSql}>
          <Play size={12} strokeWidth={1.5} />
          Parse
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <SqlEditor
          source={sqlDraft}
          onChange={setSqlDraft}
          flaggedLines={flaggedLines}
          jumpedLine={jumpedLine}
          onFormat={formatSql}
        />
      </div>
    </div>
  );
}
