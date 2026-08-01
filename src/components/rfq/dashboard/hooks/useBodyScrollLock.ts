"use client";

import { useEffect } from "react";

/**
 * Pins `<html>` and `<body>` to `overflow: hidden` while mounted, restoring
 * whatever was there before on unmount.
 *
 * The dashboard is a fixed-height app shell that scrolls its own panes; page
 * scroll would double-scroll it.
 */
export function useBodyScrollLock(): void {
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);
}
