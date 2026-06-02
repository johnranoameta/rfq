"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import WordPackageExtractionPanel from "@/components/extraction/WordPackageExtractionPanel";
import { isAuthenticated } from "@/components/auth/rfqAuth";

export default function ExtractionPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const ok = isAuthenticated();
    setChecked(true);
    if (!ok) router.replace("/login");
  }, [router]);

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

  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-muted-foreground text-sm">Sign in to use Word package extraction.</p>
        <a href="/login" className="text-sm font-medium text-primary underline underline-offset-4">
          Open sign-in
        </a>
      </div>
    );
  }

  return <WordPackageExtractionPanel />;
}
