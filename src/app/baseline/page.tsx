"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import BaselineRfqObjectPanel from "@/components/baseline/BaselineRfqObjectPanel";

/** This page used a plain (non-mono) placeholder; the other two use the mono default. */
function BaselinePending() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

export default function BaselinePage() {
  return (
    <AuthGuard pending={<BaselinePending />} fallback={null}>
      <BaselineRfqObjectPanel />
    </AuthGuard>
  );
}
