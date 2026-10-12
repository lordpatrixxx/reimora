import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowUpRight, Clock, Wallet, HandCoins, AlertCircle, FilePlus2, FileText, Send, PencilLine, CheckCircle2, Landmark } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { useClaims, usePaymentsAll, useAdvances, sumPayments } from "@/lib/queries";
import { formatINR, outstanding } from "@/lib/money";
import { Card, Empty, PageHeader, StatusBadge, btn } from "@/components/app/ui-bits";
import { StudentOnboarding } from "@/components/app/student-onboarding";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Reimora" }, { name: "description", content: "Your reimbursement overview." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const { data: claims = [], isLoading } = useClaims();
  const { data: payments = [] } = usePaymentsAll();
  const { data: advances = [] } = useAdvances();
  const { data: events = [] } = useQuery({
    queryKey: ["events-recent"],
    queryFn: async () => (await supabase.from("claim_events").select("*, claims(ref, title)").order("created_at", { ascending: false }).limit(8)).data ?? [],
  });

  if (!me) return null;
  if (me.isStudent && !me.isStaff && !me.student) return <StudentOnboarding />;

  const awaiting = claims.filter((c) => c.status === "submitted" || c.status === "under_review");
  const approvedUnpaid = claims.filter((c) => c.status === "approved" && c.settlement_status !== "settled");
  const awaitingReimb = approvedUnpaid.reduce((s, c) => {
    const p = sumPayments(payments, c.id);
    const o = outstanding(c.approved_paise ?? 0, c.advance_applied_paise, p.to, p.from);
    return s + (o.kind === "payable" ? o.remaining : 0);
  }, 0);
  const outstandingAdv = advances.reduce((s, a) => s + (a.amount_paise - a.allocated_paise), 0) +
    approvedUnpaid.reduce((s, c) => {
      const p = sumPayments(payments, c.id);
      const o = outstanding(c.approved_paise ?? 0, c.advance_applied_paise, p.to, p.from);
      return s + (o.kind === "returnable" ? o.remaining : 0);
    }, 0);

  const attention = claims.filter((c) => {
    if (me.isFaculty && (c.status === "submitted" || c.status === "under_review")) return true;
    if (me.isFinance && c.status === "approved" && c.settlement_status !== "settled") return true;
    if ((c.student_id === me.student?.id || c.created_by === me.user.id) && (c.status === "draft" || c.status === "changes_requested")) return true;
    return false;
  });

  const cat = new Map<string, number>();
  for (const c of claims) if (c.status !== "draft" && c.status !== "rejected")
    for (const e of c.expenses) if (e.category && e.amount_paise) cat.set(e.category, (cat.get(e.category) ?? 0) + e.amount_paise);
  const chart = [...cat.entries()].map(([name, v]) => ({ name, value: v / 100 })).sort((a, b) => b.value - a.value);

  const canCreate = me.isFinance || !!me.student;
  const stats = [
    { label: "Awaiting approval", value: formatINR(awaiting.reduce((s, c) => s + c.claimed_paise, 0)), sub: `${awaiting.length} claim${awaiting.length === 1 ? "" : "s"}`, icon: Clock },
    { label: "To be reimbursed", value: formatINR(awaitingReimb), sub: "Approved, net of advances", icon: Wallet },
    { label: "Outstanding advances", value: formatINR(outstandingAdv), sub: "Unallocated or to return", icon: HandCoins },
    { label: "Needs action", value: String(attention.length), sub: attention.length ? "Open the list below" : "All caught up", icon: AlertCircle },
  ];

  return (
    <div>
      <PageHeader
        title={`Hello, ${(me.profile?.full_name ?? "there").split(" ")[0]}`}
        sub={me.isFinance ? "Settlement responsibilities and records." : me.isFaculty ? "Claims assigned for your review." : "Your claims and settlements."}
        action={canCreate && <Link to="/claims/new" className={btn.primary}><Plus className="h-4 w-4" /> Create claim</Link>}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          const hero = i === 0;
          return (
            <Card key={s.label} className={hero ? "relative overflow-hidden border-transparent bg-primary p-5 text-primary-foreground" : "p-5"}>
              {hero && <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-lime/25 blur-2xl" aria-hidden />}
              <div className="flex items-center justify-between">
                <p className={`text-xs font-medium ${hero ? "opacity-75" : "text-muted-foreground"}`}>{s.label}</p>
                <span className={`grid h-8 w-8 place-items-center rounded-full ${hero ? "bg-primary-foreground/10" : "bg-muted text-primary"}`}><Icon className="h-4 w-4" /></span>
              </div>
              <p className="mt-4 font-display text-3xl tabular">{s.value}</p>
              <p className={`mt-1 text-xs ${hero ? "opacity-65" : "text-muted-foreground"}`}>{s.sub}</p>
            </Card>
          );
        })}
      </div>

      {me.student && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {([
            ["Create claim", null, "/claims/new", FilePlus2],
            ["Drafts", claims.filter((c) => c.status === "draft" && c.student_id === me.student!.id).length, "/claims", FileText],
            ["Submitted", claims.filter((c) => (c.status === "submitted" || c.status === "under_review") && c.student_id === me.student!.id).length, "/claims", Send],
            ["Needs changes", claims.filter((c) => c.status === "changes_requested" && c.student_id === me.student!.id).length, "/claims", PencilLine],
            ["Approved", claims.filter((c) => c.status === "approved" && c.student_id === me.student!.id).length, "/claims", CheckCircle2],
            ["Payments & advances", null, "/settlements", Landmark],
          ] as const).map(([l, n, to, Icon], i) => (
            <Link key={l} to={to} className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-soft ${i === 0 ? "border-transparent bg-lime text-lime-foreground" : "border-border bg-card"}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${i === 0 ? "bg-lime-foreground/10" : "bg-muted text-primary"}`}><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 leading-tight">
                {n !== null && <span className="block font-display text-lg tabular">{n}</span>}
                <span className={n !== null ? "text-xs text-muted-foreground" : ""}>{l}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
      {isLoading ? <div className="mt-6 grid gap-4 lg:grid-cols-2"><div className="skeleton h-64" /><div className="skeleton h-64" /></div> : claims.length === 0 ? (
        <div className="mt-6">
          <Empty title="No claims yet" body="Start with a receipt or UPI screenshot. AI reads the details; you confirm them before anything is submitted."
            action={canCreate && <Link to="/claims/new" className={btn.primary}>Create your first claim</Link>} />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl text-primary">Recent claims</h2>
              <Link to="/claims" className="text-xs font-semibold text-muted-foreground hover:text-primary">View all</Link>
            </div>
            <ul className="divide-y divide-border">
              {claims.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link to="/claims/$id" params={{ id: c.id }} className="flex items-center gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.ref} · {c.students?.full_name}</p>
                    </div>
                    <span className="text-sm font-semibold tabular">{formatINR(c.approved_paise ?? c.claimed_paise)}</span>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-display text-xl text-primary">Needs your attention</h2>
            {attention.length === 0 ? <p className="text-sm text-muted-foreground">You're all caught up.</p> : (
              <ul className="space-y-2">
                {attention.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link to="/claims/$id" params={{ id: c.id }} className="flex items-center justify-between rounded-xl bg-warning-soft/60 px-3 py-2.5 text-sm hover:bg-warning-soft">
                      <span className="truncate"><b>{c.ref}</b> · {c.title}</span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-warning" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-display text-xl text-primary">Spending by category</h2>
            {chart.length === 0 ? <p className="text-sm text-muted-foreground">Appears once claims are submitted.</p> : (
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={chart} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => formatINR(Math.round(v * 100))} cursor={{ fill: "var(--muted)" }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {chart.map((_, i) => <Cell key={i} fill={i === 0 ? "var(--primary)" : "var(--lime)"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-display text-xl text-primary">Activity</h2>
            <ol className="relative space-y-4 border-l border-border pl-4">
              {events.map((e) => (
                <li key={e.id} className="text-sm">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-card" />
                  <p><b>{e.action}</b> · {e.claims?.ref}</p>
                  <p className="text-xs text-muted-foreground">{e.actor_name} · {new Date(e.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                </li>
              ))}
              {events.length === 0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
            </ol>
          </Card>
        </div>
      )}
    </div>
  );
}
