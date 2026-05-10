"use client";

import { Fragment, useRef } from "react";
import type { SchemaAstNode, SchemaModel } from "@schemacanvas/schema-core";
import { toPng } from "html-to-image";
import {
  AlertTriangle,
  FileJson,
  GitBranch,
  ImageDown,
  Info,
  LayoutGrid,
  Network,
  ScrollText,
} from "lucide-react";
import { cn, downloadTextFile } from "@/lib/utils";
import {
  useSchemaWorkspaceStore,
  type BottomTab,
} from "@/lib/schema-workspace-store";
import { useProblems, type UnifiedProblem } from "@/lib/problems";

interface TabDef {
  id: BottomTab;
  label: string;
  icon: typeof AlertTriangle;
  count?: number;
  warn?: boolean;
}

function renderTitle(text: string): React.ReactNode[] {
  const parts = text.split(/("[^"]+")/g);
  return parts.map((part, index) => {
    if (part.startsWith('"') && part.endsWith('"') && part.length >= 2) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function colorMigrationLine(line: string): { color: string; text: string } {
  if (line.startsWith("-- WARNING")) {
    return { color: "var(--warn)", text: line };
  }
  if (line.startsWith("DROP")) {
    return { color: "var(--err)", text: line };
  }
  if (/^(CREATE|ALTER)/.test(line)) {
    return { color: "var(--ink-2)", text: line };
  }
  if (line.startsWith("--") || line.startsWith("#")) {
    return { color: "var(--ink-4)", text: line };
  }
  return { color: "var(--ink-3)", text: line };
}

function countMigrationSteps(migrationPreview: string): number {
  return migrationPreview.match(/;\s*$/gm)?.length ?? 0;
}

function formatAttributeValue(
  value: string | number | boolean | string[],
): string {
  if (Array.isArray(value)) {
    return `[${value.join(", ")}]`;
  }
  return String(value);
}

function formatNodeKind(kind: SchemaAstNode["kind"]): string {
  return kind.replace(/_/g, " ");
}

function astNodeSummary(node: SchemaAstNode): string {
  const attributes = Object.entries(node.attributes ?? {})
    .slice(0, 4)
    .map(([key, value]) => `${key}=${formatAttributeValue(value)}`);
  return [
    formatNodeKind(node.kind),
    node.label,
    attributes.length > 0 ? attributes.join(" ") : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

function appendAstLines(
  node: SchemaAstNode,
  lines: string[],
  prefix = "",
  isLast = true,
): void {
  const connector = prefix ? (isLast ? "`-- " : "|-- ") : "";
  lines.push(`${prefix}${connector}${astNodeSummary(node)}`);

  const childPrefix = prefix ? `${prefix}${isLast ? "    " : "|   "}` : "";
  node.children.forEach((child, index) => {
    appendAstLines(
      child,
      lines,
      childPrefix,
      index === node.children.length - 1,
    );
  });
}

async function downloadElementPng(
  node: HTMLElement | null,
  filename: string,
): Promise<void> {
  if (!node) {
    return;
  }

  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
  });
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

function fileBaseName(projectName: string): string {
  return (
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "schemacanvas"
  );
}

function ProblemRow({
  problem,
}: {
  problem: UnifiedProblem;
}): React.ReactElement {
  const jumpToLine = useSchemaWorkspaceStore((state) => state.jumpToLine);
  const setHoveredCol = useSchemaWorkspaceStore((state) => state.setHoveredCol);
  const Icon = problem.kind === "info" ? Info : AlertTriangle;

  const onActivate = (): void => {
    if (typeof problem.line === "number") {
      jumpToLine(problem.line);
    }
  };

  const onEnter = (): void => {
    if (problem.tableId && problem.columnId) {
      setHoveredCol({
        tableId: problem.tableId,
        columnId: problem.columnId,
      });
    }
  };

  return (
    <button
      type="button"
      className={cn("problem", `kind-${problem.kind}`)}
      onClick={onActivate}
      onMouseEnter={onEnter}
      onMouseLeave={() => setHoveredCol(null)}
    >
      <span className="icon">
        <Icon size={12} strokeWidth={1.75} />
      </span>
      <div className="body">
        <div className="ttl">{renderTitle(problem.title)}</div>
        <div className="meta">
          <span className="code-tag">{problem.kind}</span>
          <span style={{ color: "var(--ink-3)" }}>{problem.code}</span>
          {typeof problem.line === "number" ? (
            <>
              <span className="sep">·</span>
              <span>line {problem.line}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="actions">
        <span className="btn">
          Jump <span className="kbd">Enter</span>
        </span>
        <span className="btn btn-soft">Quick fix</span>
      </div>
    </button>
  );
}

function MigrationView(): React.ReactElement {
  const migrationPreview = useSchemaWorkspaceStore(
    (state) => state.migrationPreview,
  );
  const migrationSourceLabel = useSchemaWorkspaceStore(
    (state) => state.migrationSourceLabel ?? "Previous version",
  );
  const migrationTargetLabel = useSchemaWorkspaceStore(
    (state) => state.migrationTargetLabel ?? "Current workspace",
  );
  const lines = migrationPreview.split("\n");
  const stepCount = countMigrationSteps(migrationPreview);

  return (
    <>
      <div className="problem kind-info" style={{ cursor: "default" }}>
        <span className="icon">
          <GitBranch size={12} strokeWidth={1.75} />
        </span>
        <div className="body">
          <div className="ttl">Migration diff</div>
          <div className="meta">
            <span className="code-tag">{stepCount} SQL steps</span>
            <span>
              {migrationSourceLabel} -&gt; {migrationTargetLabel}
            </span>
          </div>
        </div>
      </div>
      <pre
        className="mono"
        style={{
          fontSize: 12,
          lineHeight: 1.7,
          background: "var(--bg-soft)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "10px 12px",
          whiteSpace: "pre",
          overflow: "auto",
          margin: 0,
        }}
      >
        {lines.map((line, index) => {
          const { color, text } = colorMigrationLine(line);
          return (
            <span key={index} style={{ color, display: "block" }}>
              {text || " "}
            </span>
          );
        })}
      </pre>
    </>
  );
}

function DocumentationView(): React.ReactElement {
  const tables = useSchemaWorkspaceStore((state) => state.schema.tables);
  if (tables.length === 0) {
    return <div className="review-empty">No tables to document yet.</div>;
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 10,
      }}
    >
      {tables.map((table) => (
        <div
          key={table.id}
          className="problem kind-info"
          style={{ gridTemplateColumns: "1fr", cursor: "default" }}
        >
          <div className="body">
            <div className="ttl mono">{table.name}</div>
            <div
              className="meta"
              style={{ fontFamily: "var(--font-sans)", color: "var(--ink-3)" }}
            >
              {table.comment ??
                `${table.columns.length} columns in ${table.schema}.`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AstView(): React.ReactElement {
  const exportRef = useRef<HTMLPreElement>(null);
  const ast = useSchemaWorkspaceStore((state) => state.parserAst);
  const projectName = useSchemaWorkspaceStore((state) => state.projectName);
  const lines: string[] = [];
  appendAstLines(ast.root, lines);
  const baseName = fileBaseName(projectName);

  const downloadJson = (): void => {
    downloadTextFile(
      `${baseName}-ast.json`,
      JSON.stringify(ast, null, 2),
      "application/json",
    );
  };

  return (
    <>
      <div className="problem kind-info" style={{ cursor: "default" }}>
        <span className="icon">
          <LayoutGrid size={12} strokeWidth={1.75} />
        </span>
        <div className="body">
          <div className="ttl">Parser artifact</div>
          <div className="meta">
            SQL -&gt; Parser -&gt; AST -&gt; SchemaModel -&gt; Generators
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          type="button"
          className="btn btn-soft"
          onClick={() =>
            void downloadElementPng(exportRef.current, `${baseName}-ast.png`)
          }
        >
          <ImageDown size={13} strokeWidth={1.5} />
          Download PNG
        </button>
        <button type="button" className="btn btn-soft" onClick={downloadJson}>
          <FileJson size={13} strokeWidth={1.5} />
          Download JSON
        </button>
      </div>
      <pre
        ref={exportRef}
        className="mono"
        style={{
          fontSize: 11.5,
          lineHeight: 1.6,
          color: "var(--ink-2)",
          margin: 0,
          padding: "10px 12px",
          background: "var(--bg-soft)",
          borderRadius: 8,
          border: "1px solid var(--line)",
          overflow: "auto",
        }}
      >
        {lines.join("\n")}
      </pre>
    </>
  );
}

function schemaLabel(schema: string, name: string): string {
  return schema === "public" ? name : `${schema}.${name}`;
}

function tableName(schema: SchemaModel, tableId: string): string {
  const table = schema.tables.find((candidate) => candidate.id === tableId);
  return table ? schemaLabel(table.schema, table.name) : "unknown_table";
}

function columnName(
  schema: SchemaModel,
  tableId: string,
  columnId: string,
): string {
  const table = schema.tables.find((candidate) => candidate.id === tableId);
  return (
    table?.columns.find((candidate) => candidate.id === columnId)?.name ??
    "unknown_column"
  );
}

function MindMapView(): React.ReactElement {
  const exportRef = useRef<HTMLDivElement>(null);
  const schema = useSchemaWorkspaceStore((state) => state.schema);
  const projectName = useSchemaWorkspaceStore((state) => state.projectName);
  const baseName = fileBaseName(projectName);

  const groups = [
    {
      label: "Tables",
      detail: `${schema.tables.length} parsed tables`,
      entries: schema.tables.map((table) => ({
        id: table.id,
        label: schemaLabel(table.schema, table.name),
        detail: `${table.columns.length} columns`,
      })),
    },
    {
      label: "Relationships",
      detail: `${schema.relationships.length} foreign keys`,
      entries: schema.relationships.map((relationship) => ({
        id: relationship.id,
        label: `${tableName(schema, relationship.sourceTableId)}.${columnName(
          schema,
          relationship.sourceTableId,
          relationship.sourceColumnId,
        )} -> ${tableName(schema, relationship.targetTableId)}.${columnName(
          schema,
          relationship.targetTableId,
          relationship.targetColumnId,
        )}`,
        detail: relationship.constraintName ?? "foreign key",
      })),
    },
    {
      label: "Enums",
      detail: `${schema.enums.length} enum types`,
      entries: schema.enums.map((enumeration) => ({
        id: enumeration.id,
        label: schemaLabel(enumeration.schema, enumeration.name),
        detail: enumeration.values.join(", "),
      })),
    },
    {
      label: "Indexes",
      detail: `${schema.indexes.length} indexes`,
      entries: schema.indexes.map((index) => ({
        id: index.id,
        label: index.name,
        detail: `${index.unique ? "unique " : ""}${index.columns.join(", ")}`,
      })),
    },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-soft"
          onClick={() =>
            void downloadElementPng(
              exportRef.current,
              `${baseName}-mind-map.png`,
            )
          }
        >
          <ImageDown size={13} strokeWidth={1.5} />
          Download Mind Map PNG
        </button>
      </div>
      <div
        ref={exportRef}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div className="ttl" style={{ marginBottom: 10 }}>
          SQL mind map
        </div>
        <div className="problem kind-info" style={{ cursor: "default" }}>
          <span className="icon">
            <Network size={12} strokeWidth={1.75} />
          </span>
          <div className="body">
            <div className="ttl">{projectName || "SchemaCanvas"}</div>
            <div className="meta">
              <span className="code-tag">{schema.tables.length} tables</span>
              <span>{schema.relationships.length} relationships</span>
            </div>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 10,
            marginTop: 10,
          }}
        >
          {groups.map((group) => (
            <div
              key={group.label}
              className="problem kind-info"
              style={{
                gridTemplateColumns: "1fr",
                cursor: "default",
                alignContent: "start",
              }}
            >
              <div className="body">
                <div className="ttl">{group.label}</div>
                <div className="meta">{group.detail}</div>
                <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                  {group.entries.length === 0 ? (
                    <span className="meta">No entries.</span>
                  ) : (
                    group.entries.map((entry) => (
                      <div key={entry.id}>
                        <div className="ttl mono">{entry.label}</div>
                        <div className="meta">{entry.detail}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function JsonView(): React.ReactElement {
  const schema = useSchemaWorkspaceStore((state) => state.schema);
  return (
    <pre
      className="mono"
      style={{
        fontSize: 11.5,
        lineHeight: 1.6,
        color: "var(--ink-2)",
        margin: 0,
        padding: "10px 12px",
        background: "var(--bg-soft)",
        borderRadius: 8,
        border: "1px solid var(--line)",
        overflow: "auto",
      }}
    >
      {JSON.stringify(schema, null, 2)}
    </pre>
  );
}

export function BottomPanel(): React.ReactElement {
  const activeBottomTab = useSchemaWorkspaceStore(
    (state) => state.activeBottomTab,
  );
  const setActiveBottomTab = useSchemaWorkspaceStore(
    (state) => state.setActiveBottomTab,
  );
  const migrationPreview = useSchemaWorkspaceStore(
    (state) => state.migrationPreview,
  );
  const problems = useProblems();
  const migrationChangeCount = countMigrationSteps(migrationPreview);

  const tabs: TabDef[] = [
    {
      id: "problems",
      label: "Problems",
      icon: AlertTriangle,
      count: problems.length,
      warn: true,
    },
    {
      id: "migration",
      label: "Migration",
      icon: GitBranch,
      count: migrationChangeCount > 0 ? migrationChangeCount : undefined,
    },
    { id: "documentation", label: "Documentation", icon: ScrollText },
    { id: "pipeline", label: "AST", icon: LayoutGrid },
    { id: "mindmap", label: "Mind Map", icon: Network },
    { id: "json", label: "Schema JSON", icon: FileJson },
  ];

  const renderActiveTab = (): React.ReactNode => {
    switch (activeBottomTab) {
      case "problems":
        return problems.length === 0 ? (
          <div className="review-empty">No problems found.</div>
        ) : (
          problems.map((problem) => (
            <ProblemRow key={problem.id} problem={problem} />
          ))
        );
      case "migration":
        return <MigrationView />;
      case "documentation":
        return <DocumentationView />;
      case "pipeline":
        return <AstView />;
      case "mindmap":
        return <MindMapView />;
      case "json":
        return <JsonView />;
      default:
        return null;
    }
  };

  return (
    <section className="review">
      <div className="review-tabs" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const showCount = tab.count != null && tab.count > 0;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeBottomTab === tab.id}
              className={cn(
                "review-tab",
                activeBottomTab === tab.id && "is-active",
                tab.warn && showCount && "has-warn",
              )}
              onClick={() => setActiveBottomTab(tab.id)}
            >
              <Icon size={13} strokeWidth={1.5} />
              {tab.label}
              {showCount ? <span className="badge">{tab.count}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="review-body">{renderActiveTab()}</div>
    </section>
  );
}
