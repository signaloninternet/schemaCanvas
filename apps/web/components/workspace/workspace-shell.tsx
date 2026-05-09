"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { CanvasPane } from "@/components/canvas/schema-canvas";
import { SqlEditorPanel } from "@/components/editor/sql-editor-panel";
import { SchemaInspector } from "@/components/inspector/schema-inspector";
import { BottomPanel } from "@/components/workspace/bottom-panel";
import { CommandPalette } from "@/components/workspace/command-palette";
import { Header } from "@/components/workspace/header";
import { CollapsedSidebar, Sidebar } from "@/components/workspace/sidebar";
import { cn } from "@/lib/utils";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";
import { ACCENT_PRESETS } from "@/lib/accent-presets";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.closest(".cm-editor")) {
    return true;
  }
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function WorkspaceShell(): React.ReactElement {
  const canvasExportRef = useRef<HTMLDivElement>(null);
  const shouldFitAfterCanvasModeChange = useRef(false);
  const [canvasExpanded, setCanvasExpanded] = useState(false);
  const sbCollapsed = useSchemaWorkspaceStore((state) => state.sbCollapsed);
  const accent = useSchemaWorkspaceStore((state) => state.accent);
  const cmdkOpen = useSchemaWorkspaceStore((state) => state.cmdkOpen);
  const setCmdkOpen = useSchemaWorkspaceStore((state) => state.setCmdkOpen);
  const requestFitView = useSchemaWorkspaceStore(
    (state) => state.requestFitView
  );
  const autoLayout = useSchemaWorkspaceStore((state) => state.autoLayout);
  const validateCurrent = useSchemaWorkspaceStore(
    (state) => state.validateCurrent
  );
  const { resolvedTheme } = useTheme();

  const toggleCanvasExpanded = useCallback(() => {
    shouldFitAfterCanvasModeChange.current = true;
    setCanvasExpanded((expanded) => !expanded);
  }, []);

  // Apply accent CSS vars at runtime so users can switch presets without a
  // page reload. Mirrors the reference's effect (theme-aware light/dark hex).
  useEffect(() => {
    const preset = ACCENT_PRESETS[accent] ?? ACCENT_PRESETS.amber;
    const root = document.documentElement;
    const isDark = resolvedTheme === "dark";
    root.style.setProperty("--accent", isDark ? preset.dark : preset.light);
    root.style.setProperty("--accent-soft", preset.soft);
    root.style.setProperty("--accent-ink", preset.ink);
  }, [accent, resolvedTheme]);

  // Global keyboard shortcuts (per README "Interactions & Behavior").
  useEffect(() => {
    if (!shouldFitAfterCanvasModeChange.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      requestFitView();
      shouldFitAfterCanvasModeChange.current = false;
    }, 180);

    return () => window.clearTimeout(timer);
  }, [canvasExpanded, requestFitView]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCmdkOpen(!useSchemaWorkspaceStore.getState().cmdkOpen);
        return;
      }
      if (event.key === "Escape" && useSchemaWorkspaceStore.getState().cmdkOpen) {
        event.preventDefault();
        setCmdkOpen(false);
        return;
      }
      if (event.key === "Escape" && canvasExpanded) {
        event.preventDefault();
        shouldFitAfterCanvasModeChange.current = true;
        setCanvasExpanded(false);
        return;
      }
      // The remaining shortcuts must not fire while the user is typing.
      if (isTypingTarget(event.target)) {
        return;
      }
      if (mod && event.key.toLowerCase() === "l") {
        event.preventDefault();
        autoLayout();
      } else if (mod && event.key === "0") {
        event.preventDefault();
        requestFitView();
      } else if (mod && event.key === "Enter") {
        event.preventDefault();
        validateCurrent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    setCmdkOpen,
    autoLayout,
    requestFitView,
    validateCurrent,
    canvasExpanded
  ]);

  // Suppress the unused warning while exposing cmdkOpen on the shell tree —
  // the value is read inside <CommandPalette/>; keeping the subscription here
  // ensures the shell re-renders on open/close (e.g. for any future overlay
  // styling that depends on it).
  void cmdkOpen;

  return (
    <div className={cn("app", canvasExpanded && "app-canvas-expanded")}>
      {canvasExpanded ? (
        <div className="canvas-expanded-shell">
          <CanvasPane
            exportRef={canvasExportRef}
            expanded={canvasExpanded}
            onToggleExpanded={toggleCanvasExpanded}
          />
        </div>
      ) : (
        <>
          <Header />
          <div className={cn("workspace", sbCollapsed && "sidebar-collapsed")}>
            {sbCollapsed ? <CollapsedSidebar /> : <Sidebar />}
            <div className="main">
              <PanelGroup direction="horizontal" style={{ minHeight: 0 }}>
                <Panel defaultSize={44} minSize={28}>
                  <SqlEditorPanel />
                </Panel>
                <PanelResizeHandle
                  style={{
                    width: 1,
                    background: "var(--line)"
                  }}
                />
                <Panel defaultSize={56} minSize={35}>
                  <div style={{ position: "relative", height: "100%" }}>
                    <CanvasPane
                      exportRef={canvasExportRef}
                      expanded={canvasExpanded}
                      onToggleExpanded={toggleCanvasExpanded}
                    />
                    <SchemaInspector />
                  </div>
                </Panel>
              </PanelGroup>
              <BottomPanel />
            </div>
          </div>
        </>
      )}
      <CommandPalette />
    </div>
  );
}
