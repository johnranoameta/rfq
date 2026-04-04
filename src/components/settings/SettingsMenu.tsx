"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Settings2, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useThemeMode, type ThemeMode } from "@/components/theme/ThemeProvider";
import { UI_FONTS, useUiFont, type UiFontId } from "@/components/settings/FontProvider";

const themeOptions: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "System", icon: Monitor },
];

const previewFontStack: Record<UiFontId, string> = {
  oxanium: '"Oxanium", ui-sans-serif, system-ui, sans-serif',
  inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
  "source-sans": '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
};

export function SettingsMenu() {
  const { mode, setMode } = useThemeMode();
  const { fontId, setFontId } = useUiFont();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        className="border-border bg-background/20 hover:bg-background/30"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Open settings"
        title="Settings"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2 className="h-4 w-4" />
      </Button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Settings"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(calc(100vw-24px),320px)] rounded-2xl border border-border bg-card/95 p-4 shadow-lg shadow-black/10 backdrop-blur-md dark:shadow-black/40"
        >
          <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Appearance
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {themeOptions.map(({ mode: m, label, icon: Icon }) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={[
                    "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    active
                      ? "border-accent/50 bg-accent/10 text-accent dark:text-accent/90"
                      : "border-border bg-background/30 text-muted-foreground hover:bg-background/40 hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Interface font
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
            Sans-serif for UI labels and paragraphs. Monospace (IBM Plex Mono) stays the same for codes and numbers.
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {UI_FONTS.map((f) => {
              const active = fontId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFontId(f.id)}
                  className={[
                    "w-full rounded-xl border px-3 py-2.5 text-left transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    active
                      ? "border-accent/50 bg-accent/10 ring-1 ring-accent/20"
                      : "border-border bg-background/25 hover:bg-background/35",
                  ].join(" ")}
                >
                  <div
                    className="text-[13px] font-semibold text-foreground"
                    style={{ fontFamily: previewFontStack[f.id] }}
                  >
                    {f.label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                    {f.description}
                  </div>
                  <div
                    className="mt-2 text-[12px] text-muted-foreground"
                    style={{ fontFamily: previewFontStack[f.id] }}
                  >
                    The quick brown fox jumps over the lazy dog.
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
