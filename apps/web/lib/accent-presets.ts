export type AccentName = "green" | "yellow" | "blue";

export interface AccentPreset {
  light: string;
  dark: string;
  soft: string;
  ink: string;
}

export const ACCENT_PRESETS: Record<AccentName, AccentPreset> = {
  green: {
    light: "#581c87",
    dark: "#a855f7",
    soft: "color-mix(in oklch, var(--accent) 14%, var(--bg))",
    ink: "color-mix(in oklch, var(--accent) 64%, var(--ink))"
  },
  yellow: {
    light: "#f97316",
    dark: "#fb923c",
    soft: "color-mix(in oklch, var(--accent) 18%, var(--bg))",
    ink: "color-mix(in oklch, var(--accent) 50%, var(--ink))"
  },
  blue: {
    light: "#2563eb",
    dark: "#60a5fa",
    soft: "color-mix(in oklch, var(--accent) 14%, var(--bg))",
    ink: "color-mix(in oklch, var(--accent) 64%, var(--ink))"
  }
};

export const ACCENT_NAMES: AccentName[] = [
  "green",
  "yellow",
  "blue"
];
