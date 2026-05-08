"use client";

import { useCallback, type ReactNode } from "react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type DashboardTabKey = "catalog" | "overview" | "documents" | "parts" | "gap" | "quote";

export const DASHBOARD_TAB_ORDER_STORAGE_KEY = "rfq-agent-dashboard-tab-order";

const DEFAULT_TAB_ORDER: DashboardTabKey[] = [
  "catalog",
  "overview",
  "documents",
  "parts",
  "gap",
  "quote",
];

const TAB_LABELS: Record<DashboardTabKey, string> = {
  catalog: "All RFQs",
  overview: "Overview",
  documents: "Documents",
  parts: "Line Items & Match",
  gap: "Gaps & Actions",
  quote: "Quote & History",
};

function isTabKey(v: string): v is DashboardTabKey {
  return (DEFAULT_TAB_ORDER as string[]).includes(v);
}

export function normalizeDashboardTabOrder(parsed: unknown): DashboardTabKey[] {
  if (!Array.isArray(parsed)) return [...DEFAULT_TAB_ORDER];
  const ordered = parsed.filter((x): x is DashboardTabKey => typeof x === "string" && isTabKey(x));
  const missing = DEFAULT_TAB_ORDER.filter((k) => !ordered.includes(k));
  return [...ordered, ...missing];
}

export function loadDashboardTabOrder(): DashboardTabKey[] {
  if (typeof window === "undefined") return [...DEFAULT_TAB_ORDER];
  try {
    const raw = JSON.parse(localStorage.getItem(DASHBOARD_TAB_ORDER_STORAGE_KEY) || "null");
    return normalizeDashboardTabOrder(raw);
  } catch {
    return [...DEFAULT_TAB_ORDER];
  }
}

export function saveDashboardTabOrder(order: DashboardTabKey[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DASHBOARD_TAB_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    /* ignore quota */
  }
}

type SortableTabProps = {
  tabKey: DashboardTabKey;
  active: boolean;
  onSelect: () => void;
  pill: ReactNode;
  label: string;
};

function SortableTab({ tabKey, active, onSelect, pill, label }: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tabKey,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={[
        "h-9 rounded-xl text-[13px] font-semibold transition whitespace-nowrap flex items-center shrink-0 border",
        active ? "bg-card border-accent/40 text-accent dark:text-accent/90" : "text-muted-foreground border-transparent hover:text-foreground hover:bg-card/50",
        isDragging ? "opacity-90 shadow-md" : "",
      ].join(" ")}
    >
      <button
        type="button"
        className={[
          "h-full pl-1.5 pr-0.5 rounded-l-xl flex items-center touch-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        ].join(" ")}
        {...listeners}
        aria-label={`Reorder: ${label}`}
        title="Drag to reorder"
      >
        <GripVertical className={["size-3.5 shrink-0 opacity-50", active ? "text-accent" : ""].join(" ")} />
      </button>
      <button
        type="button"
        onClick={() => onSelect()}
        className={[
          "h-full pr-3 pl-0.5 rounded-r-xl flex items-center gap-1 min-w-0",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
        ].join(" ")}
      >
        <span>{label}</span>
        {pill}
      </button>
    </div>
  );
}

type SortableRfqTabBarProps = {
  tabOrder: DashboardTabKey[];
  onTabOrderChange: (order: DashboardTabKey[]) => void;
  activeTab: DashboardTabKey;
  onTabSelect: (key: DashboardTabKey) => void;
  docCountText: string;
  docMissingCount: number;
  gapCount: number;
  openHighGaps: number;
};

export function SortableRfqTabBar({
  tabOrder,
  onTabOrderChange,
  activeTab,
  onTabSelect,
  docCountText,
  docMissingCount,
  gapCount,
  openHighGaps,
}: SortableRfqTabBarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const a = String(active.id);
      const o = String(over.id);
      if (!isTabKey(a) || !isTabKey(o)) return;
      const oldIndex = tabOrder.indexOf(a);
      const newIndex = tabOrder.indexOf(o);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = arrayMove(tabOrder, oldIndex, newIndex);
      saveDashboardTabOrder(next);
      onTabOrderChange(next);
    },
    [tabOrder, onTabOrderChange],
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={tabOrder} strategy={horizontalListSortingStrategy}>
        <div className="flex items-center gap-1 border-b border-border bg-secondary/20 px-2 py-1 overflow-x-auto flex-nowrap">
          {tabOrder.map((tabKey) => {
            const active = tabKey === activeTab;
            let pill: ReactNode = null;
            if (tabKey === "documents") {
              pill = (
                <Badge
                  variant="secondary"
                  className={[
                    "ml-1",
                    docMissingCount ? "border-destructive/40 bg-red-500/10 dark:text-red-200 text-red-700" : "",
                  ].join(" ")}
                >
                  {docCountText}
                </Badge>
              );
            }
            if (tabKey === "gap") {
              pill = (
                <Badge
                  variant="secondary"
                  className={[
                    "ml-1",
                    openHighGaps > 3
                      ? "border-destructive/40 bg-orange-500/10 dark:text-orange-200 text-orange-700"
                      : openHighGaps > 0
                        ? "border-amber-400/35 bg-amber-400/10 dark:text-amber-200 text-amber-800"
                        : "",
                  ].join(" ")}
                >
                  {gapCount} open
                </Badge>
              );
            }
            return (
              <SortableTab
                key={tabKey}
                tabKey={tabKey}
                active={active}
                onSelect={() => onTabSelect(tabKey)}
                pill={pill}
                label={TAB_LABELS[tabKey]}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
