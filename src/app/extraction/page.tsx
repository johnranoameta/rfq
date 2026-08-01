"use client";

import { AuthGuard, AuthSignInPrompt } from "@/components/auth/AuthGuard";
import WordPackageExtractionPanel from "@/components/extraction/WordPackageExtractionPanel";

export default function ExtractionPage() {
  return (
    <AuthGuard fallback={<AuthSignInPrompt message="Sign in to use Word package extraction." />}>
      <WordPackageExtractionPanel />
    </AuthGuard>
  );
}
