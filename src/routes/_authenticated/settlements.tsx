import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { useAdvances, useClaims, usePaymentsAll, sumPayments } from "@/lib/queries";
import { formatINR, outstanding, parseRupeesToPaise } from "@/lib/money";
import { Card, Empty, Field, PageHeader, StatusBadge, btn, errMsg, inputCls } from "@/components/app/ui-bits";
import { StudentPicker } from "@/components/app/claim-wizard";

export const Route = createFileRoute("/_authenticated/settlements")({
  head: () => ({ meta: [{ title: "Advances & settlements — CampusSettle" }, { name: "description", content: "Advances, reimbursements and returns." }] }),
  component: Settlements,
});

function Settlements() {
  const { data: me } = useMe();
  const { data: advances = [] } = useAdvances();
  const { data: claims = [] } = useClaims();
  const { data: payments = [] } = usePaymentsAll();
  const [adding, setAdding] = useState(false);
  const approved = claims.filter((c) => c.status === "approved");

  return (
    <div>
      <PageHeader title="Advances & settlements" sub="Net settlement = approved − advance applied. Records payments made outside this app."
        action={me?.isFinance && <button onClick={() => setAdding(!adding)} className={btn.primary}><Plus className="h-4 w-4" /> Record advance</button>} />
      {adding && <NewAdvance onDone={() => setAdding(false)} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-primary">Advances</h2>
          {advances.length === 0 ? <p className="text-sm text-muted-foreground">No advances recorded.</p> : (
            <ul className="space-y-2">
              {advances.map((a) => (
                <li key={a.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex justify-between"><b>{a.purpose}</b><span className="tabular">{formatINR(a.amount_paise)}</span></div>
                  <p className="text-xs text-muted-foreground">{a.students?.full_name} · {a.students?.prn} · issued {a.issued_on}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(a.allocated_paise / a.amount_paise) * 100}%` }} /></div>
                  <p className="mt-1 text-xs text-muted-foreground tabular">{formatINR(a.allocated_paise)} applied · {formatINR(a.amount_paise - a.allocated_paise)} unallocated</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-primary">Approved claims</h2>
          {approved.length === 0 ? <Empty title="Nothing to settle" body="Approved claims appear here." /> : (
            <ul className="space-y-2">
              {approved.map((c) => {
                const p = sumPayments(payments, c.id);
                const o = outstanding(c.approved_paise ?? 0, c.advance_applied_paise, p.to, p.from);
                return (
                  <li key={c.id}>
                    <Link to="/claims/$id" params={{ id: c.id }} className="block rounded-xl border border-border p-3 text-sm hover:bg-muted/50">
                      <div className="flex justify-between gap-2"><b>{c.ref} · {c.title}</b><StatusBadge status={c.settlement_status} /></div>
                      <p className="mt-1 text-xs text-muted-foreground tabular">
                        {formatINR(c.approved_paise)} approved − {formatINR(c.advance_applied_paise)} advance ={" "}
                        <b className={o.kind === "returnable" ? "text-warning" : "text-primary"}>{formatINR(o.amount)} {o.kind === "payable" ? "payable" : o.kind === "returnable" ? "to return" : ""}</b>
                        {o.remaining > 0 && o.remaining !== o.amount && ` · ${formatINR(o.remaining)} outstanding`}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function NewAdvance({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [student, setStudent] = useState<string | null>(null);
  const [purpose, setPurpose] = useState("");
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  async function save() {
    const p = parseRupeesToPaise(amount);
    if (!student || !purpose || !p) return toast.error("Student, purpose and amount are required");
    const { error } = await supabase.from("advances").insert({ student_id: student, purpose, amount_paise: p, reference: ref || null, issued_on: date });
    if (error) return toast.error(errMsg(error));
    qc.invalidateQueries({ queryKey: ["advances"] }); onDone();
  }
  return (
    <Card className="mb-4 grid gap-3 p-5 md:grid-cols-2">
      <Field label="Student"><StudentPicker value={student} onChange={setStudent} /></Field>
      <Field label="Purpose"><input className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Tech fest stall materials" /></Field>
      <Field label="Amount (₹)"><input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Issued on"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Reference (optional)"><input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
      <div className="flex items-end gap-2"><button onClick={save} className={btn.primary}>Save advance</button><button onClick={onDone} className={btn.ghost}>Cancel</button></div>
    </Card>
  );
}
