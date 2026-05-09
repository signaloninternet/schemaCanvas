"use client";

import { useRef, useState } from "react";
import { useTheme } from "next-themes";
import { toPng, toSvg } from "html-to-image";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FileCode2,
  Github,
  LayoutGrid,
  MoonStar,
  Palette,
  Plus,
  SunMedium,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getDocumentationExport,
  useSchemaWorkspaceStore
} from "@/lib/schema-workspace-store";
import { downloadTextFile } from "@/lib/utils";

interface TopBarProps {
  canvasExportRef: React.RefObject<HTMLDivElement | null>;
}

export function TopBar({ canvasExportRef }: TopBarProps): React.ReactElement {
  const { theme, setTheme } = useTheme();
  const projectName = useSchemaWorkspaceStore((state) => state.projectName);
  const setProjectName = useSchemaWorkspaceStore((state) => state.setProjectName);
  const schema = useSchemaWorkspaceStore((state) => state.schema);
  const sqlDraft = useSchemaWorkspaceStore((state) => state.sqlDraft);
  const validateCurrent = useSchemaWorkspaceStore((state) => state.validateCurrent);
  const autoLayout = useSchemaWorkspaceStore((state) => state.autoLayout);
  const addTable = useSchemaWorkspaceStore((state) => state.addTable);
  const addEnum = useSchemaWorkspaceStore((state) => state.addEnum);
  const importSql = useSchemaWorkspaceStore((state) => state.importSql);
  const importSchemaModel = useSchemaWorkspaceStore((state) => state.importSchemaModel);
  const resetToBlank = useSchemaWorkspaceStore((state) => state.resetToBlank);
  const loadPreset = useSchemaWorkspaceStore((state) => state.loadPreset);
  const currentPreset = useSchemaWorkspaceStore((state) => state.currentPreset);
  const [enumName, setEnumName] = useState("");
  const [enumValues, setEnumValues] = useState("active\narchived");
  const sqlFileRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);

  const exportSql = (): void => {
    downloadTextFile(
      `${projectName.toLowerCase().replace(/\s+/g, "-") || "schema"}.sql`,
      sqlDraft,
      "text/sql"
    );
  };

  const exportMarkdown = (): void => {
    downloadTextFile(
      `${projectName.toLowerCase().replace(/\s+/g, "-") || "schema"}-docs.md`,
      getDocumentationExport(schema),
      "text/markdown"
    );
  };

  const exportJson = (): void => {
    downloadTextFile(
      `${projectName.toLowerCase().replace(/\s+/g, "-") || "schema"}.json`,
      JSON.stringify(schema, null, 2),
      "application/json"
    );
  };

  const exportDiagram = async (kind: "png" | "svg"): Promise<void> => {
    if (!canvasExportRef.current) {
      return;
    }

    const dataUrl =
      kind === "png"
        ? await toPng(canvasExportRef.current, { cacheBust: true })
        : await toSvg(canvasExportRef.current, { cacheBust: true });

    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${projectName.toLowerCase().replace(/\s+/g, "-") || "schema"}.${kind}`;
    anchor.click();
  };

  const onSqlFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const content = await file.text();
    importSql(content, file.name.replace(/\.sql$/i, ""));
    event.target.value = "";
    toast.success("SQL imported.");
  };

  const onJsonFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const content = await file.text();
    try {
      importSchemaModel(content);
      toast.success("SchemaModel imported.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-[color:var(--tbl-blue)] bg-[color:var(--tbl-blue-soft)] p-2 text-[color:var(--tbl-blue)]">
            <Palette className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">SchemaCanvas</p>
            <p className="text-xs text-muted-foreground">
              SQL, ERD, documentation, and migration review in one schema model.
            </p>
          </div>
        </div>
        <Input
          className="w-[220px]"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          aria-label="Project name"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={currentPreset}
          onValueChange={(value) => loadPreset(value as typeof currentPreset)}
        >
          <SelectTrigger className="w-[188px]">
            <SelectValue placeholder="Choose example" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="blank">Blank project</SelectItem>
            <SelectItem value="ecommerce">Ecommerce sample</SelectItem>
            <SelectItem value="project-management">Project management</SelectItem>
            <SelectItem value="valet-platform">Valet platform</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="secondary" size="sm" onClick={addTable}>
          <Plus className="h-4 w-4" />
          Table
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <FileCode2 className="h-4 w-4" />
              Enum
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create enum</DialogTitle>
              <DialogDescription>
                Add a PostgreSQL enum and use it in column type definitions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="enum-name">Enum name</Label>
                <Input
                  id="enum-name"
                  value={enumName}
                  onChange={(event) => setEnumName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enum-values">Values, one per line</Label>
                <Textarea
                  id="enum-values"
                  value={enumValues}
                  onChange={(event) => setEnumValues(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  try {
                    addEnum(
                      enumName,
                      enumValues
                        .split("\n")
                        .map((value) => value.trim())
                        .filter(Boolean)
                    );
                    setEnumName("");
                    setEnumValues("active\narchived");
                    toast.success("Enum created.");
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Could not create enum."
                    );
                  }
                }}
              >
                Save enum
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ArrowUpFromLine className="h-4 w-4" />
              Import
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Input</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => sqlFileRef.current?.click()}>
              SQL file
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => jsonFileRef.current?.click()}>
              SchemaModel JSON
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={resetToBlank}>New blank project</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ArrowDownToLine className="h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Artifacts</DropdownMenuLabel>
            <DropdownMenuItem onClick={exportSql}>SQL</DropdownMenuItem>
            <DropdownMenuItem onClick={exportMarkdown}>Markdown docs</DropdownMenuItem>
            <DropdownMenuItem onClick={exportJson}>SchemaModel JSON</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void exportDiagram("png")}>
              PNG diagram
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void exportDiagram("svg")}>
              SVG diagram
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" onClick={autoLayout}>
          <LayoutGrid className="h-4 w-4" />
          Auto-layout
        </Button>

        <Button variant="outline" size="sm" onClick={validateCurrent}>
          <ShieldCheck className="h-4 w-4" />
          Validate
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <SunMedium className="h-4 w-4" />
          ) : (
            <MoonStar className="h-4 w-4" />
          )}
        </Button>

        <Button variant="ghost" size="icon" asChild>
          <a href="https://github.com" target="_blank" rel="noreferrer">
            <Github className="h-4 w-4" />
          </a>
        </Button>
      </div>

      <input
        ref={sqlFileRef}
        type="file"
        accept=".sql,text/sql,text/plain"
        className="hidden"
        onChange={(event) => void onSqlFileChange(event)}
      />
      <input
        ref={jsonFileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => void onJsonFileChange(event)}
      />
    </header>
  );
}
