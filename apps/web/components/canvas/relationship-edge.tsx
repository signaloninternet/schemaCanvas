"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps
} from "@xyflow/react";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";

export interface RelationshipEdgeData extends Record<string, unknown> {
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  suggested: boolean;
}

export function RelationshipEdge({
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition
}: EdgeProps): React.ReactElement {
  const edgeData = (data as unknown as RelationshipEdgeData | undefined) ?? {
    sourceTableId: "",
    sourceColumnId: "",
    targetTableId: "",
    targetColumnId: "",
    suggested: false
  };
  const hoveredCol = useSchemaWorkspaceStore((state) => state.hoveredCol);

  const isHighlighted =
    hoveredCol != null &&
    ((hoveredCol.tableId === edgeData.sourceTableId &&
      hoveredCol.columnId === edgeData.sourceColumnId) ||
      (hoveredCol.tableId === edgeData.targetTableId &&
        hoveredCol.columnId === edgeData.targetColumnId));

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition
  });

  const stroke = isHighlighted ? "var(--accent)" : "var(--ink-4)";
  const strokeWidth = isHighlighted ? 2 : 1.25;
  const opacity = isHighlighted ? 1 : 0.55;

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke,
          strokeWidth,
          opacity,
          strokeDasharray: edgeData.suggested ? "4 3" : undefined,
          fill: "none",
          transition:
            "stroke 120ms ease, stroke-width 120ms ease, opacity 120ms ease"
        }}
      />
      <circle
        cx={sourceX}
        cy={sourceY}
        r={3.5}
        fill="var(--bg-elev)"
        stroke={stroke}
        strokeWidth={1.25}
        style={{ opacity }}
      />
      <circle
        cx={targetX}
        cy={targetY}
        r={3.5}
        fill="var(--bg-elev)"
        stroke={stroke}
        strokeWidth={1.25}
        style={{ opacity }}
      />
      {edgeData.suggested ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "var(--warn)",
              background: "var(--bg-elev)",
              border: "1px dashed var(--warn)",
              borderRadius: "9px",
              padding: "2px 8px",
              textTransform: "uppercase"
            }}
          >
            Suggested
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
