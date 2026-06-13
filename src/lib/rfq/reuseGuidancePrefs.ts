const KEY = "rfq-agent-reuse-guidance-prefs-v1";

export type ReuseApplyScope = "active_rfq" | "kb_class" | "all_historical";

export type ReuseGuidancePrefs = {
  applyScope: ReuseApplyScope;
};

export const REUSE_APPLY_SCOPE_OPTIONS: {
  id: ReuseApplyScope;
  label: string;
  short: string;
  hint: string;
}[] = [
  {
    id: "active_rfq",
    label: "Same Vendor only",
    short: "Same Vendor",
    hint: "Drafts and customer questions use only the active workbook — its matches, gaps, and quote lines.",
  },
  {
    id: "kb_class",
    label: "Same KB class",
    short: "KB class",
    hint: "Reuse patterns from historical RFQs in the same product class (e.g. Stamping Parts, Machining Parts).",
  },
  {
    id: "all_historical",
    label: "All historical RFQs",
    short: "All RFQs",
    hint: "Search the full historical portfolio when suggesting reuse — useful when the direct match score is low.",
  },
];

const DEFAULT_PREFS: ReuseGuidancePrefs = {
  applyScope: "active_rfq",
};

export function loadReuseGuidancePrefs(): ReuseGuidancePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ReuseGuidancePrefs>;
    const scope = parsed.applyScope;
    if (scope === "active_rfq" || scope === "kb_class" || scope === "all_historical") {
      return { applyScope: scope };
    }
    return DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveReuseGuidancePrefs(prefs: ReuseGuidancePrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* quota */
  }
}

export function reuseScopeSummary(
  scope: ReuseApplyScope,
  kbClassLabel?: string | null,
): string {
  if (scope === "active_rfq") return "this RFQ";
  if (scope === "kb_class") {
    return kbClassLabel?.trim() ? `KB class “${kbClassLabel.trim()}”` : "this KB class";
  }
  return "all historical RFQs";
}
