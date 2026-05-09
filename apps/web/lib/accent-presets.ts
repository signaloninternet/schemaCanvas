export type AccentName = "amber" | "violet" | "emerald" | "rose" | "cyan";

export interface AccentPreset {
  light: string;
  dark: string;
  soft: string;
  ink: string;
}

export const ACCENT_PRESETS: Record<AccentName, AccentPreset> = {
  amber: { light: "#d97706", dark: "#f59e0b", soft: "#fef3c7", ink: "#7c2d12" },
  violet: { light: "#7c3aed", dark: "#a78bfa", soft: "#ede9fe", ink: "#4c1d95" },
  emerald: { light: "#059669", dark: "#34d399", soft: "#d1fae5", ink: "#064e3b" },
  rose: { light: "#e11d48", dark: "#fb7185", soft: "#ffe4e6", ink: "#881337" },
  cyan: { light: "#0891b2", dark: "#22d3ee", soft: "#cffafe", ink: "#164e63" }
};

export const ACCENT_NAMES: AccentName[] = [
  "amber",
  "violet",
  "emerald",
  "rose",
  "cyan"
];
