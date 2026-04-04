"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type UiFontId = "oxanium" | "inter" | "source-sans";

const STORAGE_KEY = "ui-font";

export const UI_FONTS: {
  id: UiFontId;
  label: string;
  description: string;
}[] = [
  { id: "oxanium", label: "Oxanium", description: "Technical — matches the dashboard default" },
  { id: "inter", label: "Inter", description: "Neutral UI — very clear at small sizes" },
  { id: "source-sans", label: "Source Sans 3", description: "Humanist — comfortable for long reading" },
];

function isUiFontId(v: string | null): v is UiFontId {
  return v === "oxanium" || v === "inter" || v === "source-sans";
}

function getInitialFont(): UiFontId {
  if (typeof window === "undefined") return "oxanium";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isUiFontId(stored)) return stored;
  } catch {
    // ignore
  }
  return "oxanium";
}

function applyFontToDocument(id: UiFontId) {
  document.documentElement.dataset.uiFont = id;
}

type FontContextValue = {
  fontId: UiFontId;
  setFontId: (id: UiFontId) => void;
};

const FontContext = createContext<FontContextValue | null>(null);

export function FontProvider({ children }: { children: ReactNode }) {
  const [fontId, setFontIdState] = useState<UiFontId>("oxanium");

  useLayoutEffect(() => {
    const initial = getInitialFont();
    applyFontToDocument(initial);
    queueMicrotask(() => setFontIdState(initial));
  }, []);

  const setFontId = (next: UiFontId) => {
    setFontIdState(next);
    applyFontToDocument(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const value = useMemo(() => ({ fontId, setFontId }), [fontId]);

  return <FontContext.Provider value={value}>{children}</FontContext.Provider>;
}

export function useUiFont() {
  const ctx = useContext(FontContext);
  if (!ctx) throw new Error("useUiFont must be used within FontProvider");
  return ctx;
}
