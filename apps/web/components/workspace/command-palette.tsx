"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from "react";
import {
  ArrowDownToLine,
  AlertTriangle,
  Braces,
  Columns3,
  FileText,
  LayoutGrid,
  Maximize2,
  Palette,
  Plus,
  ShieldCheck,
  Sparkles,
  Square,
  Table2,
  type LucideIcon
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useSchemaWorkspaceStore,
  type CardStyle
} from "@/lib/schema-workspace-store";
import {
  ACCENT_NAMES,
  ACCENT_PRESETS
} from "@/lib/accent-presets";
import {
  exportCanvasPng,
  exportCanvasSvg,
  exportSqlFile,
  findCanvasNode
} from "@/lib/exports";
import { useProblems } from "@/lib/problems";

interface CommandItem {
  id: string;
  section: string;
  label: string;
  hint?: string;
  keywords?: string[];
  icon: LucideIcon;
  run: () => void | Promise<void>;
}

const CARD_STYLES: CardStyle[] = ["lucid", "minimal", "blueprint"];

export function CommandPalette(): ReactElement | null {
  const cmdkOpen = useSchemaWorkspaceStore((state) => state.cmdkOpen);
  const setCmdkOpen = useSchemaWorkspaceStore((state) => state.setCmdkOpen);
  const addTable = useSchemaWorkspaceStore((state) => state.addTable);
  const addEnum = useSchemaWorkspaceStore((state) => state.addEnum);
  const formatSql = useSchemaWorkspaceStore((state) => state.formatSql);
  const validateCurrent = useSchemaWorkspaceStore(
    (state) => state.validateCurrent
  );
  const autoLayout = useSchemaWorkspaceStore((state) => state.autoLayout);
  const requestFitView = useSchemaWorkspaceStore(
    (state) => state.requestFitView
  );
  const sqlDraft = useSchemaWorkspaceStore((state) => state.sqlDraft);
  const projectName = useSchemaWorkspaceStore((state) => state.projectName);
  const cardStyle = useSchemaWorkspaceStore((state) => state.cardStyle);
  const setCardStyle = useSchemaWorkspaceStore((state) => state.setCardStyle);
  const accent = useSchemaWorkspaceStore((state) => state.accent);
  const setAccent = useSchemaWorkspaceStore((state) => state.setAccent);
  const schema = useSchemaWorkspaceStore((state) => state.schema);
  const selectTable = useSchemaWorkspaceStore((state) => state.selectTable);
  const selectColumn = useSchemaWorkspaceStore((state) => state.selectColumn);
  const setActiveBottomTab = useSchemaWorkspaceStore(
    (state) => state.setActiveBottomTab
  );
  const jumpToLine = useSchemaWorkspaceStore((state) => state.jumpToLine);
  const problems = useProblems();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<CommandItem[]>(() => {
    const buildEnumName = (): string => {
      let i = 1;
      let candidate = "new_enum";
      while (schema.enums.some((e) => e.name === candidate)) {
        i += 1;
        candidate = `new_enum_${i}`;
      }
      return candidate;
    };

    const exportImage = async (
      kind: "png" | "svg"
    ): Promise<void> => {
      const node = findCanvasNode();
      if (!node) {
        toast.error("Canvas not ready for export.");
        return;
      }
      try {
        if (kind === "png") {
          await exportCanvasPng(node, projectName);
        } else {
          await exportCanvasSvg(node, projectName);
        }
        toast.success(`Exported diagram as ${kind.toUpperCase()}.`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not export diagram."
        );
      }
    };

    const items: CommandItem[] = [
      {
        id: "table",
        section: "Schema",
        label: "New table",
        hint: "T",
        icon: Plus,
        run: () => {
          addTable();
          toast.success("Created a new table.");
        }
      },
      {
        id: "enum",
        section: "Schema",
        label: "New enum",
        hint: "E",
        icon: Plus,
        run: () => {
          try {
            addEnum(buildEnumName(), ["value_1"]);
            toast.success("Created a new enum.");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not create enum."
            );
          }
        }
      },
      {
        id: "format",
        section: "Editor",
        label: "Format SQL",
        hint: "⇧⌥F",
        icon: Sparkles,
        run: () => {
          formatSql();
          toast.success("Formatted SQL.");
        }
      },
      {
        id: "validate",
        section: "Editor",
        label: "Validate schema",
        hint: "⌘↵",
        icon: ShieldCheck,
        run: () => {
          validateCurrent();
          toast.success("Validation refreshed.");
        }
      },
      {
        id: "auto",
        section: "Canvas",
        label: "Auto-layout canvas",
        hint: "⌘L",
        icon: LayoutGrid,
        run: () => {
          autoLayout();
          toast.success("Auto-layout applied.");
        }
      },
      {
        id: "fit",
        section: "Canvas",
        label: "Fit to view",
        hint: "⌘0",
        icon: Maximize2,
        run: () => {
          requestFitView();
        }
      },
      {
        id: "export-png",
        section: "Export",
        label: "Export · PNG",
        icon: ArrowDownToLine,
        run: () => exportImage("png")
      },
      {
        id: "export-svg",
        section: "Export",
        label: "Export · SVG",
        icon: ArrowDownToLine,
        run: () => exportImage("svg")
      },
      {
        id: "export-sql",
        section: "Export",
        label: "Export · SQL",
        icon: FileText,
        run: () => {
          exportSqlFile(sqlDraft, projectName);
        }
      }
    ];

    for (const table of schema.tables) {
      items.push({
        id: `table-${table.id}`,
        section: "Table",
        label: table.name,
        hint: `${table.columns.length} columns`,
        keywords: [
          table.schema,
          table.comment ?? "",
          ...table.columns.map((column) => column.name),
          ...table.columns.map((column) => column.type)
        ],
        icon: Table2,
        run: () => {
          selectTable(table.id);
          requestFitView();
          toast.success(`Selected table ${table.name}.`);
        }
      });

      for (const column of table.columns) {
        items.push({
          id: `column-${table.id}-${column.id}`,
          section: "Column",
          label: `${table.name}.${column.name}`,
          hint: column.type,
          keywords: [
            table.name,
            table.schema,
            column.name,
            column.type,
            column.comment ?? "",
            column.primaryKey ? "primary key pk" : "",
            column.references ? "foreign key fk reference" : "",
            column.nullable ? "nullable" : "not null required",
            column.unique ? "unique" : ""
          ],
          icon: Columns3,
          run: () => {
            selectColumn(table.id, column.id);
            requestFitView();
            toast.success(`Selected column ${table.name}.${column.name}.`);
          }
        });
      }
    }

    for (const enumDef of schema.enums) {
      items.push({
        id: `enum-${enumDef.id}`,
        section: "Enum",
        label: enumDef.name,
        hint: `${enumDef.values.length} values`,
        keywords: enumDef.values,
        icon: Braces,
        run: () => {
          toast.info(`${enumDef.name}: ${enumDef.values.join(", ")}`);
        }
      });
    }

    for (const problem of problems) {
      items.push({
        id: `problem-${problem.id}`,
        section: problem.kind === "error" ? "Error" : "Problem",
        label: problem.title,
        hint:
          typeof problem.line === "number"
            ? `${problem.code} · line ${problem.line}`
            : problem.code,
        keywords: [
          problem.kind,
          problem.code,
          problem.tableId ?? "",
          problem.columnId ?? ""
        ],
        icon: AlertTriangle,
        run: () => {
          setActiveBottomTab("problems");
          if (typeof problem.line === "number") {
            jumpToLine(problem.line);
          }
          if (problem.tableId && problem.columnId) {
            selectColumn(problem.tableId, problem.columnId);
          } else if (problem.tableId) {
            selectTable(problem.tableId);
          }
        }
      });
    }

    for (const style of CARD_STYLES) {
      items.push({
        id: `card-style-${style}`,
        section: "Card style",
        label: `Use ${style}${cardStyle === style ? " (current)" : ""}`,
        icon: Square,
        run: () => {
          setCardStyle(style);
          toast.success(`Card style: ${style}.`);
        }
      });
    }

    for (const name of ACCENT_NAMES) {
      items.push({
        id: `accent-${name}`,
        section: "Accent",
        label: `${name.charAt(0).toUpperCase()}${name.slice(1)}${accent === name ? " (current)" : ""}`,
        icon: Palette,
        run: () => {
          setAccent(name);
          toast.success(`Accent: ${name}.`);
        }
      });
    }

    return items;
  }, [
    addTable,
    addEnum,
    formatSql,
    validateCurrent,
    autoLayout,
    requestFitView,
    sqlDraft,
    projectName,
    cardStyle,
    setCardStyle,
    accent,
    setAccent,
    schema,
    selectTable,
    selectColumn,
    setActiveBottomTab,
    jumpToLine,
    problems
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return commands;
    }
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.section.toLowerCase().includes(q) ||
        c.hint?.toLowerCase().includes(q) ||
        c.keywords?.some((keyword) => keyword.toLowerCase().includes(q))
    );
  }, [commands, query]);

  useEffect(() => {
    if (cmdkOpen) {
      setQuery("");
      setActiveIndex(0);
      // Focus on next tick so the input is mounted.
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [cmdkOpen]);

  useEffect(() => {
    setActiveIndex((current) =>
      filtered.length === 0 ? 0 : Math.min(current, filtered.length - 1)
    );
  }, [filtered]);

  if (!cmdkOpen) {
    return null;
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      setCmdkOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = filtered[activeIndex];
      if (command) {
        void command.run();
        setCmdkOpen(false);
      }
    }
  };

  return (
    <div
      className="cmdk-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setCmdkOpen(false);
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="cmdk"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a command, table, or column…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Command palette search"
        />
        <div className="cmdk-list" role="listbox">
          {filtered.length === 0 ? (
            <div className="cmdk-item">
              <span style={{ color: "var(--ink-4)" }}>No matches.</span>
            </div>
          ) : (
            filtered.map((command, index) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    "cmdk-item",
                    index === activeIndex && "is-active"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    void command.run();
                    setCmdkOpen(false);
                  }}
                >
                  <span className="ico">
                    <Icon size={12} strokeWidth={1.5} />
                  </span>
                  <span className="section">{command.section}</span>
                  <span className="ttl">{command.label}</span>
                  {command.hint ? (
                    <span className="hint">{command.hint}</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// Re-exports for clarity in tests / future imports.
export { ACCENT_PRESETS };
