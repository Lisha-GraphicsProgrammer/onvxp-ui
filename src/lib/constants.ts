// Shared design tokens and config used across ONVXP pages.

export const DRAWER_OPEN = 248;
export const DRAWER_CLOSED = 56;

// ── Teal-green + white brand palette — final direction, confirmed. ──
export const CYAN = "#2B7A78";       // Primary brand teal-green
export const PURPLE = "#17252A";     // Near-black dark teal, gradient partner
export const GREEN = "#27AE60";      // Unchanged — semantic success/active
export const AMBER = "#D4891A";      // Unchanged — semantic warning
export const CREAM = "#DEF2F1";      // Pale mint, for text/highlights on dark teal
export const RED = "#E74C3C";        // Unchanged — semantic critical alerts

// Sidebar/accent color
export const ACCENT = "#2B7A78";     // Primary brand teal-green
export const ACCENT_LIGHT = "#FEFFFF"; // Near-white, for text on teal

export const YELLOW = "#DEF2F1";     // Repurposed to pale mint — no longer a yellow highlight

// Zone colors updated to teal-green + white palette
export const ZONE_COLORS = [
  "#2B7A78", "#27AE60", "#D4891A", "#17252A",
  "#E74C3C", "#DEF2F1", "#3AAFA9", "#FEFFFF"
];

export const severityConfig = {
  critical: { color: "#E74C3C", bg: "rgba(231,76,60,0.12)", border: "rgba(231,76,60,0.30)" },
  high:     { color: "#D4891A", bg: "rgba(212,137,26,0.12)", border: "rgba(212,137,26,0.30)" },
  medium:   { color: "#DEF2F1", bg: "rgba(222,242,241,0.10)", border: "rgba(222,242,241,0.25)" },
};