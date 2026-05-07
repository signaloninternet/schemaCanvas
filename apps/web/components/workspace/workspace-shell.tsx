"use client";

import { useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { SchemaCanvas } from "@/components/canvas/schema-canvas";
import { SqlEditorPanel } from "@/components/editor/sql-editor-panel";
import { SchemaInspector } from "@/components/inspector/schema-inspector";
import { BottomPanel } from "@/components/workspace/bottom-panel";
import { TopBar } from "@/components/workspace/top-bar";

export function WorkspaceShell(): React.ReactElement {
  const canvasExportRef = useRef<HTMLDivElement>(null);

  return (
    <main className="flex h-screen flex-col">
      <TopBar canvasExportRef={canvasExportRef} />
      <div className="min-h-0 flex-1 p-4">
        <div className="panel-surface flex h-full flex-col overflow-hidden rounded-xl">
          <PanelGroup direction="vertical">
            <Panel defaultSize={72} minSize={45}>
              <PanelGroup direction="horizontal">
                <Panel defaultSize={41} minSize={28}>
                  <SqlEditorPanel />
                </Panel>
                <PanelResizeHandle className="w-px bg-border" />
                <Panel defaultSize={59} minSize={35}>
                  <div className="relative h-full">
                    <SchemaCanvas exportRef={canvasExportRef} />
                    <SchemaInspector />
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>
            <PanelResizeHandle className="h-px bg-border" />
            <Panel defaultSize={28} minSize={18}>
              <BottomPanel />
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </main>
  );
}
