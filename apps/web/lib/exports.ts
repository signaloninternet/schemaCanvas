import { toPng, toSvg } from "html-to-image";
import { downloadTextFile } from "@/lib/utils";

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-") || "schema";
}

export function exportSqlFile(sqlDraft: string, projectName: string): void {
  downloadTextFile(`${slug(projectName)}.sql`, sqlDraft, "text/sql");
}

async function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

export async function exportCanvasPng(
  node: HTMLElement,
  projectName: string
): Promise<void> {
  const dataUrl = await toPng(node, { cacheBust: true });
  await downloadDataUrl(dataUrl, `${slug(projectName)}.png`);
}

export async function exportCanvasSvg(
  node: HTMLElement,
  projectName: string
): Promise<void> {
  const dataUrl = await toSvg(node, { cacheBust: true });
  await downloadDataUrl(dataUrl, `${slug(projectName)}.svg`);
}

export function findCanvasNode(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  return document.querySelector<HTMLElement>(".canvas-wrap");
}
