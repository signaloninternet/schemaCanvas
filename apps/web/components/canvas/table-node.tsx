"use client";

import { memo, type CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Calendar,
  CirclePlus,
  Hash,
  KeyRound,
  Link2,
  Type,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";
import type { TableColorName } from "@/lib/table-colors";

export const TABLE_NODE_HEADER_H = 37;
export const TABLE_NODE_COL_H = 32;
export const TABLE_NODE_W = 232;

export interface TableNodeData extends Record<string, unknown> {
  tableId: string;
  color: TableColorName;
}

function colTypeIcon(column: {
  primaryKey: boolean;
  type: string;
  references?: unknown;
}): LucideIcon {
  if (column.primaryKey) {
    return KeyRound;
  }
  if (column.references) {
    return Link2;
  }
  const lowered = column.type.toLowerCase();
  if (
    lowered.includes("int") ||
    lowered.includes("numeric") ||
    lowered.includes("decimal") ||
    lowered.includes("real") ||
    lowered.includes("double")
  ) {
    return CirclePlus;
  }
  if (lowered.includes("time") || lowered.includes("date")) {
    return Calendar;
  }
  if (lowered.includes("uuid")) {
    return Hash;
  }
  return Type;
}

function TableNodeComponent({
  data,
  selected
}: NodeProps): React.ReactElement | null {
  const { tableId, color } = data as unknown as TableNodeData;
  const table = useSchemaWorkspaceStore((state) =>
    state.schema.tables.find((t) => t.id === tableId)
  );
  const cardStyle = useSchemaWorkspaceStore((state) => state.cardStyle);
  const hoveredCol = useSchemaWorkspaceStore((state) => state.hoveredCol);
  const setHoveredCol = useSchemaWorkspaceStore(
    (state) => state.setHoveredCol
  );
  const relationships = useSchemaWorkspaceStore(
    (state) => state.schema.relationships
  );
  const selectTable = useSchemaWorkspaceStore((state) => state.selectTable);

  if (!table) {
    return null;
  }

  // A column is highlighted when:
  // - it's the directly-hovered column, OR
  // - the hovered column has an FK relationship to/from this column.
  const highlightedColIds = new Set<string>();
  if (hoveredCol) {
    if (hoveredCol.tableId === table.id) {
      highlightedColIds.add(hoveredCol.columnId);
    }
    for (const rel of relationships) {
      const matchSrc =
        rel.sourceTableId === hoveredCol.tableId &&
        rel.sourceColumnId === hoveredCol.columnId;
      const matchTgt =
        rel.targetTableId === hoveredCol.tableId &&
        rel.targetColumnId === hoveredCol.columnId;
      if (matchSrc && rel.targetTableId === table.id) {
        highlightedColIds.add(rel.targetColumnId);
      }
      if (matchTgt && rel.sourceTableId === table.id) {
        highlightedColIds.add(rel.sourceColumnId);
      }
    }
  }

  const isRelated =
    selected ||
    (hoveredCol != null &&
      (hoveredCol.tableId === table.id || highlightedColIds.size > 0));

  const cardVars: CSSProperties = {
    ["--tbl-color" as string]: `var(--tbl-${color})`,
    ["--tbl-soft" as string]: `var(--tbl-${color}-soft)`
  };

  return (
    <div
      className={cn("tbl", isRelated && "is-related")}
      data-style={cardStyle}
      style={cardVars}
      onClick={(event) => {
        event.stopPropagation();
        selectTable(table.id);
      }}
    >
      <div className="tbl-head">
        <span className="dot" />
        <span>{table.name}</span>
        <span className="schema">{table.schema}</span>
      </div>
      <div className="tbl-cols">
        {table.columns.map((column, index) => {
          const top = TABLE_NODE_HEADER_H + index * TABLE_NODE_COL_H + TABLE_NODE_COL_H / 2;
          const Icon = colTypeIcon(column);
          const isFK = Boolean(column.references);
          const isHi = highlightedColIds.has(column.id);
          return (
            <div
              key={column.id}
              className={cn(
                "tbl-col",
                column.primaryKey && "is-pk",
                isFK && "is-fk",
                isHi && "is-hi"
              )}
              onMouseEnter={() =>
                setHoveredCol({ tableId: table.id, columnId: column.id })
              }
              onMouseLeave={() => setHoveredCol(null)}
            >
              {/* Hidden React Flow handles — left + right, source + target — let edges connect at the column row centre regardless of relative table position. */}
              <Handle
                type="target"
                id={`${column.id}-target-l`}
                position={Position.Left}
                style={{ top, left: -1 }}
              />
              <Handle
                type="source"
                id={`${column.id}-source-l`}
                position={Position.Left}
                style={{ top, left: -1 }}
              />
              <Handle
                type="target"
                id={`${column.id}-target-r`}
                position={Position.Right}
                style={{ top, right: -1 }}
              />
              <Handle
                type="source"
                id={`${column.id}-source-r`}
                position={Position.Right}
                style={{ top, right: -1 }}
              />

              <span className="ico">
                <Icon size={12} strokeWidth={1.5} />
              </span>
              <span>
                <span className="name">{column.name}</span>
              </span>
              <span className="flags">
                {column.primaryKey ? (
                  <span className="flag flag-pk">PK</span>
                ) : null}
                {isFK ? <span className="flag flag-fk">FK</span> : null}
                {!column.primaryKey && !column.nullable ? (
                  <span className="flag flag-nn">NN</span>
                ) : null}
                {column.unique && !column.primaryKey ? (
                  <span className="flag flag-uq">UQ</span>
                ) : null}
                {column.defaultValue ? (
                  <span className="flag flag-df">DF</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
