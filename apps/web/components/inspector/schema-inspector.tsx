"use client";

import { Trash2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";

const COMMON_TYPES = [
  "UUID",
  "TEXT",
  "INTEGER",
  "BIGINT",
  "BOOLEAN",
  "TIMESTAMP",
  "TIMESTAMPTZ",
  "NUMERIC(10,2)",
  "JSONB"
];

export function SchemaInspector(): React.ReactElement | null {
  const schema = useSchemaWorkspaceStore((state) => state.schema);
  const selection = useSchemaWorkspaceStore((state) => state.selection);
  const renameTable = useSchemaWorkspaceStore((state) => state.renameTable);
  const deleteTable = useSchemaWorkspaceStore((state) => state.deleteTable);
  const addColumn = useSchemaWorkspaceStore((state) => state.addColumn);
  const updateColumn = useSchemaWorkspaceStore((state) => state.updateColumn);
  const deleteColumn = useSchemaWorkspaceStore((state) => state.deleteColumn);
  const deleteForeignKey = useSchemaWorkspaceStore((state) => state.deleteForeignKey);
  const updateTableComment = useSchemaWorkspaceStore(
    (state) => state.updateTableComment
  );
  const updateColumnComment = useSchemaWorkspaceStore(
    (state) => state.updateColumnComment
  );

  const selectedTable = schema.tables.find((table) => table.id === selection.tableId);
  const selectedColumn = selectedTable?.columns.find(
    (column) => column.id === selection.columnId
  );
  const selectedRelationship = schema.relationships.find(
    (relationship) => relationship.id === selection.relationshipId
  );

  if (!selectedTable && !selectedRelationship) {
    return null;
  }

  return (
    <aside className="absolute right-4 top-4 bottom-4 z-20 w-[360px] rounded-lg border border-border bg-card/96 shadow-panel backdrop-blur-sm">
      <ScrollArea className="h-full">
        <div className="space-y-5 p-4">
          {selectedRelationship ? (
            <>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Relationship
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Review or remove the selected foreign key.
                </p>
              </div>
              <div className="rounded-md border border-border bg-background/50 p-3 font-mono text-sm text-foreground">
                {(() => {
                  const sourceTable = schema.tables.find(
                    (table) => table.id === selectedRelationship.sourceTableId
                  );
                  const targetTable = schema.tables.find(
                    (table) => table.id === selectedRelationship.targetTableId
                  );
                  const sourceColumn = sourceTable?.columns.find(
                    (column) => column.id === selectedRelationship.sourceColumnId
                  );
                  const targetColumn = targetTable?.columns.find(
                    (column) => column.id === selectedRelationship.targetColumnId
                  );
                  return `${sourceTable?.name}.${sourceColumn?.name} -> ${targetTable?.name}.${targetColumn?.name}`;
                })()}
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => deleteForeignKey(selectedRelationship.id)}
              >
                <Unplug className="h-4 w-4" />
                Remove relationship
              </Button>
            </>
          ) : null}

          {selectedTable ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="table-name">Table name</Label>
                <Input
                  id="table-name"
                  value={selectedTable.name}
                  onChange={(event) => {
                    try {
                      renameTable(selectedTable.id, event.target.value);
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Could not rename table."
                      );
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-comment">Table description</Label>
                <Textarea
                  id="table-comment"
                  value={selectedTable.comment ?? ""}
                  onChange={(event) =>
                    updateTableComment(selectedTable.id, event.target.value)
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Columns</p>
                  <p className="text-xs text-muted-foreground">
                    Edit names, types, constraints, and notes.
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => addColumn(selectedTable.id)}>
                  Add column
                </Button>
              </div>

              <div className="space-y-4">
                {selectedTable.columns.map((column) => (
                  <div
                    key={column.id}
                    className="rounded-md border border-border bg-background/50 p-3"
                  >
                    <div className="grid gap-3">
                      <div className="space-y-2">
                        <Label>Column name</Label>
                        <Input
                          className="font-mono"
                          value={column.name}
                          onChange={(event) => {
                            try {
                              updateColumn(selectedTable.id, column.id, {
                                name: event.target.value
                              });
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Could not update column."
                              );
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data type</Label>
                        <Input
                          className="font-mono"
                          list="schemacanvas-column-types"
                          value={column.type}
                          onChange={(event) =>
                            updateColumn(selectedTable.id, column.id, {
                              type: event.target.value
                            })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-2">
                          <Label>Primary key</Label>
                          <div className="flex h-9 items-center">
                            <Switch
                              checked={column.primaryKey}
                              onCheckedChange={(checked) =>
                                updateColumn(selectedTable.id, column.id, {
                                  primaryKey: checked
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Required</Label>
                          <div className="flex h-9 items-center">
                            <Switch
                              checked={!column.nullable}
                              onCheckedChange={(checked) =>
                                updateColumn(selectedTable.id, column.id, {
                                  nullable: !checked
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Unique</Label>
                          <div className="flex h-9 items-center">
                            <Switch
                              checked={column.unique}
                              onCheckedChange={(checked) =>
                                updateColumn(selectedTable.id, column.id, {
                                  unique: checked
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Default value</Label>
                        <Input
                          value={column.defaultValue ?? ""}
                          onChange={(event) =>
                            updateColumn(selectedTable.id, column.id, {
                              defaultValue: event.target.value || undefined
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Column notes</Label>
                        <Textarea
                          value={column.comment ?? ""}
                          onChange={(event) =>
                            updateColumnComment(
                              selectedTable.id,
                              column.id,
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="justify-center"
                        onClick={() => deleteColumn(selectedTable.id, column.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete column
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {selectedColumn ? (
                <>
                  <Separator />
                  <div className="rounded-md border border-sky-500/20 bg-sky-500/10 p-3 text-sm text-sky-100">
                    Editing <strong>{selectedColumn.name}</strong>. Drag the handle
                    from this column to another column on the canvas to create a
                    relationship.
                  </div>
                </>
              ) : null}

              <Separator />

              <div className="space-y-2 rounded-md border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-sm font-semibold text-red-200">Danger zone</p>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => deleteTable(selectedTable.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete table
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </ScrollArea>
      <datalist id="schemacanvas-column-types">
        {COMMON_TYPES.map((type) => (
          <option key={type} value={type} />
        ))}
        {schema.enums.map((enumeration) => (
          <option key={enumeration.id} value={enumeration.name} />
        ))}
      </datalist>
    </aside>
  );
}
