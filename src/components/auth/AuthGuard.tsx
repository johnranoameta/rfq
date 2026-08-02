"use client";

import type { ReactNode } from "react";

import { useAuthGuard } from "@/components/auth/useAuthGuard";

type AuthGuardProps = {
  /** Rendered once the check settles unauthenticated (the redirect is already in flight). */
  fallback: ReactNode;
  /** Rendered during SSR and hydration, before auth is known. */
  pending?: ReactNode;
  children: ReactNode;
};

/** The mono placeholder both `/` and `/extraction` used verbatim. */
export function AuthPendingScreen({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground font-mono text-[12px]">{label}</div>
    </div>
  );
}

/** The centred sign-in prompt shown when the guard resolves unauthenticated. */
export function AuthSignInPrompt({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-muted-foreground text-sm">{message}</p>
      <a
        href="/login"
        className="text-sm font-medium text-primary underline underline-offset-4 hover:opacity-90"
      >
        Open sign-in
      </a>
    </div>
  );
}

/**
 * Gates a page on client-side auth: placeholder while checking, `fallback`
 * (plus a redirect to `/login`) when signed out, `children` when signed in.
 */
export function AuthGuard({ fallback, pending, children }: AuthGuardProps) {
  const status = useAuthGuard();

  if (status === "checking") return <>{pending ?? <AuthPendingScreen />}</>;
  if (status === "unauthenticated") return <>{fallback}</>;
  return <>{children}</>;
}
