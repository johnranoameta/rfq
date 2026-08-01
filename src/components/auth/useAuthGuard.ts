"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { isAuthenticated } from "@/components/auth/rfqAuth";
import { useHydrated } from "@/lib/react/useHydrated";

export type AuthStatus = "checking" | "authenticated" | "unauthenticated";

/** Auth only changes via sign-in/sign-out, both of which navigate. */
function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): boolean {
  return isAuthenticated();
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Resolves the current auth status and redirects to `/login` once the check
 * settles unauthenticated.
 *
 * Auth state is browser-only, so the server cannot know it and rendering it
 * directly would be a hydration mismatch. `useSyncExternalStore` handles that
 * by design: it serves `getServerSnapshot` during SSR and hydration, then
 * re-renders with the client snapshot.
 *
 * The three guarded pages each did `useState(false)` plus a `setChecked(true)`
 * effect, which is the same thing by hand and is what
 * `react-hooks/set-state-in-effect` flagged on all three.
 *
 * Returns `"checking"` for the SSR and hydration pass so callers can render
 * the same placeholder the server did.
 */
export function useAuthGuard(): AuthStatus {
  const router = useRouter();
  const hydrated = useHydrated();
  const authed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (hydrated && !authed) router.replace("/login");
  }, [hydrated, authed, router]);

  if (!hydrated) return "checking";
  return authed ? "authenticated" : "unauthenticated";
}
