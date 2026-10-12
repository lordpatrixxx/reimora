import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { z } from "zod";
import { useMe } from "@/hooks/use-auth";
import { useClaims } from "@/lib/queries";
import { formatINR } from "@/lib/money";
import { Card, Empty, PageHeader, StatusBadge, btn, inputCls } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/claims/")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({ meta: [{ title: "Claims — CampusSettle" }, { name: "description", content: "All reimbursement claims." }] }),
  component: ClaimsList,
});

const filters = ["all", "draft", "submitted", "under_review", "changes_requested", "approved", "rejected"] as const;

function ClaimsList() {
  const { q: initialQ } = Route.useSearch();
  const { data: me } = useMe();
  const { data: claims = [], isLoading } = useClaims();
  const [q, setQ] = useState(initialQ ?? "");
  const [f, setF] = useState<(typeof filters)[number]>("all");
  const list = claims.filter((c) =>
    (f === "all" || c.status === f) &&
    (!q || `${c.ref} ${c.title} ${c.students?.full_name} ${c.students?.prn}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader title={me?.isStaff ? "All claims" : "My claims"} sub="Approval and settlement are tracked separately."
        action={(me?.isFinance || me?.student) && <Link to="/claims/new" className={btn.primary}><Plus className="h-4 w-4" /> New claim</Link>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className={inputCls + " max-w-xs"} placeholder="Search ref, title, student, PRN" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1">
          {filters.map((x) => (
            <button key={x} onClick={() => setF(x)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${f === x ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
              {x === "all" ? "All" : x.replace("_", " ").replace(/^\w/, (s) => s.toUpperCase())}
            </button>
          ))}
        </div>
      </div>
      {!isLoading && list.length === 0 ? (
        <Empty title="No matching claims" body="Try a different filter, or create a new claim." />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr><th className="px-4 py-3">Claim</th><th>Student</th><th>Status</th><th>Settlement</th><th className="text-right">Claimed</th><th className="px-4 text-right">Approved</th></tr>
              </thead>
              <tbody className="tabular">
                {list.map((c) => (
                  <tr key={c.id} className="border-t border-border transition hover:bg-muted/40">
                    <td className="px-4 py-3"><Link to="/claims/$id" params={{ id: c.id }} className="font-semibold hover:underline">{c.title}</Link><p className="text-xs text-muted-foreground">{c.ref}</p></td>
                    <td>{c.students?.full_name}<p className="text-xs text-muted-foreground">{c.students?.prn}</p></td>
                    <td><StatusBadge status={c.status} /></td>
                    <td><StatusBadge status={c.settlement_status} /></td>
                    <td className="text-right">{formatINR(c.claimed_paise || c.expenses.reduce((s, e) => s + (e.amount_paise ?? 0), 0))}</td>
                    <td className="px-4 text-right font-semibold">{c.approved_paise != null ? formatINR(c.approved_paise) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="space-y-2 md:hidden">
            {list.map((c) => (
              <Link key={c.id} to="/claims/$id" params={{ id: c.id }}>
                <Card className="p-4">
                  <div className="flex justify-between gap-2"><p className="font-semibold">{c.title}</p><StatusBadge status={c.status} /></div>
                  <p className="text-xs text-muted-foreground">{c.ref} · {c.students?.full_name}</p>
                  <div className="mt-2 flex justify-between text-sm tabular"><span>{formatINR(c.claimed_paise)}</span><StatusBadge status={c.settlement_status} /></div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
