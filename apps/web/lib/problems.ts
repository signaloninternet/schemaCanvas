import { useMemo } from "react";
import type { SchemaProblem } from "@schemacanvas/schema-core";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";

export type ProblemKind = "error" | "warn" | "info";

export interface UnifiedProblem {
  id: string;
  kind: ProblemKind;
  code: string;
  title: string;
  line?: number;
  tableId?: string;
  columnId?: string;
}

function mapKind(severity: SchemaProblem["severity"]): ProblemKind {
  if (severity === "error") {
    return "error";
  }
  if (severity === "warning") {
    return "warn";
  }
  return "info";
}

function toUnified(problem: SchemaProblem): UnifiedProblem {
  return {
    id: problem.id,
    kind: mapKind(problem.severity),
    code: problem.code,
    title: problem.message,
    line: problem.location?.line,
    tableId: problem.location?.tableId,
    columnId: problem.location?.columnId
  };
}

/**
 * Unified problem stream surfaced by the bottom Review panel and the
 * floating Problem Pill on the canvas. Reads from the three real sources
 * in the workspace store and normalises them into a single shape.
 */
export function useProblems(): UnifiedProblem[] {
  const parserErrors = useSchemaWorkspaceStore((state) => state.parserErrors);
  const parserWarnings = useSchemaWorkspaceStore(
    (state) => state.parserWarnings
  );
  const validationProblems = useSchemaWorkspaceStore(
    (state) => state.validationProblems
  );

  return useMemo(
    () => [
      ...parserErrors.map(toUnified),
      ...parserWarnings.map(toUnified),
      ...validationProblems.map(toUnified)
    ],
    [parserErrors, parserWarnings, validationProblems]
  );
}
