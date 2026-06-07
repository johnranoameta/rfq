"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import RFQAgentDashboard from "@/components/rfq/RFQAgentDashboard";
import { isAuthenticated } from "@/components/auth/rfqAuth";

export default function Page() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const ok = isAuthenticated();
    setChecked(true);
    if (!ok) {
      router.replace("/login");
    }
  }, [router]);

  /** Never spin forever if effects fail or JS is partially blocked (e.g. remote / strict extensions). */
  useEffect(() => {
    const id = window.setTimeout(() => setChecked(true), 3000);
    return () => window.clearTimeout(id);
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground font-mono text-[12px]">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated()) {
    return (
      <div className="h-dvh overflow-hidden">
        <RFQAgentDashboard />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-muted-foreground text-sm">You need to sign in to use the dashboard.</p>
      <a
        href="/login"
        className="text-sm font-medium text-primary underline underline-offset-4 hover:opacity-90"
      >
        Open sign-in
      </a>
    </div>
  );
}
