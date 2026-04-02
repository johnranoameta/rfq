"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useThemeMode } from "@/components/theme/ThemeProvider";

export function ThemeToggle() {
  const { resolvedTheme, setMode } = useThemeMode();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="border-border bg-background/20 hover:bg-background/30"
      onClick={() => setMode(isDark ? "light" : "dark")}
      aria-label="Toggle dark mode"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}

