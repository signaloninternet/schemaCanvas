"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  CircleDot,
  KeyRound,
  Link2,
  Plus,
  Table2,
  Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";

function TableNodeComponent({
  data,
  selected
}: NodeProps): React.ReactElement | null {
  const tableId = (data as { tableId?: string }).tableId;
  if (!tableId) {
    return null;
  }
  const table = useSchemaWorkspaceStore((state) =>
    state.schema.tables.find((item) => item.id === tableId)
  );
  const selection = useSchemaWorkspaceStore((state) => state.selection);
  const selectTable = useSchemaWorkspaceStore((state) => state.selectTable);
  const selectColumn = useSchemaWorkspaceStore((state) => state.selectColumn);
  const addColumn = useSchemaWorkspaceStore((state) => state.addColumn);
  const deleteTable = useSchemaWorkspaceStore((state) => state.deleteTable);

  if (!table) {
    return null;
  }

  return (
    <div
      className={cn(
        "w-[304px] overflow-hidden rounded-lg border bg-card/95 shadow-panel transition-all",
        selected ? "border-sky-400/70 shadow-glow" : "border-border/80"
      )}
      onClick={() => selectTable(table.id)}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-sky-300" />
            <p className="truncate text-sm font-semibold text-foreground">
              {table.name}
            </p>
          </div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {table.schema}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="info">{table.columns.length} cols</Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(event) => {
              event.stopPropagation();
              deleteTable(table.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {table.columns.map((column, index) => {
          const isSelected =
            selection.tableId === table.id && selection.columnId === column.id;
          const hasReference = Boolean(column.references);
          return (
            <div
              key={column.id}
              className={cn(
                "group relative flex min-h-9 items-center gap-3 px-4 py-2 transition-colors",
                isSelected ? "bg-sky-500/10" : "hover:bg-accent/70"
              )}
              onClick={(event) => {
                event.stopPropagation();
                selectColumn(table.id, column.id);
              }}
              role="button"
              tabIndex={0}
            >
              <Handle
                type="target"
                id={column.id}
                position={Position.Left}
                style={{ top: 18 + index * 41, left: -5 }}
              />
              <Handle
                type="source"
                id={column.id}
                position={Position.Right}
                style={{ top: 18 + index * 41, right: -5 }}
              />
              <div className="flex w-4 justify-center">
                {column.primaryKey ? (
                  <KeyRound className="h-4 w-4 text-amber-300" />
                ) : hasReference ? (
                  <Link2 className="h-4 w-4 text-sky-300" />
                ) : (
                  <CircleDot className="h-3.5 w-3.5 text-muted-foreground/70" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{column.name}</p>
                <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                  {column.type}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1">
                {!column.nullable ? <Badge>NN</Badge> : null}
                {column.unique ? <Badge variant="warning">UQ</Badge> : null}
                {column.defaultValue ? <Badge variant="success">DF</Badge> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border/80 p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={(event) => {
            event.stopPropagation();
            addColumn(table.id);
          }}
        >
          <Plus className="h-4 w-4" />
          Add column
        </Button>
      </div>
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
