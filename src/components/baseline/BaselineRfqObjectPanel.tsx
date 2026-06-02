"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Database, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FIELD_CATEGORIES,
  type RfqObjectField,
  type RfqObjectPackage,
} from "@/lib/extraction/rfqObjectTypes";
import "@/components/rfq/rfq-assistant.css";

function blank(v: string | null | undefined) {
  if (v == null || !String(v).trim()) return "";
  return String(v);
}

type PackageListItem = {
  package_id: string;
  filename: string;
  rfq_number: string | null;
  title: string | null;
  is_baseline: boolean;
  built_at: string;
  field_count: number;
  filled_field_count: number;
  catalog_version: string;
};

export default function BaselineRfqObjectPanel() {
  const [list, setList] = useState<PackageListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [obj, setObj] = useState<RfqObjectPackage | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [showEmpty, setShowEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/baseline/object");
      const data = (await res.json()) as { objects?: PackageListItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load RFQ objects");
      const objects = data.objects ?? [];
      setList(objects);
      if (objects.length && !selectedId) {
        const base = objects.find((o) => o.is_baseline) ?? objects[0];
        setSelectedId(base.package_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadObject = useCallback(async (packageId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/baseline/object?packageId=${encodeURIComponent(packageId)}`);
      const data = (await res.json()) as { object?: RfqObjectPackage; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Object not found");
      setObj(data.object ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setObj(null);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadObject(selectedId);
  }, [selectedId, loadObject]);

  const buildObjects = async () => {
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/baseline/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baselineId: selectedId ?? undefined }),
      });
      const data = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) throw new Error(data.detail ?? data.error ?? "Build failed");
      await loadList();
      if (selectedId) await loadObject(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Build failed");
    } finally {
      setBuilding(false);
    }
  };

  const categories = useMemo(() => {
    const fromObj = new Set((obj?.fields ?? []).map((f) => f.category));
    return ["all", ...FIELD_CATEGORIES.filter((c) => fromObj.has(c)), ...[...fromObj].filter(
      (c) => !FIELD_CATEGORIES.includes(c as (typeof FIELD_CATEGORIES)[number]),
    )];
  }, [obj]);

  const rows = useMemo(() => {
    if (!obj?.fields) return [];
    return obj.fields.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (!showEmpty && !blank(f.value)) return false;
      return true;
    });
  }, [obj, category, showEmpty]);

  const filledPct =
    obj && obj.field_count > 0
      ? Math.round((obj.filled_field_count / obj.field_count) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 px-4 py-3 flex flex-wrap items-center gap-3">
        <Database className="h-5 w-5 text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Baseline RFQ Object</h1>
          <p className="text-xs text-muted-foreground">
            Curated field · value rows with source document — prime template for comparing RFQs
          </p>
        </div>
        <Link href="/extraction" className="text-xs text-muted-foreground underline">
          Word extract
        </Link>
        <Link href="/" className="text-xs text-muted-foreground underline">
          Dashboard
        </Link>
        <Button type="button" variant="outline" size="sm" disabled={building} onClick={() => void buildObjects()}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${building ? "animate-spin" : ""}`} />
          Rebuild objects
        </Button>
      </header>

      <main className="p-4 max-w-[1600px] mx-auto space-y-4">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading RFQ objects…</p>
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground space-y-2">
              <p>No RFQ object yet. Run Word extraction with Normalize, or rebuild:</p>
              <Button type="button" size="sm" onClick={() => void buildObjects()} disabled={building}>
                Build from output/
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {list.map((p) => (
                <button
                  key={p.package_id}
                  type="button"
                  onClick={() => setSelectedId(p.package_id)}
                  className={`text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                    selectedId === p.package_id
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <span className="font-mono block">{p.rfq_number ?? p.package_id.slice(0, 12)}</span>
                  <span className="text-muted-foreground truncate max-w-[220px] block">{p.filename}</span>
                  {p.is_baseline ? (
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      Baseline
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>

            {obj ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex flex-wrap items-center gap-2">
                    {obj.filename}
                    {obj.is_baseline ? <Badge>Prime baseline</Badge> : null}
                    <span className="text-xs font-normal text-muted-foreground">
                      catalog {obj.catalog_version} · {obj.filled_field_count}/{obj.field_count} filled ({filledPct}%)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 items-center text-xs">
                    <span className="text-muted-foreground">Category:</span>
                    {categories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`px-2 py-0.5 rounded border ${
                          category === c ? "border-primary font-medium" : "border-border/50"
                        }`}
                        onClick={() => setCategory(c)}
                      >
                        {c}
                      </button>
                    ))}
                    <label className="ml-4 flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showEmpty}
                        onChange={(e) => setShowEmpty(e.target.checked)}
                      />
                      Show empty template fields
                    </label>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Showing {rows.length} rows · DB: <span className="font-mono">rfq_baseline.db</span> · JSON:{" "}
                    <span className="font-mono">rfq_objects.json</span>
                  </p>

                  <div className="overflow-auto max-h-[70vh] rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[22%] sticky top-0 bg-background">Field</TableHead>
                          <TableHead className="w-[28%] sticky top-0 bg-background">Value</TableHead>
                          <TableHead className="w-[22%] sticky top-0 bg-background">Source document</TableHead>
                          <TableHead className="w-[8%] sticky top-0 bg-background">Section</TableHead>
                          <TableHead className="w-[10%] sticky top-0 bg-background">Category</TableHead>
                          <TableHead className="w-[10%] sticky top-0 bg-background">Method</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((f) => (
                          <TableRow
                            key={f.field_key}
                            className={!blank(f.value) ? "" : "opacity-70"}
                          >
                            <TableCell className="text-xs align-top">
                              <div className="font-medium">{f.field_name}</div>
                              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                                {f.field_key}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs align-top whitespace-pre-wrap max-w-md">
                              {blank(f.value)}
                            </TableCell>
                            <TableCell className="text-xs align-top">
                              <div className="font-mono break-all">{blank(f.source_document)}</div>
                              {f.source_document_role ? (
                                <div className="text-muted-foreground text-[10px]">{f.source_document_role}</div>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-xs align-top font-mono">
                              {blank(f.source_section)}
                            </TableCell>
                            <TableCell className="text-xs align-top">{f.category}</TableCell>
                            <TableCell className="text-xs align-top text-muted-foreground">
                              {f.extraction_method}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
