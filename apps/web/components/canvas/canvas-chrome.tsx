"use client";

import { useReactFlow, useViewport } from "@xyflow/react";
import { AlertTriangle, Maximize2, Minus, Plus } from "lucide-react";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";
import { useProblems } from "@/lib/problems";

export function ProblemPill(): React.ReactElement | null {
  const problems = useProblems();
  const schemaTables = useSchemaWorkspaceStore((state) => state.schema.tables);
  const setHoveredCol = useSchemaWorkspaceStore(
    (state) => state.setHoveredCol
  );
  const jumpToLine = useSchemaWorkspaceStore((state) => state.jumpToLine);
  const setActiveBottomTab = useSchemaWorkspaceStore(
    (state) => state.setActiveBottomTab
  );

  // Surface the most-severe first problem: errors > warnings > info.
  const ranked = [...problems].sort((a, b) => {
    const weight = (k: typeof a.kind) =>
      k === "error" ? 0 : k === "warn" ? 1 : 2;
    return weight(a.kind) - weight(b.kind);
  });
  const problem = ranked[0];
  if (!problem) {
    return null;
  }

  const tableId = problem.tableId;
  const columnId = problem.columnId;
  const table = tableId
    ? schemaTables.find((t) => t.id === tableId)
    : undefined;
  const column =
    table && columnId
      ? table.columns.find((c) => c.id === columnId)
      : undefined;

  const summary = problem.title
    ? problem.title.split(".")[0] ?? problem.title
    : `${problem.code} flagged`;
  const meta = column ? `${table?.name}.${column.name}` : table?.name ?? "";

  const onActivate = (): void => {
    if (typeof problem.line === "number") {
      jumpToLine(problem.line);
    }
    setActiveBottomTab("problems");
  };

  return (
    <button
      type="button"
      className="problem-pill"
      onClick={onActivate}
      onMouseEnter={() => {
        if (tableId && columnId) {
          setHoveredCol({ tableId, columnId });
        }
      }}
      onMouseLeave={() => setHoveredCol(null)}
      title={problem.title}
    >
      <span className="ico">
        <AlertTriangle size={11} strokeWidth={1.75} />
      </span>
      <span>{summary}</span>
      {meta ? <span className="meta">{meta}</span> : null}
      <span className="kbd">↵</span>
    </button>
  );
}

export function KbdHint(): React.ReactElement {
  return (
    <div className="kbd-hint">
      <span className="kbd">⌘</span>
      <span>+ scroll to zoom · drag to pan</span>
    </div>
  );
}

export function ZoomCluster(): React.ReactElement {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <div className="zoom-cluster">
      <button
        type="button"
        title="Zoom out"
        aria-label="Zoom out"
        onClick={() => zoomOut({ duration: 200 })}
      >
        <Minus size={13} strokeWidth={1.5} />
      </button>
      <div className="lbl">{Math.round(zoom * 100)}%</div>
      <button
        type="button"
        title="Zoom in"
        aria-label="Zoom in"
        onClick={() => zoomIn({ duration: 200 })}
      >
        <Plus size={13} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        title="Fit to view"
        aria-label="Fit to view"
        onClick={() => fitView({ padding: 0.2, duration: 350 })}
      >
        <Maximize2 size={13} strokeWidth={1.5} />
      </button>
    </div>
  );
}
