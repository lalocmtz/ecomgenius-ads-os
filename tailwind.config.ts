import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0a0f",
          raised: "#111118",
          hover: "#1a1a22",
        },
        border: {
          DEFAULT: "#1f1f2a",
          strong: "#2a2a38",
        },
        text: {
          primary: "#e8e8ee",
          secondary: "#9a9aa8",
          muted: "#5a5a68",
        },
        verdict: {
          winner: "#00e87b",
          loser: "#ff4466",
          borderline: "#ffc44d",
          promising: "#4d8eff",
          inconcluso: "#a855f7",
          killed: "#666666",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "Inter", "system-ui", "sans-serif"],
        mono: ["Space Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
