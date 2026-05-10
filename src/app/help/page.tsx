import type { Metadata } from "next";
import Link from "next/link";
import { CircleHelp } from "lucide-react";

import { HelpManual } from "@/components/help/HelpManual";

export const metadata: Metadata = {
  title: "User guide — RFQ Assistant",
  description:
    "Step-by-step how to use RFQ Assistant, plus workspaces, Knowledge Base, New RFQs, matching, gaps, and glossary.",
};

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <CircleHelp className="size-5 shrink-0 text-primary" aria-hidden />
            <h1 className="text-base font-semibold tracking-tight truncate">RFQ Assistant — user guide</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-sm">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link
              href="/"
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>
      <HelpManual />
    </div>
  );
}
