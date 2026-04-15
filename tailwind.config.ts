import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      gridTemplateColumns: {
        "18": "repeat(18, minmax(0, 1fr))",
      },
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        card: "var(--color-card)",
        muted: "var(--color-muted)",
        border: "var(--color-border)",
        "muted-foreground": "var(--color-muted-foreground)",
        ring: "var(--color-ring)",
        "accent-cyan": "var(--color-accent-cyan)",
        "accent-emerald": "var(--color-accent-emerald)",
        "accent-amber": "var(--color-accent-amber)",
        "accent-rose": "var(--color-accent-rose)",
      },
    },
  },
};

export default config;

