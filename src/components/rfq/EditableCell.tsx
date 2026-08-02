"use client";

import { useEffect, useState } from "react";

/**
 * Inline-editable table cell: click to edit, autosave on blur/Enter. Shared by
 * RfqWorkbookBomPanel.tsx (BOM Intelligence, issue #17) and RfqSupplierPartsPanel.tsx
 * (Supplier & Part DB) — same autosave/error/resync behavior for both.
 */
export function EditableCell({
  value,
  numeric = false,
  onSave,
}: {
  value: string;
  numeric?: boolean;
  /** Resolves with the saved field's server-normalized display value (e.g. "007" -> "7"). */
  onSave: (raw: string) => Promise<string>;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = async () => {
    if (draft === value) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await onSave(draft);
      // Resync from this save's own response rather than waiting for the `value` prop
      // to come back around through a later reload() — if the server normalizes the
      // input to something already equal to the current `value`, the prop never
      // changes and the effect above would never fire, leaving stale text on screen.
      setDraft(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        inputMode={numeric ? "decimal" : undefined}
        className={["ra-cell-input", error ? "ra-cell-input-error" : ""].join(" ")}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onWheel={(e) => e.currentTarget.blur()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
      />
      {error ? <div className="text-[11px] text-[var(--ra-red)] mt-1">{error}</div> : null}
    </div>
  );
}
