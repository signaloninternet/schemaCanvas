"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type OnNodeDrag
} from "@xyflow/react";
import { Download, LayoutGrid, Maximize2, Minimize2 } from "lucide-react";
import { TableNode, type TableNodeData } from "@/components/canvas/table-node";
import {
  RelationshipEdge,
  type RelationshipEdgeData
} from "@/components/canvas/relationship-edge";
import {
  ProblemPill,
  ZoomCluster
} from "@/components/canvas/canvas-chrome";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";
import { tableColorForName, type TableColorName } from "@/lib/table-colors";
import { inferSuggestedFKs } from "@/lib/canvas-suggestions";

const nodeTypes = {
  tableNode: TableNode
};

const edgeTypes = {
  relationship: RelationshipEdge
};

interface SchemaCanvasProps {
  exportRef: React.RefObject<HTMLDivElement | null>;
}

interface CanvasPaneProps extends SchemaCanvasProps {
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

const TABLE_COLOR_HEX_LIGHT: Record<TableColorName, string> = {
  green: "#581c87",
  blue: "#2563eb",
  yellow: "#f97316"
};

function FitViewBridge(): null {
  const { fitView } = useReactFlow();
  const fitViewVersion = useSchemaWorkspaceStore(
    (state) => state.fitViewVersion
  );
  const lastVersion = useRef(fitViewVersion);
  useEffect(() => {
    if (fitViewVersion !== lastVersion.current) {
      lastVersion.current = fitViewVersion;
      void fitView({ padding: 0.2, duration: 350 });
    }
  }, [fitView, fitViewVersion]);
  return null;
}

function SchemaCanvasInner({
  exportRef
}: SchemaCanvasProps): React.ReactElement {
  const schema = useSchemaWorkspaceStore((state) => state.schema);
  const updateTablePosition = useSchemaWorkspaceStore(
    (state) => state.updateTablePosition
  );
  const updateViewport = useSchemaWorkspaceStore(
    (state) => state.updateViewport
  );
  const updateDraggedNodePosition = useCallback<OnNodeDrag<Node<TableNodeData>>>(
    (_, node) => {
      updateTablePosition(node.id, {
        x: node.position.x,
        y: node.position.y
      });
    },
    [updateTablePosition]
  );

  const colorByTableId = useMemo(() => {
    const map = new Map<string, TableColorName>();
    schema.tables.forEach((table, index) => {
      map.set(table.id, tableColorForName(table.name, index));
    });
    return map;
  }, [schema.tables]);

  const nodes = useMemo<Node<TableNodeData>[]>(
    () =>
      schema.tables.map((table) => ({
        id: table.id,
        type: "tableNode",
        position: schema.layout[table.id] ?? { x: 0, y: 0 },
        data: {
          tableId: table.id,
          color: colorByTableId.get(table.id) ?? "green"
        },
        draggable: true,
        selectable: true
      })),
    [schema.tables, schema.layout, colorByTableId]
  );

  const edges = useMemo<Edge<RelationshipEdgeData>[]>(() => {
    const out: Edge<RelationshipEdgeData>[] = [];
    const positions = schema.layout;

    const declaredAndSuggested: Array<{
      id: string;
      sourceTableId: string;
      sourceColumnId: string;
      targetTableId: string;
      targetColumnId: string;
      suggested: boolean;
    }> = [
      ...schema.relationships.map((rel) => ({
        id: rel.id,
        sourceTableId: rel.sourceTableId,
        sourceColumnId: rel.sourceColumnId,
        targetTableId: rel.targetTableId,
        targetColumnId: rel.targetColumnId,
        suggested: false
      })),
      ...inferSuggestedFKs(schema).map((s) => ({
        id: s.id,
        sourceTableId: s.sourceTableId,
        sourceColumnId: s.sourceColumnId,
        targetTableId: s.targetTableId,
        targetColumnId: s.targetColumnId,
        suggested: true
      }))
    ];

    for (const rel of declaredAndSuggested) {
      const sourcePos = positions[rel.sourceTableId];
      const targetPos = positions[rel.targetTableId];
      if (!sourcePos || !targetPos) {
        continue;
      }
      const sourceOnRight = targetPos.x > sourcePos.x;
      const targetOnRight = sourcePos.x > targetPos.x;
      out.push({
        id: rel.id,
        type: "relationship",
        source: rel.sourceTableId,
        target: rel.targetTableId,
        sourceHandle: `${rel.sourceColumnId}-source-${sourceOnRight ? "r" : "l"}`,
        targetHandle: `${rel.targetColumnId}-target-${targetOnRight ? "r" : "l"}`,
        data: rel,
        zIndex: rel.suggested ? 0 : 1
      });
    }
    return out;
  }, [schema]);

  return (
    <div className="canvas-wrap" ref={exportRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDrag={updateDraggedNodePosition}
        onNodeDragStop={updateDraggedNodePosition}
        onMoveEnd={(_, viewport) =>
          updateViewport({
            x: viewport.x,
            y: viewport.y,
            zoom: viewport.zoom
          })
        }
        defaultViewport={schema.metadata.viewport}
        fitView={schema.tables.length > 0}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={2}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        panOnDrag
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--bg-canvas-grid)"
        />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor={(node) => {
            const color = (node.data as unknown as TableNodeData | undefined)
              ?.color;
            return color ? TABLE_COLOR_HEX_LIGHT[color] : "#581c87";
          }}
          nodeStrokeWidth={0}
          nodeBorderRadius={2}
          maskStrokeColor="var(--accent)"
          maskStrokeWidth={1.5}
          ariaLabel="Canvas minimap"
        />
        <FitViewBridge />
      </ReactFlow>

      <div className="canvas-chrome-tl">
        <ProblemPill />
      </div>
      <div className="canvas-chrome-bl">
        <ZoomCluster />
      </div>
    </div>
  );
}

export function SchemaCanvas({
  exportRef
}: SchemaCanvasProps): React.ReactElement {
  return (
    <ReactFlowProvider>
      <SchemaCanvasInner exportRef={exportRef} />
    </ReactFlowProvider>
  );
}

export function CanvasPane({
  exportRef,
  expanded = false,
  onToggleExpanded
}: CanvasPaneProps): React.ReactElement {
  const schema = useSchemaWorkspaceStore((state) => state.schema);
  const autoLayout = useSchemaWorkspaceStore((state) => state.autoLayout);
  const sqlDraft = useSchemaWorkspaceStore((state) => state.sqlDraft);
  const projectName = useSchemaWorkspaceStore((state) => state.projectName);
  const totalRelationships =
    schema.relationships.length + inferSuggestedFKs(schema).length;

  const exportSql = (): void => {
    const filename = `${projectName.toLowerCase().replace(/\s+/g, "-") || "schema"}.sql`;
    const blob = new Blob([sqlDraft], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pane">
      <div className="pane-hdr">
        <div className="title">
          <LayoutGrid size={13} strokeWidth={1.5} className="ico" />
          <span>Canvas</span>
          <span className="chip chip-muted">
            {schema.tables.length} tables · {totalRelationships} relationships
          </span>
        </div>
        <div className="grow" />
        {onToggleExpanded ? (
          <button
            type="button"
            className="btn btn-soft"
            onClick={onToggleExpanded}
            aria-pressed={expanded}
            title={expanded ? "Exit expanded canvas" : "Expand canvas"}
          >
            {expanded ? (
              <Minimize2 size={13} strokeWidth={1.5} />
            ) : (
              <Maximize2 size={13} strokeWidth={1.5} />
            )}
            {expanded ? "Exit" : "Expand"}
          </button>
        ) : null}
        <button type="button" className="btn" onClick={autoLayout}>
          <LayoutGrid size={13} strokeWidth={1.5} />
          Auto-layout
        </button>
        <button type="button" className="btn" onClick={exportSql}>
          <Download size={13} strokeWidth={1.5} />
          Export
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <SchemaCanvas exportRef={exportRef} />
      </div>
    </div>
  );
}
