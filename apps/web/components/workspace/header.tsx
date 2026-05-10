"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Search, Share2, Sliders, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";

type NavTab = "schema" | "migrations" | "docs" | "settings";

const NAV_TABS: { id: NavTab; label: string }[] = [
  { id: "schema", label: "Schema" },
  { id: "migrations", label: "Migrations" },
  { id: "docs", label: "Docs" },
  { id: "settings", label: "Settings" }
];

interface HeaderProps {
  onShare?: () => void;
}

export function Header({ onShare }: HeaderProps): React.ReactElement {
  const parserErrors = useSchemaWorkspaceStore((state) => state.parserErrors);
  const setCmdkOpen = useSchemaWorkspaceStore((state) => state.setCmdkOpen);
  const { resolvedTheme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<NavTab>("schema");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const synced = parserErrors.length === 0;

  return (
    <header className="hdr">
      <div className="hdr-brand">
        <img src="/examples/logo.png" alt="SchemaCanvas" className="hdr-mark" />
      </div>

      <div className="hdr-tabs">
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn("hdr-tab", activeTab === tab.id && "is-active")}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="dot" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="hdr-actions">
        <span className="hdr-status">
          <span className="pulse" />
          {synced ? "Synced · just now" : `${parserErrors.length} parser issue${parserErrors.length === 1 ? "" : "s"}`}
        </span>
        <button
          type="button"
          className="btn"
          onClick={() => setCmdkOpen(true)}
        >
          <Search size={13} strokeWidth={1.5} />
          <span style={{ color: "var(--ink-3)" }}>Search…</span>
          <span className="kbd">⌘K</span>
        </button>
        <button type="button" className="btn btn-soft" onClick={onShare}>
          <Share2 size={13} strokeWidth={1.5} />
          Share
        </button>
        <button
          type="button"
          className="btn btn-ghost-icon"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {isDark ? (
            <Sun size={14} strokeWidth={1.5} />
          ) : (
            <Moon size={14} strokeWidth={1.5} />
          )}
        </button>
        <button
          type="button"
          className="btn btn-ghost-icon"
          onClick={() => setCmdkOpen(true)}
          title="Tweaks"
          aria-label="Tweaks"
        >
          <Sliders size={14} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
