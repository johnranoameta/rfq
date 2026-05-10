import type { ReactNode } from "react";

const toc = [
  { id: "quick-start", label: "How to use (step-by-step)" },
  { id: "overview", label: "1. What this app is for" },
  { id: "sign-in", label: "2. Signing in" },
  { id: "layout", label: "3. Screen layout" },
  { id: "workspace", label: "4. Workspace modes" },
  { id: "knowledge-base", label: "5. Knowledge Base" },
  { id: "new-rfq", label: "6. New RFQs (active analysis)" },
  { id: "workbook-format", label: "7. Excel workbook format" },
  { id: "pipeline", label: "8. Analysis pipeline" },
  { id: "matching", label: "9. Matching & historical reference" },
  { id: "gaps-quotes", label: "10. Gaps, documents, and quote views" },
  { id: "saved-portfolio", label: "11. Saved analyses & Portfolio" },
  { id: "data-storage", label: "12. Where data lives" },
  { id: "kb-assignment", label: "13. Knowledge Base categories (assignment)" },
  { id: "settings", label: "14. Settings" },
  { id: "glossary", label: "15. Glossary" },
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2 mb-4">{title}</h2>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

export function HelpManual() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-20">
      <div
        id="quick-start"
        className="scroll-mt-24 rounded-xl border-2 border-primary/35 bg-primary/5 dark:bg-primary/10 px-4 py-5 sm:px-6 mb-8"
        role="region"
        aria-labelledby="quick-start-heading"
      >
        <h2 id="quick-start-heading" className="text-base font-semibold text-foreground mb-3">
          How to use this app (start here)
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          In the dashboard <strong className="text-foreground">top bar</strong>, click the{" "}
          <strong className="text-foreground">Guide</strong> button (question-mark icon) — it opens this page in a{" "}
          <strong className="text-foreground">new browser tab</strong> so you can keep working in the app.
        </p>
        <ol className="space-y-3 text-sm text-muted-foreground list-decimal pl-5 [&_strong]:text-foreground leading-relaxed">
          <li>
            <strong>Sign in</strong> on the login screen (same Guide icon works there too).
          </li>
          <li>
            <strong>Browse history by category</strong> — In the sidebar, click <strong>Knowledge Base</strong>, then
            pick a class (e.g. Stamping Parts). Use tabs <strong>Summary</strong>, <strong>Matching</strong>, and{" "}
            <strong>Historical RFQs</strong> to read how that class is defined and which RFQs sit in the bucket.
          </li>
          <li>
            <strong>Start a new RFQ</strong> — Click <strong>New RFQs</strong> in the sidebar (or{" "}
            <strong>+ New RFQ</strong> in the top bar). If no file is open, you will see an upload card.
          </li>
          <li>
            <strong>Upload a workbook</strong> — Use a <strong>four-sheet Excel</strong> file (Header, Line_Items,
            Technical_Specs, Supplier_Responses). After upload, wait until analysis finishes (sidebar shows status such
            as <em>done</em> or <em>analyzing</em>).
          </li>
          <li>
            <strong>Open the RFQ</strong> — Click the file name in the sidebar under New RFQs. The main area fills with
            tabs: start with <strong>Parsed Summary</strong> to confirm the extract, then <strong>Matching</strong> for
            historical peers and <strong>Coverage</strong> for how many match dimensions fired.
          </li>
          <li>
            <strong>Review gaps</strong> — Open <strong>Gaps &amp; Conflicts</strong> (or the gaps tab) for risk score,
            missing items, and suggested actions. Use <strong>Documents</strong> if you are resolving missing-package
            slots.
          </li>
          <li>
            <strong>Check KB class on the RFQ</strong> — Under the large title, the subtitle may show{" "}
            <strong>KB class: …</strong> after analysis. That is the procurement bucket for the <em>whole</em> upload (one
            class per file), not per line item.
          </li>
          <li>
            <strong>Workspace tools</strong> — <strong>Saved analyses</strong> lists every stored analysis (search,
            open detail, delete). <strong>Portfolio</strong> shows match-strength rollups across uploads.
          </li>
          <li>
            <strong>Tune matching (optional)</strong> — Open the <strong>gear</strong> menu → Match scoring to adjust
            global weights; use <strong>Refresh match settings</strong> on Knowledge Base → Matching if values look
            stale.
          </li>
          <li>
            <strong>Sign out</strong> — Use <strong>Log out</strong> at the bottom of the sidebar when you leave a shared
            machine.
          </li>
        </ol>
      </div>

      <p className="text-sm text-muted-foreground mb-8">
        The sections below explain <strong className="text-foreground">what each part means</strong> (process,
        storage, glossary). Skip ahead using the table of contents.
      </p>

      <nav
        aria-label="Table of contents"
        className="rounded-lg border border-border bg-card/50 p-4 mb-12 text-sm"
      >
        <div className="font-medium text-foreground mb-2">Contents</div>
        <ol className="space-y-1.5 list-decimal list-inside text-muted-foreground">
          {toc.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="text-primary hover:underline underline-offset-2">
                {t.id === "quick-start" ? t.label : t.label.replace(/^\d+\.\s*/, "")}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-14">
        <Section id="overview" title="1. What this app is for (detail)">
          <p>
            <strong>RFQ Assistant</strong> helps you work a <strong>Request for Quotation (RFQ)</strong>: understand
            package completeness, compare the request to <strong>historical</strong> programs, surface{" "}
            <strong>gaps</strong> and risks, and reason about pricing bands—before you send questions to suppliers or
            lock a quote strategy.
          </p>
          <p>
            The app has two big themes: a <strong>Knowledge Base</strong> of past RFQs (and uploads treated as
            historical), and <strong>New RFQs</strong> where you open one package at a time and run structured
            analysis tabs (summary, matching, coverage, gaps, etc.).
          </p>
        </Section>

        <Section id="sign-in" title="2. Signing in">
          <p>
            Access to the main dashboard is gated by a <strong>browser-local sign-in</strong> (demo-style). After
            sign-in, your session is stored on the device; use <strong>Log out</strong> in the sidebar when finished
            on a shared computer.
          </p>
        </Section>

        <Section id="layout" title="3. Screen layout">
          <ul>
            <li>
              <strong>Top bar</strong>: product name, high-level counts (KB classes, historical RFQs, new RFQs),
              workspace shortcuts, settings, theme, and <strong>Help</strong> (this manual).
            </li>
            <li>
              <strong>Left sidebar</strong>: switches workspace mode and (in Knowledge Base) lists procurement{" "}
              <strong>classes</strong> with counts; in New RFQs it lists uploaded files and status.
            </li>
            <li>
              <strong>Main canvas</strong>: content for the current workspace and selection.
            </li>
          </ul>
        </Section>

        <Section id="workspace" title="4. Workspace modes">
          <p>The sidebar <strong>Workspace</strong> section has four entries:</p>
          <ul>
            <li>
              <strong>Knowledge Base</strong> — Browse RFQs grouped by <strong>KB class</strong> (procurement
              category). Pick a class to see summary text, matching documentation, and the list of RFQs in that
              bucket.
            </li>
            <li>
              <strong>New RFQs</strong> — Pick an uploaded workbook (or upload one), then work the analysis tabs for
              that single RFQ.
            </li>
            <li>
              <strong>Saved analyses</strong> — Workspace-wide library of persisted analyses (SQLite rows per upload),
              with detail, delete, and optional historical imports. <em>Not</em> filtered by the KB class you last
              selected.
            </li>
            <li>
              <strong>Portfolio</strong> — Workspace-wide view of how strong historical matches are across saved
              uploads (bands, counts). Also not tied to a single KB class filter.
            </li>
          </ul>
        </Section>

        <Section id="knowledge-base" title="5. Knowledge Base">
          <p>
            <strong>Purpose</strong>: Give a stable map of “what kind of spend is this?” across historical data and
            analyzed uploads, so you can explore peers before opening a new file.
          </p>
          <p>
            <strong>KB class (category)</strong>: Each RFQ row is placed in <strong>exactly one</strong> class for the
            sidebar. Classes come from the <code className="text-xs bg-muted px-1 rounded">kb_categories</code>{" "}
            table (seeded defaults plus any new rows created when the classifier proposes a new slug). Labels shown in
            the UI are resolved from that table when possible.
          </p>
          <p>
            <strong>Mixed BOM caveat</strong>: If one Excel workbook contains very different line types (e.g. PCB +
            bracket), the system still assigns <strong>one</strong> KB class to the whole upload for sidebar placement.
            Line-level behavior differs for <strong>matching</strong> (see §9).
          </p>
          <p>
            <strong>Tabs inside a class</strong>:
          </p>
          <ul>
            <li>
              <strong>Summary</strong> — Class description, counts, profile id, and pointers to matching settings.
            </li>
            <li>
              <strong>Matching</strong> — (1) Signal dimensions the engine can score, and (2) global{" "}
              <strong>scoring weights</strong> (same weights for every class unless you change them in Settings).
            </li>
            <li>
              <strong>Historical RFQs</strong> — Table of RFQs in this class (relational seed rows and/or analyzed
              uploads mapped to this slug).
            </li>
          </ul>
        </Section>

        <Section id="new-rfq" title="6. New RFQs (active analysis)">
          <p>
            When you select <strong>New RFQs</strong> and open a file from the sidebar, the main area shows the{" "}
            <strong>workflow strip</strong> (Upload → Parse → …) and a set of <strong>tabs</strong> driven by that
            RFQ’s persisted analysis.
          </p>
          <p>
            <strong>Header subtitle</strong> may include <code className="text-xs bg-muted px-1 rounded">KB class:</code>{" "}
            after analysis—this is the resolved procurement class for that <em>whole</em> upload, not the part title
            (the large title is still the primary part / program title from the parse).
          </p>
          <p>
            Typical tabs include <strong>Parsed Summary</strong>, <strong>Matching</strong>, <strong>Coverage</strong>,{" "}
            <strong>Gaps</strong>, reuse / documents / quote style panels—each reads from the same stored parse, gap,
            and historical payload for that session.
          </p>
        </Section>

        <Section id="workbook-format" title="7. Excel workbook format">
          <p>
            The first-class RFQ package for automated parsing is a <strong>four-sheet Excel workbook</strong> with
            these sheets (names may use common aliases; the parser normalizes them):
          </p>
          <ul>
            <li>
              <strong>Header</strong> — One logical row: RFQ id, customer, region, annual volume, currency, SOP date,
              etc.
            </li>
            <li>
              <strong>Line_Items</strong> — Parts/lines: item id, part name, system/subsystem/level, material, process,
              target price, tooling flag, and optional columns such as <code className="text-xs bg-muted px-1 rounded">thickness_mm</code> and{" "}
              <code className="text-xs bg-muted px-1 rounded">line_annual_volume</code> for richer matching.
            </li>
            <li>
              <strong>Technical_Specs</strong> — Free-text requirements keyed by part name (matched loosely to lines).
            </li>
            <li>
              <strong>Supplier_Responses</strong> — Optional competitive rows (supplier × line) used in gap and
              benchmark reasoning.
            </li>
          </ul>
          <p>
            If the file does not match this model, analysis may be limited or skipped; the UI calls that out when you
            only stored the file without a successful workbook parse.
          </p>
        </Section>

        <Section id="pipeline" title="8. Analysis pipeline">
          <p>For a supported workbook upload, the server roughly does:</p>
          <ol>
            <li>
              <strong>Parse</strong> — Read sheets into a normalized structure (line items, specs, supplier quotes).
            </li>
            <li>
              <strong>Historical knowledge</strong> — Build match criteria per line (and aggregate), rank candidate
              historical projects, attach scores and “reason” strings.
            </li>
            <li>
              <strong>Heuristic gaps</strong> — A rules-based gap pass using workbook structure + match context.
            </li>
            <li>
              <strong>Model-assisted gap pass</strong> (when a language-model API key is configured on the server) —
              Produces risk, completeness, missing-attachment style findings, and narrative recommendations. If that
              integration is off, heuristic-only behavior applies where configured.
            </li>
            <li>
              <strong>KB assignment</strong> — When the same integration is available, an additional classifier step
              proposes or reuses a <strong>KB category</strong> slug/label; otherwise a deterministic fallback maps into
              canonical classes. Result is stored on the parse session row.
            </li>
            <li>
              <strong>Persist</strong> — Session JSON (parse, historical, gap) is written to SQLite so the dashboard can
              reload without re-running the pipeline until you delete or re-upload.
            </li>
          </ol>
          <p>
            <strong>Risk score</strong> in the UI is driven primarily by the gap analysis output (scale documented in
            the gap panel), not a separate human workflow.
          </p>
        </Section>

        <Section id="matching" title="9. Matching & historical reference">
          <p>
            <strong>Matching</strong> compares your RFQ’s extracted fields (customer, program, material, process, part
            names/numbers, optional thickness and volume, spec text, etc.) to a <strong>candidate pool</strong> of
            historical projects.
          </p>
          <p>
            <strong>Per line item</strong>: Each workbook line can get its own ranked matches and reason list. That
            means a mixed package can still show strong references for line A even if line B is exotic—unlike the single
            KB bucket in the sidebar.
          </p>
          <p>
            <strong>Scoring weights</strong> (material exact, part number, name similarity, volume bands, etc.) are{" "}
            <strong>global</strong>: one configuration in Settings / Match scoring applies to all KB classes. The
            Knowledge Base “Matching” tab documents those signals and shows the numeric weights.
          </p>
        </Section>

        <Section id="gaps-quotes" title="10. Gaps, documents, and quote views">
          <p>
            <strong>Gaps</strong> are structured findings (severity, category, recommended action). Some may reference
            document slots; supplying a missing file updates the reconstructed case where implemented.
          </p>
          <p>
            <strong>Documents</strong> lists logical attachments inferred from the parse (and may show ok/miss/pend
            states for demo completeness tracking).
          </p>
          <p>
            <strong>Quote</strong> panels synthesize a draft-style quote view from historical price bands and line
            structure—use as internal triage, not as an authorized commercial offer.
          </p>
        </Section>

        <Section id="saved-portfolio" title="11. Saved analyses & Portfolio">
          <p>
            <strong>Saved analyses</strong> is the operational archive: every successful analysis session appears here
            with metadata; you can open detail, delete a session row, or import additional historical records when
            enabled.
          </p>
          <p>
            <strong>Portfolio</strong> summarizes match strength across sessions (how many line items have high/medium/low
            reference bands). Use it to see portfolio-level risk concentration, not to edit weights.
          </p>
        </Section>

        <Section id="data-storage" title="12. Where data lives">
          <ul>
            <li>
              <strong>SQLite</strong> (<code className="text-xs bg-muted px-1 rounded">data/rfq.sqlite</code> by default,
              or path from <code className="text-xs bg-muted px-1 rounded">RFQ_DATABASE_PATH</code>) holds relational
              seed RFQs, parse sessions, KB categories, match settings, optional historical imports, and related tables.
            </li>
            <li>
              <strong>Uploaded binaries</strong> live under the project’s upload directory on the server; deleting a DB
              row does not always delete binary files—see in-app delete copy.
            </li>
            <li>
              <strong>Sidebar cache</strong> may mirror recent upload ids in browser storage so the list survives
              refresh; the catalog API reconciles with SQLite.
            </li>
          </ul>
        </Section>

        <Section id="kb-assignment" title="13. Knowledge Base categories (assignment)">
          <ul>
            <li>
              <strong>Canonical classes</strong> are seeded (electronics, machining, stamping, injection, assembly,
              casting) with stable slugs.
            </li>
            <li>
              <strong>New classes</strong> can be inserted when the classifier proposes a slug not already in{" "}
              <code className="text-xs bg-muted px-1 rounded">kb_categories</code>, subject to deduplication rules
              (normalized labels) so you do not get duplicate sidebars for the same meaning.
            </li>
            <li>
              <strong>Seed RFQs</strong> may carry <code className="text-xs bg-muted px-1 rounded">kb_category_slug</code>{" "}
              on <code className="text-xs bg-muted px-1 rounded">rfq_projects</code>; older rows are backfilled from
              rules when the column is added.
            </li>
          </ul>
        </Section>

        <Section id="settings" title="14. Settings">
          <p>
            The gear menu exposes editor preferences (theme, font) and <strong>Match scoring</strong> JSON for the
            global weights API. Changes there affect all future match ranking until changed again.
          </p>
        </Section>

        <Section id="glossary" title="15. Glossary">
          <dl className="space-y-3 [&_dt]:font-medium [&_dt]:text-foreground [&_dd]:mt-0.5">
            <div>
              <dt>RFQ</dt>
              <dd>Request for Quotation — the commercial/technical package you send or receive for pricing.</dd>
            </div>
            <div>
              <dt>KB class / procurement class</dt>
              <dd>Sidebar bucket for organizing historical + analyzed RFQs; one primary class per stored upload.</dd>
            </div>
            <div>
              <dt>Parse session</dt>
              <dd>One SQLite row per analyzed upload, holding parse JSON, historical match JSON, gap JSON, and KB fields.</dd>
            </div>
            <div>
              <dt>Historical project</dt>
              <dd>A record in the knowledge bundle used as a match candidate (from seed data and/or imports).</dd>
            </div>
            <div>
              <dt>Match score / reasons</dt>
              <dd>Numeric score plus human-readable “reason” chips explaining which signals fired for a candidate.</dd>
            </div>
            <div>
              <dt>Coverage (dimensions)</dt>
              <dd>Fraction of matcher “dimensions” that received at least one credited reason for a line or RFQ.</dd>
            </div>
            <div>
              <dt>Gap</dt>
              <dd>A structured issue (completeness, technical, commercial, etc.) with recommended follow-up.</dd>
            </div>
            <div>
              <dt>Risk score</dt>
              <dd>Overall numeric risk from gap analysis; higher means more review suggested before quoting.</dd>
            </div>
          </dl>
        </Section>
      </div>

      <p className="mt-16 text-xs text-muted-foreground border-t border-border pt-6">
        Manual version aligned with the RFQ Assistant UI (workspace modes, KB resolution, four-sheet workbook pipeline).
        For developer setup, see the repository README (optional language-model keys, database path, and related env).
      </p>
    </div>
  );
}
