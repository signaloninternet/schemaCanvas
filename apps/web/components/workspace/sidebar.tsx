"use client";

import { useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  GitBranch,
  History,
  List,
  Plus,
  Table2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";
import { tableColorForName } from "@/lib/table-colors";

interface BranchEntry {
  id: string;
  name: string;
  version: string;
  swatchVar: string;
  active: boolean;
}

const BRANCHES: BranchEntry[] = [
  {
    id: "main",
    name: "main",
    version: "v0.4",
    swatchVar: "var(--accent)",
    active: true
  },
  {
    id: "analytics-fork",
    name: "analytics-fork",
    version: "v0.2",
    swatchVar: "var(--tbl-blue)",
    active: false
  }
];

interface RecentEntry {
  id: string;
  icon: "history" | "git";
  prefix: string;
  mono: string;
  meta: string;
}

const RECENT: RecentEntry[] = [
  { id: "r1", icon: "history", prefix: "Added", mono: "payments", meta: "2m" },
  {
    id: "r2",
    icon: "history",
    prefix: "Renamed",
    mono: "line_items",
    meta: "1h"
  },
  { id: "r3", icon: "git", prefix: "Migration", mono: "0003", meta: "1d" }
];

const FOOTER_USER = {
  initials: "EM",
  name: "Eli M.",
  plan: "Personal · Free"
};

export function Sidebar(): React.ReactElement {
  const tables = useSchemaWorkspaceStore((state) => state.schema.tables);
  const enums = useSchemaWorkspaceStore((state) => state.schema.enums);
  const selection = useSchemaWorkspaceStore((state) => state.selection);
  const selectTable = useSchemaWorkspaceStore((state) => state.selectTable);
  const addTable = useSchemaWorkspaceStore((state) => state.addTable);
  const toggleSidebar = useSchemaWorkspaceStore(
    (state) => state.toggleSidebar
  );
  const parserErrors = useSchemaWorkspaceStore((state) => state.parserErrors);
  const parserWarnings = useSchemaWorkspaceStore(
    (state) => state.parserWarnings
  );
  const validationProblems = useSchemaWorkspaceStore(
    (state) => state.validationProblems
  );

  const flaggedTableIds = useMemo(() => {
    const set = new Set<string>();
    for (const problem of [
      ...parserErrors,
      ...parserWarnings,
      ...validationProblems
    ]) {
      const id = problem.location?.tableId;
      if (id) {
        set.add(id);
      }
    }
    return set;
  }, [parserErrors, parserWarnings, validationProblems]);

  return (
    <aside className="sb" aria-label="Workspace sidebar">
      <div className="sb-scroll">
        <div className="sb-section">
        <span className="label">Workspace</span>
        <button
          type="button"
          className="sb-collapse"
          onClick={toggleSidebar}
          title="Collapse"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
        </button>
        </div>

        <div className="sb-list">
        {BRANCHES.map((branch) => (
          <button
            key={branch.id}
            type="button"
            className={cn("sb-item", branch.active && "is-active")}
          >
            <span
              className="swatch"
              style={{ background: branch.swatchVar }}
            />
            {branch.active ? (
              <span className="name">{branch.name}</span>
            ) : (
              <span>{branch.name}</span>
            )}
            <span className="meta">{branch.version}</span>
          </button>
        ))}
        </div>

        <div className="sb-section">
        <span className="label">Tables · {tables.length}</span>
        <button
          type="button"
          className="add"
          onClick={addTable}
          title="New table"
          aria-label="New table"
        >
          <Plus size={11} strokeWidth={1.5} />
        </button>
        </div>
        <div className="sb-list">
        {tables.map((table, index) => {
          const color = tableColorForName(table.name, index);
          const isActive = selection.tableId === table.id;
          const isFlagged = flaggedTableIds.has(table.id);
          return (
            <button
              key={table.id}
              type="button"
              className={cn(
                "sb-item",
                isActive && "is-active",
                isFlagged && "is-flagged"
              )}
              onClick={() => selectTable(table.id)}
            >
              <span
                className="swatch"
                style={{ background: `var(--tbl-${color})` }}
              />
              <span className="name">{table.name}</span>
              <span className="meta">{table.columns.length}</span>
            </button>
          );
        })}
        </div>

        <div className="sb-section">
        <span className="label">Enums · {enums.length}</span>
        </div>
        <div className="sb-list">
        {enums.map((enumDef) => (
          <button key={enumDef.id} type="button" className="sb-item">
            <span
              className="swatch"
              style={{ background: "var(--tbl-yellow)" }}
            />
            <span className="name">{enumDef.name}</span>
            <span className="meta">{enumDef.values.length}</span>
          </button>
        ))}
        </div>

        <div className="sb-section">
        <span className="label">Recent</span>
        </div>
        <div className="sb-list">
        {RECENT.map((entry) => {
          const Icon = entry.icon === "history" ? History : GitBranch;
          return (
            <div key={entry.id} className="sb-item">
              <Icon
                size={13}
                strokeWidth={1.5}
                style={{ color: "var(--ink-3)" }}
              />
              <span>
                {entry.prefix}{" "}
                <span className="mono" style={{ color: "var(--ink-2)" }}>
                  {entry.mono}
                </span>
              </span>
              <span className="meta">{entry.meta}</span>
            </div>
          );
        })}
        </div>
      </div>

      <div className="sb-foot">
        <div className="ava">{FOOTER_USER.initials}</div>
        <div
          style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}
        >
          <span
            style={{
              color: "var(--ink)",
              fontWeight: 500,
              fontSize: 12
            }}
          >
            {FOOTER_USER.name}
          </span>
          <span style={{ fontSize: 11 }}>{FOOTER_USER.plan}</span>
        </div>
      </div>
    </aside>
  );
}

export function CollapsedSidebar(): React.ReactElement {
  const toggleSidebar = useSchemaWorkspaceStore(
    (state) => state.toggleSidebar
  );

  return (
    <aside
      className="sb"
      aria-label="Workspace sidebar (collapsed)"
      style={{ alignItems: "center", paddingTop: 14, gap: 6 }}
    >
      <button
        type="button"
        className="btn btn-ghost-icon"
        onClick={toggleSidebar}
        title="Expand"
        aria-label="Expand sidebar"
      >
        <ChevronRight size={14} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        className="btn btn-ghost-icon"
        onClick={toggleSidebar}
        title="Tables"
        aria-label="Tables"
      >
        <Table2 size={14} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        className="btn btn-ghost-icon"
        onClick={toggleSidebar}
        title="Enums"
        aria-label="Enums"
      >
        <List size={14} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        className="btn btn-ghost-icon"
        onClick={toggleSidebar}
        title="History"
        aria-label="History"
      >
        <History size={14} strokeWidth={1.5} />
      </button>
    </aside>
  );
}
