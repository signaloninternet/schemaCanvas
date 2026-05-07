import dagre from "dagre";
import type { SchemaModel } from "@schemacanvas/schema-core";
import { cloneSchema } from "@schemacanvas/schema-core";

const TABLE_WIDTH = 304;
const HEADER_HEIGHT = 52;
const ROW_HEIGHT = 36;

export function autoLayoutSchema(schema: SchemaModel): SchemaModel {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: "LR",
    nodesep: 72,
    ranksep: 120,
    marginx: 32,
    marginy: 32
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const table of schema.tables) {
    graph.setNode(table.id, {
      width: TABLE_WIDTH,
      height: HEADER_HEIGHT + table.columns.length * ROW_HEIGHT + 20
    });
  }

  for (const relationship of schema.relationships) {
    graph.setEdge(relationship.sourceTableId, relationship.targetTableId);
  }

  dagre.layout(graph);

  const nextSchema = cloneSchema(schema);
  for (const table of nextSchema.tables) {
    const position = graph.node(table.id);
    if (!position) {
      continue;
    }

    nextSchema.layout[table.id] = {
      x: position.x - TABLE_WIDTH / 2,
      y: position.y - position.height / 2
    };
  }

  return nextSchema;
}
