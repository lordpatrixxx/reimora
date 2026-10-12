import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { useClaims, usePaymentsAll, sumPayments } from "@/lib/queries";
import { formatINR, outstanding } from "@/lib/money";
import { CATEGORIES, Card, PageHeader, StatusBadge, btn, inputCls } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Reimora" }, { name: "description", content: "Claimed vs approved, outstanding settlements, categories." }] }),
  component: Reports,
});

function Reports() {
  const { data: claims = [] } = useClaims();
  const { data: payments = [] } = usePaymentsAll();
  const [f, setF] = useState({ student: "", from: "", to: "", category: "", status: "", settlement: "" });

  const rows = useMemo(() => claims.filter((c) => c.status !== "draft").filter((c) => {
    const d = (c.submitted_at ?? c.created_at).slice(0, 10);
    return (!f.student || `${c.students?.full_name} ${c.students?.prn}`.toLowerCase().includes(f.student.toLowerCase()))
      && (!f.from || d >= f.from) && (!f.to || d <= f.to)
      && (!f.category || c.expenses.some((e) => e.category === f.category))
      && (!f.status || c.status === f.status) && (!f.settlement || c.settlement_status === f.settlement);
  }).map((c) => {
    const p = sumPayments(payments, c.id);
    const o = c.status === "approved" ? outstanding(c.approved_paise ?? 0, c.advance_applied_paise, p.to, p.from) : null;
    return { c, o, p };
  }), [claims, payments, f]);

  const tot = rows.reduce((s, r) => ({
    claimed: s.claimed + r.c.claimed_paise,
    approved: s.approved + (r.c.approved_paise ?? 0),
    reimb: s.reimb + (r.o?.kind === "payable" ? r.o.remaining : 0),
    ret: s.ret + (r.o?.kind === "returnable" ? r.o.remaining : 0),
  }), { claimed: 0, approved: 0, reimb: 0, ret: 0 });

  const cats = new Map<string, number>();
  rows.forEach((r) => r.c.expenses.forEach((e) => e.category && cats.set(e.category, (cats.get(e.category) ?? 0) + (e.approved_paise ?? e.amount_paise ?? 0))));
  const catMax = Math.max(1, ...cats.values());

  function csv() {
    const head = ["Ref", "Title", "Student", "PRN", "Status", "Settlement", "Claimed", "Approved", "Advance applied", "Paid to student", "Returned by student", "Outstanding"];
    const lines = rows.map(({ c, o, p }) => [c.ref, c.title, c.students?.full_name, c.students?.prn, c.status, c.settlement_status,
      (c.claimed_paise / 100).toFixed(2), ((c.approved_paise ?? 0) / 100).toFixed(2), (c.advance_applied_paise / 100).toFixed(2),
      (p.to / 100).toFixed(2), (p.from / 100).toFixed(2), ((o?.remaining ?? 0) / 100).toFixed(2)]);
    const text = [head, ...lines].map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = `campussettle-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div>
      <PageHeader title="Reports" sub="Bank details are excluded from reports."
        action={<div className="flex gap-2 print:hidden"><button onClick={csv} className={btn.ghost}><Download className="h-4 w-4" /> CSV</button><button onClick={() => window.print()} className={btn.ghost}><Printer className="h-4 w-4" /> Print</button></div>} />
      <Card className="mb-4 grid gap-2 p-4 sm:grid-cols-3 lg:grid-cols-6 print:hidden">
        <input className={inputCls} placeholder="Student / PRN" value={f.student} onChange={set("student")} />
        <input type="date" className={inputCls} value={f.from} onChange={set("from")} aria-label="From" />
        <input type="date" className={inputCls} value={f.to} onChange={set("to")} aria-label="To" />
        <select className={inputCls} value={f.category} onChange={set("category")}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <select className={inputCls} value={f.status} onChange={set("status")}><option value="">All approval</option>{["submitted", "under_review", "changes_requested", "approved", "rejected"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
        <select className={inputCls} value={f.settlement} onChange={set("settlement")}><option value="">All settlement</option>{["pending", "partially_settled", "settled"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Claimed", tot.claimed], ["Approved", tot.approved], ["Outstanding reimbursements", tot.reimb], ["Outstanding advance returns", tot.ret]].map(([l, v]) => (
          <Card key={l as string} className="p-4"><p className="text-xs font-semibold text-muted-foreground">{l}</p><p className="mt-1 text-xl font-bold tabular">{formatINR(v as number)}</p></Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-primary">Category distribution</h2>
          <ul className="space-y-2.5">
            {[...cats.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <li key={k} className="text-sm"><div className="flex justify-between"><span>{k}</span><span className="tabular">{formatINR(v)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(v / catMax) * 100}%` }} /></div></li>
            ))}
            {cats.size === 0 && <li className="text-sm text-muted-foreground">No data for these filters.</li>}
          </ul>
        </Card>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm tabular">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Claim</th><th>Student</th><th>Status</th><th className="text-right">Claimed</th><th className="text-right">Approved</th><th className="px-4 text-right">Outstanding</th></tr></thead>
            <tbody>
              {rows.map(({ c, o }) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-2.5">{c.ref}<p className="text-xs text-muted-foreground">{c.title}</p></td>
                  <td>{c.students?.full_name}</td>
                  <td><StatusBadge status={c.status} /> <StatusBadge status={c.settlement_status} /></td>
                  <td className="text-right">{formatINR(c.claimed_paise)}</td>
                  <td className="text-right">{c.approved_paise != null ? formatINR(c.approved_paise) : "—"}</td>
                  <td className="px-4 text-right">{o ? `${formatINR(o.remaining)}${o.kind === "returnable" ? " ↩" : ""}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
