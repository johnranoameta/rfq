"use client";

import { AuthGuard, AuthSignInPrompt } from "@/components/auth/AuthGuard";
import RFQAgentDashboard from "@/components/rfq/RFQAgentDashboard";

export default function Page() {
  return (
    <AuthGuard fallback={<AuthSignInPrompt message="You need to sign in to use the dashboard." />}>
      <RFQAgentDashboard />
    </AuthGuard>
  );
}
