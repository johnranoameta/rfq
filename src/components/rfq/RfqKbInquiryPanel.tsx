"use client";

import { useCallback, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export type RfqKbInquiryPanelProps = {
  packageId?: string | null;
  packageLabel?: string | null;
  sessionId?: string | null;
  sessionLabel?: string | null;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "Compare RFQ1 vs RFQ2 — what is different in the Supplier Request Form (section 1.3)?",
  "List field-by-field differences between all extracted RFQs.",
  "Which attachments are missing or incomplete?",
  "Summarize commercial and supplier form fields for RFQ1.",
];

export function RfqKbInquiryPanel({
  packageId,
  packageLabel,
  sessionId,
  sessionLabel,
}: RfqKbInquiryPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      setError(null);
      const nextUser: ChatMessage = { role: "user", content: trimmed };
      const history = [...messages, nextUser];
      setMessages(history);
      setInput("");
      setBusy(true);

      try {
        const res = await fetch("/api/rfq/kb-inquiry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            packageId: packageId ?? null,
            sessionId: sessionId ?? null,
          }),
        });
        const data = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        const reply = typeof data.reply === "string" ? data.reply.trim() : "";
        if (!reply) throw new Error("Empty reply from server");
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Inquiry failed");
        setMessages((prev) => prev.slice(0, -1));
        setInput(trimmed);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, packageId, sessionId],
  );

  return (
    <>
      <div className="ra-canvas-top">
        <div>
          <div className="ra-canvas-title flex items-center gap-2">
            <MessageCircle className="size-5 text-[var(--ra-accent)]" aria-hidden />
            Inquiry
          </div>
          <div className="ra-canvas-sub">
            Compare and query Word-extracted RFQs (RFQ1, RFQ2, …) — supplier forms, section fields,
            attachments
            {packageLabel ? (
              <>
                {" "}
                · Focus: <span className="font-medium text-[var(--ra-text)]">{packageLabel}</span> (all
                packages included for comparisons)
              </>
            ) : (
              " · All extracted packages are included when you ask to compare"
            )}
          </div>
        </div>
      </div>

      <div className="ra-kb-inquiry flex flex-col flex-1 min-h-0">
        <div ref={scrollRef} className="ra-kb-inquiry-scroll flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 ? (
            <div className="ra-kb-inquiry-empty">
              <p className="text-sm text-[var(--ra-mid)] mb-3">
                Ask for RFQ1 vs RFQ2 diffs (e.g. Supplier Name blank vs TEST), missing attachments, or any
                section field.
              </p>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="ra-kb-inquiry-starter"
                    disabled={busy}
                    onClick={() => void send(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={[
                  "ra-kb-inquiry-msg",
                  m.role === "user" ? "ra-kb-inquiry-msg-user" : "ra-kb-inquiry-msg-assistant",
                ].join(" ")}
              >
                <div className="ra-kb-inquiry-msg-role">{m.role === "user" ? "You" : "RFQ Assistant"}</div>
                <div className="ra-kb-inquiry-msg-body whitespace-pre-wrap">{m.content}</div>
              </div>
            ))
          )}
          {busy ? (
            <div className="text-[12px] text-[var(--ra-muted)] px-1">Thinking…</div>
          ) : null}
        </div>

        {error ? (
          <div className="mx-4 mb-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[12px] text-red-800 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <form
          className="ra-kb-inquiry-form shrink-0 border-t border-[var(--ra-border)] p-3 flex gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about RFQ fields, gaps, matching…"
            rows={2}
            disabled={busy}
            className="ra-kb-inquiry-input flex-1 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <Button type="submit" size="sm" disabled={busy || !input.trim()} className="shrink-0 gap-1.5">
            <Send className="size-3.5" aria-hidden />
            Send
          </Button>
        </form>
      </div>
    </>
  );
}
