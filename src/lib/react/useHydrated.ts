"use client";

import { useSyncExternalStore } from "react";

/** Auth and prefs never change without a navigation, so there is nothing to subscribe to. */
function subscribe(): () => void {
  return () => {};
}

const clientSnapshot = () => true;
const serverSnapshot = () => false;

/**
 * `false` during SSR and the hydration pass, `true` afterwards.
 *
 * Use this to gate reads of browser-only state (localStorage, `matchMedia`,
 * …) that would otherwise cause a hydration mismatch. It replaces the
 * `useState(false)` + `setFlag(true)` effect pair, which React flags under
 * `react-hooks/set-state-in-effect` because it forces a second render pass
 * through an effect rather than through the store contract React provides.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
