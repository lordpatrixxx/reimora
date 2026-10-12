import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-accent text-accent-foreground",
  under_review: "bg-warning-soft text-warning",
  changes_requested: "bg-warning-soft text-warning",
  rejected: "bg-destructive-soft text-destructive",
  approved: "bg-success-soft text-primary",
  not_applicable: "bg-muted text-muted-foreground",
  pending: "bg-warning-soft text-warning",
  partially_settled: "bg-accent text-accent-foreground",
  settled: "bg-lime text-lime-foreground",
  queued: "bg-muted text-muted-foreground",
  sent: "bg-success-soft text-primary",
  failed: "bg-destructive-soft text-destructive",
  exact: "bg-destructive-soft text-destructive",
  possible: "bg-warning-soft text-warning",
  mismatch: "bg-warning-soft text-warning",
  pending_access: "bg-warning-soft text-warning",
  withdrawn: "bg-muted text-muted-foreground",
};
const labels: Record<string, string> = {
  under_review: "Under review",
  changes_requested: "Changes requested",
  not_applicable: "—",
  partially_settled: "Partly settled",
  pending: "Awaiting settlement",
  exact: "Exact duplicate",
  possible: "Possible match",
  mismatch: "Needs attention",
  pending_access: "Pending",
  submitted: "Submitted",
  approved: "Claim approved",
  settled: "Settled",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", statusStyles[status] ?? "bg-muted", className)}>
      {labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-border bg-card shadow-soft animate-rise", className)}>{children}</div>;
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl text-primary md:text-4xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-accent">
        <span className="h-3 w-3 rounded-sm bg-primary" />
      </div>
      <p className="font-semibold text-primary">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children, attention }: { label: string; hint?: string; children: ReactNode; attention?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {label}
        {attention && <span className="rounded bg-warning-soft px-1.5 py-px text-[10px] font-bold text-warning">Check</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-muted";

export const btn = {
  primary: "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0",
  lime: "inline-flex items-center justify-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-lime-foreground transition hover:-translate-y-px disabled:opacity-50",
  ghost: "inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-primary transition hover:bg-muted disabled:opacity-50",
  danger: "inline-flex items-center justify-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50",
};

export const CATEGORIES = ["Stationery", "Refreshment", "Rent", "Design Material", "Printing", "Travel", "Equipment", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Something went wrong";
}
