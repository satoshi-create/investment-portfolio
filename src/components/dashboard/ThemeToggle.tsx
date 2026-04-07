"use client";

import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch: next-themes resolves theme on client.
  if (!mounted) {
    return (
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg border border-border bg-card/60 p-2 text-muted-foreground opacity-70"
        aria-label="Toggle theme"
        disabled
      >
        <Sun size={16} />
      </button>
    );
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex items-center justify-center rounded-lg border border-border bg-card/60 p-2 text-muted-foreground hover:bg-muted transition-colors"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} className="text-slate-700" />}
    </button>
  );
}

