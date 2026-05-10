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
    expect(screen.getByText("AST")).toBeInTheDocument();
    expect(screen.getByText("Mind Map")).toBeInTheDocument();
    expect(screen.getByText("Schema JSON")).toBeInTheDocument();
    expect(screen.getAllByText(/better fit for an enum/i)).toHaveLength(2);
  });

  it("renders the migration tab as a branch diff", () => {
    useSchemaWorkspaceStore.getState().loadPreset("ecommerce");
    useSchemaWorkspaceStore.getState().setActiveBottomTab("migration");

    render(<BottomPanel />);

    expect(
      screen.getAllByText("main v0.4 -> analytics-fork v0.2").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/ALTER TYPE order_status ADD VALUE IF NOT EXISTS/)
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/ALTER TABLE customers ADD COLUMN phone TEXT;/)
        .length,
    ).toBeGreaterThan(0);
    expect(screen.queryAllByText(/CREATE TABLE customers \(/)).toHaveLength(0);
  });
});
