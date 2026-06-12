/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Obsidian Infrastructure semantic colour tokens
        surface: "#051424",
        "surface-container": "#0f172a",
        "surface-container-high": "#1e293b",
        "surface-container-highest": "#334155",
        "surface-container-lowest": "#020c18",
        "on-surface": "#f8fafc",
        "on-surface-variant": "#94a3b8",
        outline: "#475569",
        primary: "#0ea5e9",
        "primary-container": "#0c4a6e",
        secondary: "#10b981",
        error: "#ef4444",
        "error-container": "#450a0a",
      },
      fontFamily: {
        mono: [
          "Geist",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
