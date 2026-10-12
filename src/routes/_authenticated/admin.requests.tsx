import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useScopes } from "@/lib/admin";
import type { Details } from "@/components/app/access-gate";
import { Card, Empty, Field, PageHeader, btn, errMsg, inputCls } from "@/components/app/ui-bits";
import { cn } from "@/lib/utils";

const TABS = ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/admin/requests")({
  validateSearch: (s: Record<string, unknown>): { id?: string; tab?: Tab } => {
    const out: { id?: string; tab?: Tab } = {};
    if (typeof s["id"] === "string") out.id = s["id"];
    if ((TABS as readonly string[]).includes(String(s["tab"]))) out.tab = s["tab"] as Tab;
    return out;
  },
  head: () => ({ meta: [{ title: "Access requests — Reimora" }, { name: "description", content: "Approve or reject requests for Reimora access." }] }),
  component: Requests,
});

function useRequests() {
  return useQuery({
    queryKey: ["admin-requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("access_requests").select("*, scopes:scope_id(name, kind)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
type R = NonNullable<ReturnType<typeof useRequests>["data"]>[number];

function Requests() {
  const { id, tab = "PENDING" } = Route.useSearch();
  const nav = useNavigate({ from: Route.fullPath });
  const { data = [], isLoading, error, refetch } = useRequests();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const list = data.filter((r) => r.status === tab && (!role || r.requested_role === role)
    && JSON.stringify(r.details).toLowerCase().includes(q.toLowerCase()));
  const sel = data.find((r) => r.id === id);

  return (
    <div>
      <PageHeader title="Access requests" sub="Who may use Reimora, and in which role. This is separate from reimbursement claims." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-border bg-card p-1" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => nav({ search: { tab: t } })}
              className={cn("rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t.toLowerCase()} <span className="tabular opacity-70">{data.filter((r) => r.status === t).length}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, department" aria-label="Search requests" className="w-56 bg-transparent text-sm outline-none" />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role" className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">
          <option value="">All roles</option><option value="student">Student</option><option value="faculty">Faculty / Club Approver</option>
        </select>
      </div>
      {error ? <Card className="p-5 text-sm">Couldn't load requests. <button onClick={() => refetch()} className="font-semibold text-primary underline">Retry</button></Card>
        : isLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16" />)}</div>
        : list.length === 0 ? <Empty title={`No ${tab.toLowerCase()} requests`} body="Requests appear here as soon as someone submits the access form." />
        : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">Applicant</th><th>Requested role</th><th>Department / club</th><th className="pr-3">Submitted</th></tr></thead>
              <tbody>
                {list.map((r) => {
                  const d = r.details as Details;
                  return (
                    <tr key={r.id} onClick={() => nav({ search: { tab, id: r.id } })} className="cursor-pointer border-t border-border hover:bg-muted/50">
                      <td className="p-3"><p className="font-semibold">{d.full_name}</p><p className="text-xs text-muted-foreground">{r.ref}</p></td>
                      <td>{r.requested_role === "student" ? "Student" : "Faculty / Club Approver"}</td>
                      <td>{r.scopes?.name ?? r.scope_text ?? d.department}</td>
                      <td className="pr-3 tabular">{new Date(r.created_at).toLocaleDateString("en-IN")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      {sel && <Drawer r={sel} onClose={() => nav({ search: { tab } })} />}
    </div>
  );
}

function Drawer({ r, onClose }: { r: R; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: scopes = [] } = useScopes();
  const { data: email } = useQuery({
    queryKey: ["profile-email", r.user_id],
    queryFn: async () => (await supabase.from("profiles").select("email").eq("id", r.user_id).maybeSingle()).data?.email ?? "",
  });
  const d = r.details as Details;
  const [scope, setScope] = useState(r.scope_id ?? "");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [busy, setBusy] = useState(false);
  const isFaculty = r.requested_role === "faculty";
  const scopeName = scopes.find((s) => s.id === scope)?.name;

  async function decide(approve: boolean) {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("decide_access_request", { _id: r.id, _approve: approve, _reason: reason, _scope: (scope || null) as string });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); qc.invalidateQueries({ queryKey: ["admin-requests"] }); return; }
    toast.success(approve ? "Access granted" : "Request rejected");
    qc.invalidateQueries({ queryKey: ["admin-requests"] });
    qc.invalidateQueries({ queryKey: ["pending-requests"] });
    qc.invalidateQueries({ queryKey: ["admin-people"] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Access request">
      <div className="absolute inset-0 bg-foreground/30 animate-fade" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto bg-card shadow-float animate-drawer">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div><p className="text-xs text-muted-foreground">{r.ref} · {r.status.toLowerCase()}</p><p className="text-lg font-bold text-primary">{d.full_name}</p></div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-4 p-5 text-sm">
          <dl className="grid grid-cols-[130px_1fr] gap-y-2">
            <dt className="text-muted-foreground">Email</dt><dd className="break-all">{email}</dd>
            <dt className="text-muted-foreground">Requested role</dt><dd className="font-semibold">{isFaculty ? "Faculty / Club Approver" : "Student"}</dd>
            <dt className="text-muted-foreground">Requested scope</dt><dd>{r.scopes?.name ?? r.scope_text ?? "—"}</dd>
            {Object.entries(d).filter(([k, v]) => v && k !== "full_name").map(([k, v]) => (
              <Fragment key={k}><dt className="capitalize text-muted-foreground">{k.replace("_", " ")}</dt><dd>{v}</dd></Fragment>
            ))}
            <dt className="text-muted-foreground">Submitted</dt><dd>{new Date(r.created_at).toLocaleString("en-IN")}</dd>
            {r.decided_at && <><dt className="text-muted-foreground">Decided</dt><dd>{new Date(r.decided_at).toLocaleString("en-IN")} by {r.reviewer_name ?? "—"}</dd></>}
            {r.decision_reason && <><dt className="text-muted-foreground">Reason</dt><dd>{r.decision_reason}</dd></>}
          </dl>
          {r.status === "PENDING" && (
            <div className="space-y-3 border-t border-border pt-4">
              {isFaculty && (
                <Field label="Scope to grant" hint="The approver will see only claims in this department, club or activity.">
                  <select className={inputCls} value={scope} onChange={(e) => setScope(e.target.value)}>
                    <option value="">Choose a scope…</option>
                    {scopes.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.kind})</option>)}
                  </select>
                </Field>
              )}
              {mode === "approve" && (
                <div className="rounded-xl bg-accent p-3 animate-fade">
                  <p>You are granting <b>{isFaculty ? "Faculty / Club Approver" : "Student"}</b>{isFaculty && <> for <b>{scopeName ?? "—"}</b></>} to <b>{d.full_name}</b>.</p>
                  {!isFaculty && <p className="mt-1 text-xs text-muted-foreground">A student record (PRN {d.prn}) is created and linked to this account.</p>}
                  <div className="mt-3 flex gap-2">
                    <button disabled={busy || (isFaculty && !scope)} onClick={() => decide(true)} className={btn.primary}>{busy ? "Granting…" : "Confirm & grant"}</button>
                    <button onClick={() => setMode("idle")} className={btn.ghost}>Back</button>
                  </div>
                </div>
              )}
              {mode === "reject" && (
                <div className="space-y-2 animate-fade">
                  <Field label="Reason (shown to the applicant)"><textarea rows={3} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                  <div className="flex gap-2">
                    <button disabled={busy || !reason.trim()} onClick={() => decide(false)} className={btn.danger}>{busy ? "Rejecting…" : "Reject request"}</button>
                    <button onClick={() => setMode("idle")} className={btn.ghost}>Back</button>
                  </div>
                </div>
              )}
              {mode === "idle" && (
                <div className="flex gap-2">
                  <button onClick={() => setMode("approve")} className={btn.primary}>Approve…</button>
                  <button onClick={() => setMode("reject")} className={btn.ghost}>Reject…</button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
