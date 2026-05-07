import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { BottomPanel } from "@/components/workspace/bottom-panel";
import { useSchemaWorkspaceStore } from "@/lib/schema-workspace-store";

describe("BottomPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    useSchemaWorkspaceStore.getState().loadPreset("project-management");
  });

  it("renders review tabs and default problems content", () => {
    render(<BottomPanel />);

    expect(screen.getByText("Problems")).toBeInTheDocument();
    expect(screen.getByText("Migration")).toBeInTheDocument();
    expect(screen.getByText("Documentation")).toBeInTheDocument();
    expect(screen.getByText("Schema JSON")).toBeInTheDocument();
    expect(screen.getAllByText(/better fit for an enum/i)).toHaveLength(2);
  });
});
