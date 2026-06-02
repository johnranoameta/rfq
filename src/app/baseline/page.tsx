"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import BaselineRfqObjectPanel from "@/components/baseline/BaselineRfqObjectPanel";
import { isAuthenticated } from "@/components/auth/rfqAuth";

export default function BaselinePage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const ok = isAuthenticated();
    setChecked(true);
    if (!ok) router.replace("/login");
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated()) {
    return null;
  }

  return <BaselineRfqObjectPanel />;
}
