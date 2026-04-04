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
    if (!ok) router.replace("/login");
    // Schedule async to avoid "setState synchronously in effect" lint error.
    setTimeout(() => setChecked(true), 0);
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground font-mono text-[12px]">Loading...</div>
      </div>
    );
  }

  return isAuthenticated() ? <RFQAgentDashboard /> : null;
}
