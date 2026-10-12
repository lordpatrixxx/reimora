import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { UserCheck, AlertTriangle, MailWarning, Files } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClaims } from "@/lib/queries";
import { usePeople } from "@/lib/admin";
import { formatINR } from "@/lib/money";
import type { Details } from "@/components/app/access-gate";
import { Card, Empty, PageHeader, StatusBadge, btn, errMsg } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin overview — Reimora" }, { name: "description", content: "Access requests, claim assignments and delivery issues." }] }),
  component: AdminHome,
});

function AdminHome() {
  const qc = useQueryClient();
  const { data: claims = [], isLoading } = useClaims();
  const { data: people = [] } = usePeople();
  const { data: pending = [] } = useQuery({
    queryKey: ["admin-pending"],
    queryFn: async () => (await supabase.from("access_requests").select("*").eq("status", "PENDING").order("created_at")).data ?? [],
  });
  const { data: failed = [] } = useQuery({
    queryKey: ["admin-failed-mail"],
    queryFn: async () => (await supabase.from("notifications").select("*").in("status", ["failed", "queued"]).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const { data: approverScopes = [] } = useQuery({
    queryKey: ["admin-approver-scopes"],
    queryFn: async () => (await supabase.from("approver_scopes").select("*")).data ?? [],
  });

  const awaiting = claims.filter((c) => c.status === "submitted" || c.status === "under_review");
  const unassigned = awaiting.filter((c) => !c.assigned_faculty && !approverScopes.some((a) => a.scope_id === c.scope_id));
  const approvers = people.filter((p) => p.roles.includes("faculty") && !p.suspended);
  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.full_name ?? null;

  async function retry(id: string) {
    const { error } = await supabase.rpc("admin_retry_notification", { _id: id });
    if (error) return toast.error(errMsg(error));
    toast.success("Re-queued for delivery");
    qc.invalidateQueries({ queryKey: ["admin-failed-mail"] });
  }

  const stats = [
    { label: "Pending access requests", value: pending.length, icon: UserCheck, to: "/admin/requests" },
    { label: "Claims awaiting review", value: awaiting.length, icon: Files, to: "/claims" },
    { label: "Unassigned claims", value: unassigned.length, icon: AlertTriangle, to: "/admin" },
    { label: "Undelivered emails", value: failed.length, icon: MailWarning, to: "/notifications" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Admin overview" sub="Access requests and reimbursement claims are managed separately. Start with anything that is waiting on you." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to}>
            <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-float">
              <s.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
              <p className="mt-3 text-3xl font-bold tabular text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-3 font-semibold text-primary">Access requests waiting</h2>
        {pending.length === 0 ? <Empty title="No pending access requests" body="New requests appear here and in your notifications." /> : (
          <Card className="divide-y divide-border">
            {pending.slice(0, 5).map((r) => {
              const d = r.details as Details;
              return (
                <Link key={r.id} to="/admin/requests" search={{ id: r.id, tab: "PENDING" }} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50">
                  <div className="min-w-0"><p className="font-semibold">{d.full_name}</p><p className="truncate text-xs text-muted-foreground">{r.requested_role === "student" ? "Student" : "Faculty / Club Approver"} · {d.department} · {new Date(r.created_at).toLocaleDateString("en-IN")}</p></div>
                  <span className="text-xs font-semibold text-primary">Review →</span>
                </Link>
              );
            })}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-primary">Claim assignments</h2>
        <p className="mb-3 text-sm text-muted-foreground">Claims are routed to approvers of their department, club or activity. Assign a specific reviewer when needed; every change is logged.</p>
        {isLoading ? <div className="skeleton h-40" /> : awaiting.length === 0 ? <Empty title="No claims awaiting review" body="Submitted claims will show here with their reviewer." /> : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">Claim</th><th>Student</th><th>Amount</th><th>Status</th><th className="pr-3">Reviewer</th></tr></thead>
              <tbody>
                {awaiting.map((c) => {
                  const isUn = unassigned.includes(c);
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="p-3"><Link to="/claims/$id" params={{ id: c.id }} className="font-semibold hover:underline">{c.title}</Link><p className="text-xs text-muted-foreground">{c.ref}</p></td>
                      <td>{c.students?.full_name}</td>
                      <td className="tabular">{formatINR(c.claimed_paise)}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td className="pr-3">
                        <AssignSelect claimId={c.id} value={c.assigned_faculty} approvers={approvers} />
                        {isUn && <p className="mt-1 text-[11px] font-semibold text-warning">No approver for this scope</p>}
                        {!c.assigned_faculty && !isUn && <p className="mt-1 text-[11px] text-muted-foreground">Any scope approver</p>}
                        {c.assigned_faculty && <p className="mt-1 text-[11px] text-muted-foreground">{nameOf(c.assigned_faculty)}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-primary">Email delivery</h2>
        <p className="mb-3 text-sm text-muted-foreground">No email sender is configured yet, so messages stay queued or fail. Nothing is marked sent without a successful delivery.</p>
        {failed.length === 0 ? <Empty title="No undelivered emails" body="Delivery problems will appear here." /> : (
          <Card className="divide-y divide-border">
            {failed.map((n) => (
              <div key={n.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-semibold">{n.subject}</p><StatusBadge status={n.status} /></div>
                  <p className="text-xs text-muted-foreground">to {n.recipient_email} · {n.category === "access" ? "Access" : "Claim"} · attempts {n.attempts}{n.last_error ? ` · ${n.last_error}` : ""}</p></div>
                {n.status === "failed" && <button onClick={() => retry(n.id)} className={btn.ghost}>Retry</button>}
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function AssignSelect({ claimId, value, approvers }: { claimId: string; value: string | null; approvers: { id: string; full_name: string | null; email: string | null }[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function change(v: string) {
    setBusy(true);
    const { error } = await supabase.rpc("admin_assign_claim", { _claim: claimId, _reviewer: (v || null) as string });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Reviewer updated");
    qc.invalidateQueries({ queryKey: ["claims"] });
  }
  return (
    <select disabled={busy} value={value ?? ""} onChange={(e) => change(e.target.value)} aria-label="Assign reviewer"
      className="w-44 rounded-lg border border-input bg-card px-2 py-1.5 text-xs">
      <option value="">Route by scope</option>
      {approvers.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? a.email}</option>)}
    </select>
  );
}
