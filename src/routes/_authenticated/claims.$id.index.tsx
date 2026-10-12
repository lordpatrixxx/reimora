import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Pencil, Printer, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { formatINR, maskAccount, outstanding, paiseToInput, parseRupeesToPaise } from "@/lib/money";
import { Card, Field, StatusBadge, btn, errMsg, inputCls } from "@/components/app/ui-bits";
import { EvidencePreview, type Attachment } from "@/components/app/evidence";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/claims/$id/")({
  head: () => ({ meta: [{ title: "Claim — Reimora" }, { name: "description", content: "Claim details, review and settlement." }] }),
  component: ClaimDetail,
});

function useDetail(id: string) {
  return useQuery({
    queryKey: ["claim-detail", id],
    queryFn: async () => {
      const [c, e, a, ev, fl, pay, al] = await Promise.all([
        supabase.from("claims").select("*, students(*), scopes:scope_id(name, kind)").eq("id", id).single(),
        supabase.from("expenses").select("*").eq("claim_id", id).order("created_at"),
        supabase.from("attachments").select("*").eq("claim_id", id).order("created_at"),
        supabase.from("claim_events").select("*").eq("claim_id", id).order("created_at"),
        supabase.from("duplicate_flags").select("*").eq("claim_id", id).order("created_at"),
        supabase.from("payments").select("*").eq("claim_id", id).order("created_at"),
        supabase.from("advance_allocations").select("*, advances(purpose)").eq("claim_id", id),
      ]);
      if (c.error) throw c.error;
      return { claim: c.data, expenses: e.data ?? [], attachments: (a.data ?? []) as Attachment[], events: ev.data ?? [], flags: fl.data ?? [], payments: pay.data ?? [], allocations: al.data ?? [] };
    },
  });
}
type D = NonNullable<ReturnType<typeof useDetail>["data"]>;

function ClaimDetail() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const { data, refetch, error } = useDetail(id);
  const { data: canReview = false } = useQuery({
    queryKey: ["can-review", id],
    queryFn: async () => (await supabase.rpc("can_review_claim", { _claim: id })).data ?? false,
  });
  const qc = useQueryClient();
  const reload = () => { refetch(); qc.invalidateQueries({ queryKey: ["claims"] }); };
  if (error) return <Card className="p-6 text-sm">This claim isn't available to you, or it couldn't be loaded. <Link to="/claims" className="font-semibold text-primary underline">Back to claims</Link></Card>;
  if (!data || !me) return <div className="space-y-3"><div className="skeleton h-20" /><div className="skeleton h-64" /></div>;
  const { claim, expenses, attachments, events, flags, payments } = data;
  const paidTo = payments.filter((p) => p.direction === "to_student").reduce((s, p) => s + p.amount_paise, 0);
  const paidFrom = payments.filter((p) => p.direction === "from_student").reduce((s, p) => s + p.amount_paise, 0);
  const o = outstanding(claim.approved_paise ?? 0, claim.advance_applied_paise, paidTo, paidFrom);
  const canEdit = (claim.status === "draft" || claim.status === "changes_requested") && (me.isFinance || claim.student_id === me.student?.id || claim.created_by === me.user.id);
  const isReviewer = canReview && (claim.status === "submitted" || claim.status === "under_review");
  const awaitingReviewer = (claim.status === "submitted" || claim.status === "under_review") && !claim.assigned_faculty;
  const snap = claim.beneficiary_snapshot as { holder_name: string; bank_name: string; account_last4: string; is_fictional: boolean } | null;

  return (
    <div className="print:text-foreground">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/claims" className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary print:hidden"><ChevronLeft className="h-3 w-3" /> Claims</Link>
          <h1 className="text-2xl font-bold tracking-tight text-primary">{claim.title}</h1>
          <p className="text-sm text-muted-foreground">{claim.ref} · {claim.students?.full_name} ({claim.students?.prn}) · {claim.scopes?.name ?? "No scope"}</p>
          {awaitingReviewer && !canReview && <p className="mt-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">Waiting for an approver of {claim.scopes?.name ?? "this scope"} to pick it up. If none is assigned yet, the administrator has been notified.</p>}
          <div className="mt-2 flex gap-2"><StatusBadge status={claim.status} /><StatusBadge status={claim.settlement_status} /></div>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={() => window.print()} className={btn.ghost}><Printer className="h-4 w-4" /> Print summary</button>
          {canEdit && <Link to="/claims/$id/edit" params={{ id }} className={btn.primary}><Pencil className="h-4 w-4" /> {claim.status === "draft" ? "Continue draft" : "Make changes"}</Link>}
        </div>
      </div>

      {claim.status === "changes_requested" && (
        <div className="mb-4 rounded-xl bg-warning-soft p-4 text-sm"><b>Changes requested:</b> {events.filter((e) => e.to_status === "changes_requested").at(-1)?.note}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          {flags.length > 0 && <FlagsCard flags={flags} canResolve={isReviewer} reload={reload} />}
          {isReviewer ? <ReviewPanel data={data} reload={reload} /> : (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold text-primary">Expenses</h2>
              {expenses.map((e) => (
                <ExpenseRow key={e.id} e={e} atts={attachments.filter((a) => a.expense_id === e.id)} />
              ))}
              <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm tabular">
                <span className="font-semibold">Claimed / approved</span>
                <span><b>{formatINR(claim.claimed_paise)}</b> / {claim.approved_paise != null ? <b className="text-primary">{formatINR(claim.approved_paise)}</b> : "—"}</span>
              </div>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-primary">Purpose</h2>
            <p className="text-sm">{claim.purpose || "—"}</p>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="bg-primary p-5 text-primary-foreground">
            <p className="text-xs font-semibold opacity-70">Settlement</p>
            <div className="mt-3 space-y-1.5 text-sm tabular">
              <div className="flex justify-between"><span>Approved</span><span>{claim.approved_paise != null ? formatINR(claim.approved_paise) : "Pending review"}</span></div>
              <div className="flex justify-between"><span>Advance applied</span><span>− {formatINR(claim.advance_applied_paise)}</span></div>
              {claim.status === "approved" && (
                <>
                  <div className="flex justify-between border-t border-primary-foreground/20 pt-2 font-bold">
                    <span>{o.kind === "payable" ? "Payable to student" : o.kind === "returnable" ? "Returnable by student" : "Net"}</span>
                    <span className="text-lime dark:text-primary-foreground dark:underline dark:decoration-2">{formatINR(o.amount)}</span>
                  </div>
                  <div className="flex justify-between opacity-80"><span>Recorded so far</span><span>{formatINR(o.kind === "returnable" ? paidFrom : paidTo)}</span></div>
                  <div className="flex justify-between font-semibold"><span>Outstanding</span><span>{formatINR(o.remaining)}</span></div>
                </>
              )}
            </div>
            {snap && <p className="mt-4 text-xs opacity-70">Beneficiary: {snap.holder_name} · {snap.bank_name} · {maskAccount(snap.account_last4)} {snap.is_fictional && "(fictional)"}</p>}
            <p className="mt-2 text-[11px] opacity-60">Approval is separate from payment. This app records payments made outside it; it does not transfer money.</p>
          </Card>
          {me.isFinance && <SettlementActions data={data} remaining={o.remaining} kind={o.kind} reload={reload} />}
          {payments.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-2 font-semibold text-primary">Payments recorded</h2>
              <ul className="space-y-2 text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                    <span>{p.direction === "to_student" ? "Paid to student" : "Returned by student"}<span className="block text-xs text-muted-foreground">{p.paid_on} · ref {p.reference} · {p.recorded_by_name}</span></span>
                    <b className="tabular">{formatINR(p.amount_paise)}</b>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-primary">History</h2>
            <ol className="relative space-y-4 border-l border-border pl-4">
              {events.map((e) => (
                <li key={e.id} className="text-sm">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-card" />
                  <p className="font-semibold">{e.action}</p>
                  {e.note && <p className="text-muted-foreground">“{e.note}”</p>}
                  <p className="text-xs text-muted-foreground">{e.actor_name} · {new Date(e.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                </li>
              ))}
              {events.length === 0 && <li className="text-sm text-muted-foreground">Draft — not yet submitted.</li>}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ExpenseRow({ e, atts }: { e: D["expenses"][number]; atts: Attachment[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border py-3 last:border-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="truncate font-medium">{e.vendor ?? "Unnamed expense"}</p>
          <p className="text-xs text-muted-foreground">{e.category ?? "No category"} · {e.expense_date ?? "no date"} · {atts.length} file(s)</p>
        </div>
        <div className="text-right text-sm tabular">
          <p className="font-semibold">{formatINR(e.amount_paise)}</p>
          {e.approved_paise != null && <p className={cn("text-xs", e.approved_paise < (e.amount_paise ?? 0) ? "text-warning" : "text-primary")}>Approved {formatINR(e.approved_paise)}</p>}
        </div>
      </button>
      {e.review_note && <p className="mt-1 rounded-lg bg-warning-soft px-2 py-1 text-xs">Reviewer: {e.review_note}</p>}
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {atts.map((a) => <EvidencePreview key={a.id} att={a} className="h-64" />)}
          <div className="text-xs text-muted-foreground sm:col-span-2">Invoice {e.invoice_no ?? "—"} · Txn {e.txn_ref ?? "—"} · {e.description}</div>
        </div>
      )}
    </div>
  );
}

function FlagsCard({ flags, canResolve, reload }: { flags: D["flags"]; canResolve: boolean; reload: () => void }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  async function resolve(id: string) {
    const { error } = await supabase.rpc("resolve_flag", { _flag: id, _resolution: notes[id] ?? "" });
    if (error) return toast.error(errMsg(error));
    reload();
  }
  return (
    <Card className="border-warning/40 p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-primary"><AlertTriangle className="h-4 w-4 text-warning" /> Checks</h2>
      <ul className="space-y-2">
        {flags.map((f) => (
          <li key={f.id} className="rounded-xl bg-muted p-3 text-sm">
            <div className="flex items-start justify-between gap-2"><p>{f.reason}</p><StatusBadge status={f.resolved_at ? "settled" : f.severity} /></div>
            {f.resolved_at ? <p className="mt-1 text-xs text-muted-foreground">Resolved: {f.resolution}</p> : canResolve && (
              <div className="mt-2 flex gap-2">
                <input className={inputCls} placeholder="Document your resolution" value={notes[f.id] ?? ""} onChange={(e) => setNotes({ ...notes, [f.id]: e.target.value })} />
                <button onClick={() => resolve(f.id)} className={btn.ghost}>Resolve</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReviewPanel({ data, reload }: { data: D; reload: () => void }) {
  const { claim, expenses, attachments } = data;
  const [amounts, setAmounts] = useState<Record<string, string>>(Object.fromEntries(expenses.map((e) => [e.id, paiseToInput(e.amount_paise)])));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(expenses[0]?.id);
  const e = expenses.find((x) => x.id === sel);
  const total = expenses.reduce((s, x) => s + (parseRupeesToPaise(amounts[x.id] ?? "") ?? 0), 0);

  async function begin() {
    if (claim.status === "submitted") { await supabase.rpc("start_review", { _claim: claim.id }); reload(); }
  }
  async function decide(decision: "approve" | "changes" | "reject") {
    setBusy(true);
    const items = expenses.map((x) => ({ expense_id: x.id, approved_paise: parseRupeesToPaise(amounts[x.id] ?? "") ?? 0, note: notes[x.id] ?? "" }));
    const { error } = await supabase.rpc("decide_claim", { _claim: claim.id, _decision: decision, _note: note, _items: items });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(decision === "approve" ? "Approved — finance will record settlement" : decision === "changes" ? "Changes requested" : "Rejected");
    reload();
  }

  return (
    <Card className="p-5" >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-primary">Faculty review</h2>
        {claim.status === "submitted" && <button onClick={begin} className={btn.lime}>Start review</button>}
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-2 flex flex-wrap gap-1">
            {expenses.map((x, i) => <button key={x.id} onClick={() => setSel(x.id)} className={cn("rounded-full px-3 py-1 text-xs font-semibold", sel === x.id ? "bg-primary text-primary-foreground" : "bg-muted")}>Expense {i + 1}</button>)}
          </div>
          {e && attachments.filter((a) => a.expense_id === e.id).map((a) => <EvidencePreview key={a.id} att={a} className="mb-2 h-72" />)}
        </div>
        <div className="space-y-3">
          {expenses.map((x) => {
            const ap = parseRupeesToPaise(amounts[x.id] ?? "");
            const reduced = ap != null && ap < (x.amount_paise ?? 0);
            const over = ap != null && ap > (x.amount_paise ?? 0);
            return (
              <div key={x.id} className={cn("rounded-xl border p-3", sel === x.id ? "border-primary" : "border-border")} onClick={() => setSel(x.id)}>
                <div className="flex justify-between text-sm"><b className="truncate">{x.vendor}</b><span className="tabular">{formatINR(x.amount_paise)}</span></div>
                <p className="text-xs text-muted-foreground">{x.category} · {x.expense_date} · {x.description}</p>
                <div className="mt-2 grid grid-cols-[110px_1fr] gap-2">
                  <input inputMode="decimal" aria-label="Approved amount" className={inputCls + " tabular" + (over ? " border-destructive" : "")} value={amounts[x.id] ?? ""} onChange={(ev) => setAmounts({ ...amounts, [x.id]: ev.target.value })} />
                  {reduced ? <input className={inputCls + " border-warning"} placeholder="Reason for reduction (required)" value={notes[x.id] ?? ""} onChange={(ev) => setNotes({ ...notes, [x.id]: ev.target.value })} />
                    : <span className="self-center text-xs text-muted-foreground">{over ? "Cannot exceed claimed" : "Full amount"}</span>}
                </div>
              </div>
            );
          })}
          <div className="flex justify-between text-sm font-bold tabular"><span>Approving</span><span>{formatINR(total)} of {formatINR(claim.claimed_paise)}</span></div>
          <Field label="Comment (required to request changes or reject)"><textarea rows={2} className={inputCls} value={note} onChange={(ev) => setNote(ev.target.value)} /></Field>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => decide("approve")} className={btn.primary}>Approve {formatINR(total)}</button>
            <button disabled={busy} onClick={() => decide("changes")} className={btn.ghost}>Request changes</button>
            <button disabled={busy} onClick={() => decide("reject")} className={btn.danger}>Reject</button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SettlementActions({ data, remaining, kind, reload }: { data: D; remaining: number; kind: string; reload: () => void }) {
  const { claim } = data;
  const { data: advances = [] } = useQuery({
    queryKey: ["adv-open", claim.student_id],
    queryFn: async () => ((await supabase.from("advances").select("*").eq("student_id", claim.student_id)).data ?? []).filter((a) => a.amount_paise > a.allocated_paise),
  });
  const [adv, setAdv] = useState("");
  const [advAmt, setAdvAmt] = useState("");
  const [amt, setAmt] = useState("");
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const canAllocate = claim.status !== "draft" && claim.status !== "rejected" && data.payments.length === 0;

  async function allocate() {
    const p = parseRupeesToPaise(advAmt);
    if (!adv || !p) return toast.error("Choose an advance and amount");
    setBusy(true);
    const { error } = await supabase.rpc("allocate_advance", { _claim: claim.id, _advance: adv, _amount: p });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    setAdvAmt(""); reload();
  }
  async function pay() {
    const p = parseRupeesToPaise(amt);
    if (!p) return toast.error("Enter an amount");
    setBusy(true);
    const { error } = await supabase.rpc("record_payment", { _claim: claim.id, _direction: kind === "returnable" ? "from_student" : "to_student", _amount: p, _paid_on: date, _reference: ref, _key: key });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Payment recorded");
    setAmt(""); setRef(""); setKey(crypto.randomUUID()); reload();
  }

  return (
    <Card className="p-5 print:hidden">
      <h2 className="mb-3 font-semibold text-primary">Finance actions</h2>
      {canAllocate && advances.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Apply an advance</p>
          <select className={inputCls} value={adv} onChange={(e) => setAdv(e.target.value)}>
            <option value="">Choose advance…</option>
            {advances.map((a) => <option key={a.id} value={a.id}>{a.purpose} — {formatINR(a.amount_paise - a.allocated_paise)} free</option>)}
          </select>
          <div className="flex gap-2"><input className={inputCls} placeholder="Amount ₹" value={advAmt} onChange={(e) => setAdvAmt(e.target.value)} /><button disabled={busy} onClick={allocate} className={btn.ghost}>Apply</button></div>
        </div>
      )}
      {claim.status === "approved" && remaining > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">{kind === "returnable" ? "Record advance return from student" : "Record reimbursement paid to student"} · {formatINR(remaining)} outstanding</p>
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="Amount ₹" value={amt} onChange={(e) => setAmt(e.target.value)} />
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <input className={inputCls} placeholder="Payment reference (UTR / receipt no.)" value={ref} onChange={(e) => setRef(e.target.value)} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={pay} className={btn.primary}>{busy ? "Recording…" : "Record payment"}</button>
            <button onClick={() => setAmt(paiseToInput(remaining))} className="text-xs font-semibold text-primary">Fill full amount</button>
          </div>
        </div>
      ) : <p className="text-sm text-muted-foreground">{claim.status === "approved" ? "Fully settled." : "Settlement opens after approval."}</p>}
    </Card>
  );
}
