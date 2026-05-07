"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

export function RelationshipEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected
}: EdgeProps): React.ReactElement {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition
  });

  return (
    <BaseEdge
      path={edgePath}
      style={{
        stroke: selected ? "rgba(125, 211, 252, 0.98)" : "rgba(96, 165, 250, 0.7)",
        strokeWidth: selected ? 3 : 2,
        filter: selected ? "drop-shadow(0 0 12px rgba(56, 189, 248, 0.4))" : undefined
      }}
    />
  );
}
