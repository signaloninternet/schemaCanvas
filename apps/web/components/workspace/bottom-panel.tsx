"use client";

import { Fragment } from "react";
import {
  AlertTriangle,
  FileJson,
  GitBranch,
  Info,
  LayoutGrid,
  ScrollText
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSchemaWorkspaceStore,
  type BottomTab
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
  // Wrap content inside double quotes in <code> chips per the design.
  const parts = text.split(/("[^"]+")/g);
  return parts.map((part, index) => {
    if (part.startsWith('"') && part.endsWith('"') && part.length >= 2) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function colorMigrationLine(line: string): { color: string; text: string } {
  if (line.startsWith("+")) {
    return { color: "var(--ok)", text: line };
  }
  if (line.startsWith("-")) {
    return { color: "var(--err)", text: line };
  }
  if (line.startsWith("--") || line.startsWith("#")) {
    return { color: "var(--ink-4)", text: line };
  }
  return { color: "var(--ink-3)", text: line };
}

function ProblemRow({
  problem
}: {
  problem: UnifiedProblem;
}): React.ReactElement {
  const jumpToLine = useSchemaWorkspaceStore((state) => state.jumpToLine);
  const setHoveredCol = useSchemaWorkspaceStore(
    (state) => state.setHoveredCol
  );
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
        columnId: problem.columnId
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
          Jump <span className="kbd">↵</span>
        </span>
        <span className="btn btn-soft">Quick fix</span>
      </div>
    </button>
  );
}

function MigrationView(): React.ReactElement {
  const migrationPreview = useSchemaWorkspaceStore(
    (state) => state.migrationPreview
  );
  const lines = migrationPreview.split("\n");
  return (
    <div
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
        margin: 0
      }}
    >
      {lines.map((line, index) => {
        const { color, text } = colorMigrationLine(line);
        return (
          <div key={index} style={{ color }}>
            {text || " "}
          </div>
        );
      })}
    </div>
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
        gap: 10
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
  const ast = useSchemaWorkspaceStore((state) => state.parserAst);
  const lines: string[] = [ast.root.label];
  const children = ast.root.children;
  children.forEach((node, index) => {
    const isLast = index === children.length - 1;
    const branch = isLast ? "└──" : "├──";
    const detail =
      node.attributes && Object.keys(node.attributes).length > 0
        ? ` ${Object.entries(node.attributes)
            .slice(0, 3)
            .map(
              ([key, value]) =>
                `${key}=${Array.isArray(value) ? `[${value.join(", ")}]` : value}`
            )
            .join(" ")}`
        : "";
    lines.push(`${branch} ${node.kind} ${node.label}${detail}`);
  });

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
        overflow: "auto"
      }}
    >
      {lines.join("\n")}
    </pre>
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
        overflow: "auto"
      }}
    >
      {JSON.stringify(schema, null, 2)}
    </pre>
  );
}

export function BottomPanel(): React.ReactElement {
  const activeBottomTab = useSchemaWorkspaceStore(
    (state) => state.activeBottomTab
  );
  const setActiveBottomTab = useSchemaWorkspaceStore(
    (state) => state.setActiveBottomTab
  );
  const migrationPreview = useSchemaWorkspaceStore(
    (state) => state.migrationPreview
  );
  const problems = useProblems();

  const migrationChangeCount = migrationPreview
    .split("\n")
    .filter((line) => line.startsWith("+") || line.startsWith("-")).length;

  const tabs: TabDef[] = [
    {
      id: "problems",
      label: "Problems",
      icon: AlertTriangle,
      count: problems.length,
      warn: true
    },
    {
      id: "migration",
      label: "Migration",
      icon: GitBranch,
      count: migrationChangeCount > 0 ? migrationChangeCount : undefined
    },
    { id: "documentation", label: "Documentation", icon: ScrollText },
    { id: "pipeline", label: "AST", icon: LayoutGrid },
    { id: "json", label: "Schema JSON", icon: FileJson }
  ];

  const renderActiveTab = (): React.ReactNode => {
    switch (activeBottomTab) {
      case "problems":
        return problems.length === 0 ? (
          <div className="review-empty">No problems found. ✓</div>
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
      case "json":
        return <JsonView />;
      default:
        return null;
    }
  };

  return (
    <section className="review">
      <div className="review-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const showCount = tab.count != null && tab.count > 0;
          return (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "review-tab",
                activeBottomTab === tab.id && "is-active",
                tab.warn && showCount && "has-warn"
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
