"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node
} from "@xyflow/react";
import { toast } from "sonner";
import { TableNode } from "@/components/canvas/table-node";
import { RelationshipEdge } from "@/components/canvas/relationship-edge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";

const nodeTypes = {
  tableNode: TableNode
};

const edgeTypes = {
  relationship: RelationshipEdge
};

interface SchemaCanvasProps {
  exportRef: React.RefObject<HTMLDivElement | null>;
}

function SchemaCanvasInner({
  exportRef
}: SchemaCanvasProps): React.ReactElement {
  const schema = useSchemaWorkspaceStore((state) => state.schema);
  const selection = useSchemaWorkspaceStore((state) => state.selection);
  const selectRelationship = useSchemaWorkspaceStore(
    (state) => state.selectRelationship
  );
  const selectTable = useSchemaWorkspaceStore((state) => state.selectTable);
  const addTable = useSchemaWorkspaceStore((state) => state.addTable);
  const addForeignKey = useSchemaWorkspaceStore((state) => state.addForeignKey);
  const updateTablePosition = useSchemaWorkspaceStore(
    (state) => state.updateTablePosition
  );
  const updateViewport = useSchemaWorkspaceStore((state) => state.updateViewport);

  const nodes = useMemo<Node[]>(
    () =>
      schema.tables.map((table) => ({
        id: table.id,
        type: "tableNode",
        position: schema.layout[table.id] ?? { x: 0, y: 0 },
        data: { tableId: table.id },
        selected: selection.tableId === table.id
      })),
    [schema.layout, schema.tables, selection.tableId]
  );

  const edges = useMemo<Edge[]>(
    () =>
      schema.relationships.map((relationship) => ({
        id: relationship.id,
        type: "relationship",
        source: relationship.sourceTableId,
        target: relationship.targetTableId,
        sourceHandle: relationship.sourceColumnId,
        targetHandle: relationship.targetColumnId,
        selected: selection.relationshipId === relationship.id,
        animated: true
      })),
    [schema.relationships, selection.relationshipId]
  );

  const handleConnect = (connection: Connection): void => {
    if (
      !connection.source ||
      !connection.target ||
      !connection.sourceHandle ||
      !connection.targetHandle
    ) {
      return;
    }

    const sourceTable = schema.tables.find((table) => table.id === connection.source);
    const targetTable = schema.tables.find((table) => table.id === connection.target);
    const sourceColumn = sourceTable?.columns.find(
      (column) => column.id === connection.sourceHandle
    );
    const targetColumn = targetTable?.columns.find(
      (column) => column.id === connection.targetHandle
    );

    if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) {
      toast.error("The selected relationship endpoints are invalid.");
      return;
    }

    if (sourceColumn.type !== targetColumn.type) {
      toast.error("Foreign key source and target column types must match.");
      return;
    }

    try {
      addForeignKey(
        connection.source,
        connection.sourceHandle,
        connection.target,
        connection.targetHandle
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create relationship.");
    }
  };

  return (
    <div ref={exportRef} className="relative h-full w-full grid-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={handleConnect}
        onPaneClick={() => selectTable(undefined)}
        onEdgeClick={(_, edge) => selectRelationship(edge.id)}
        onNodeDragStop={(_, node) =>
          updateTablePosition(node.id, {
            x: node.position.x,
            y: node.position.y
          })
        }
        onMoveEnd={(_, viewport) =>
          updateViewport({
            x: viewport.x,
            y: viewport.y,
            zoom: viewport.zoom
          })
        }
        defaultViewport={schema.metadata.viewport}
        fitView={schema.tables.length > 0}
        minZoom={0.2}
        maxZoom={1.8}
        snapToGrid
        snapGrid={[16, 16]}
      >
        <Background
          gap={24}
          size={1}
          variant={BackgroundVariant.Dots}
          color="rgba(148, 163, 184, 0.18)"
        />
        <MiniMap
          pannable
          zoomable
          style={{
            background: "rgba(2, 6, 23, 0.9)",
            border: "1px solid rgba(51, 65, 85, 0.8)"
          }}
          maskColor="rgba(15, 23, 42, 0.55)"
        />
        <Controls
          className="!rounded-md !border !border-border !bg-card/90 !shadow-panel"
          showInteractive={false}
        />
      </ReactFlow>

      {schema.tables.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto max-w-md rounded-lg border border-border bg-card/90 p-6 text-center shadow-panel">
            <p className="text-base font-semibold text-foreground">
              Start by writing SQL, importing a .sql file, or creating your first
              table visually.
            </p>
            <Button className="mt-4" onClick={addTable}>
              <Plus className="h-4 w-4" />
              Create table
            </Button>
          </div>
        </div>
      ) : null}
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
