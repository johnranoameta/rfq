"use client";

import Link from "next/link";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RfqWordExtractWorkspace } from "@/components/extraction/RfqWordExtractWorkspace";
import "@/components/rfq/rfq-assistant.css";

export default function WordPackageExtractionPanel() {
  return (
    <div className="ra-root min-h-screen flex flex-col">
      <header className="ra-topbar border-b border-border px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="size-5 text-primary" aria-hidden />
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Word RFQ extraction</h1>
            <p className="text-[11px] text-muted-foreground font-mono">
              Full-page view · Also available under Knowledge Base → Training
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/baseline">Baseline object</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <RfqWordExtractWorkspace />
        <div className="max-w-6xl mx-auto w-full px-4 md:px-6 pb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trash2 className="size-4" />
                Advanced: clear output
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              To reset extraction output, use the clear controls on this page via the{" "}
              <Link href="/extraction" className="underline">
                dedicated extraction route
              </Link>{" "}
              or delete files under <span className="font-mono">word-extract/output/</span> on the server.
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
