import { useNavigate, Link } from "@tanstack/react-router";
import { kickEmails } from "@/lib/kick-emails";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Sparkles, Trash2, AlertTriangle, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useScopes } from "@/lib/admin";
import { useMe } from "@/hooks/use-auth";
import { useStudents } from "@/lib/queries";
import { extractExpense } from "@/lib/evidence.functions";
import { formatINR, maskAccount, paiseToInput, parseRupeesToPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CATEGORIES, Card, Field, StatusBadge, btn, errMsg, inputCls } from "./ui-bits";
import { EvidencePreview, Uploader, type Attachment } from "./evidence";

const STEPS = ["Details & student", "Expenses & documents", "Review extraction", "Beneficiary & advance", "Confirm & submit"];

function useClaimBundle(id: string | null) {
  return useQuery({
    queryKey: ["claim", id],
    enabled: !!id,
    queryFn: async () => {
      const [c, e, a] = await Promise.all([
        supabase.from("claims").select("*, students(*, beneficiaries(*))").eq("id", id!).single(),
        supabase.from("expenses").select("*").eq("claim_id", id!).order("created_at"),
        supabase.from("attachments").select("*").eq("claim_id", id!).order("created_at"),
      ]);
      if (c.error) throw c.error;
      return { claim: c.data, expenses: e.data ?? [], attachments: (a.data ?? []) as Attachment[] };
    },
  });
}

export function ClaimWizard({ claimId }: { claimId: string | null }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data, refetch } = useClaimBundle(claimId);
  const [step, setStep] = useState(1);
  useEffect(() => { if (data?.claim.wizard_step) setStep(data.claim.wizard_step); }, [data?.claim.id]);

  const editable = !claimId || data?.claim.status === "draft" || data?.claim.status === "changes_requested";
  async function go(n: number) {
    setStep(n);
    if (claimId) await supabase.from("claims").update({ wizard_step: n }).eq("id", claimId);
  }

  if (claimId && !data) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  if (claimId && data && !editable) {
    return <Card className="p-6"><p>This claim is {data.claim.status.replace("_", " ")} and can no longer be edited.</p><Link to="/claims/$id" params={{ id: claimId }} className={btn.ghost + " mt-4"}>View claim</Link></Card>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/claims" className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary"><ChevronLeft className="h-3 w-3" /> Claims</Link>
          <h1 className="text-2xl font-bold tracking-tight text-primary">{data?.claim.title && data.claim.title !== "Untitled claim" ? data.claim.title : "New claim"}</h1>
          <p className="text-xs text-muted-foreground">{data?.claim.ref ?? "Draft"} · saved automatically between steps</p>
        </div>
        {data && <StatusBadge status={data.claim.status} />}
      </div>
      <ol className="mb-6 grid grid-cols-5 gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button disabled={!claimId} onClick={() => go(i + 1)} className="w-full text-left">
              <div className={cn("h-1.5 rounded-full transition-all duration-500", i + 1 < step ? "bg-primary" : i + 1 === step ? "bg-lime" : "bg-border")} />
              <p className={cn("mt-1.5 hidden text-xs font-semibold md:block", i + 1 === step ? "text-primary" : "text-muted-foreground")}>{i + 1}. {s}</p>
            </button>
          </li>
        ))}
      </ol>
      <p className="mb-4 text-sm font-semibold text-primary md:hidden">Step {step} of 5 · {STEPS[step - 1]}</p>

      <div key={step} className="animate-rise">
        {step === 1 && <StepDetails claim={data?.claim ?? null} onSaved={async (id) => {
          if (!claimId) { nav({ to: "/claims/$id/edit", params: { id }, replace: true }); await supabase.from("claims").update({ wizard_step: 2 }).eq("id", id); }
          else { await refetch(); go(2); }
        }} isFinance={!!me?.isFinance} />}
        {step === 2 && data && <StepExpenses bundle={data} refetch={refetch} next={() => go(3)} back={() => go(1)} />}
        {step === 3 && data && <StepReview bundle={data} refetch={refetch} next={() => go(4)} back={() => go(2)} />}
        {step === 4 && data && <StepBeneficiary bundle={data} refetch={refetch} next={() => go(5)} back={() => go(3)} />}
        {step === 5 && data && <StepConfirm bundle={data} back={() => go(4)} onSubmitted={() => { qc.invalidateQueries(); nav({ to: "/claims/$id", params: { id: data.claim.id } }); }} goto={go} />}
      </div>
    </div>
  );
}

type Bundle = NonNullable<ReturnType<typeof useClaimBundle>["data"]>;

function Nav({ back, next, nextLabel = "Continue", disabled }: { back?: () => void; next: () => void; nextLabel?: string; disabled?: boolean }) {
  return (
    <div className="mt-6 flex justify-between">
      {back ? <button type="button" onClick={back} className={btn.ghost}>Back</button> : <span />}
      <button type="button" onClick={next} disabled={disabled} className={btn.primary}>{nextLabel}</button>
    </div>
  );
}

// ---------- Step 1 ----------
function StepDetails({ claim, onSaved, isFinance }: { claim: Bundle["claim"] | null; onSaved: (id: string) => void; isFinance: boolean }) {
  const { data: me } = useMe();
  const [title, setTitle] = useState(claim?.title === "Untitled claim" ? "" : claim?.title ?? "");
  const [purpose, setPurpose] = useState(claim?.purpose ?? "");
  const [studentId, setStudentId] = useState<string | null>(claim?.student_id ?? (isFinance ? null : me?.student?.id ?? null));
  const [scopeId, setScopeId] = useState<string>(claim?.scope_id ?? "");
  const [busy, setBusy] = useState(false);
  const { data: scopes = [] } = useScopes();

  async function save() {
    if (!title.trim() || !purpose.trim() || !studentId || !scopeId) return toast.error("Add a title, the purpose, the department/club/activity, and the student");
    setBusy(true);
    try {
      if (claim) {
        const { error } = await supabase.from("claims").update({ title, purpose, scope_id: scopeId }).eq("id", claim.id);
        if (error) throw error;
        onSaved(claim.id);
      } else {
        const { data, error } = await supabase.from("claims").insert({ title, purpose, scope_id: scopeId, student_id: studentId, created_by: me!.user.id }).select("id").single();
        if (error) throw error;
        onSaved(data.id);
      }
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Card className="p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Claim title" hint="Short and specific, e.g. “Robotics club workshop supplies”.">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Student (reimbursement recipient)" hint={isFinance ? "Search by name or PRN." : "Your claims are always linked to your own record."}>
          {isFinance && !claim ? <StudentPicker value={studentId} onChange={setStudentId} /> :
            <input disabled className={inputCls} value={claim ? "Linked student (fixed after creation)" : `${me?.student?.full_name} · ${me?.student?.prn}`} />}
        </Field>
        <Field label="Department, club or activity" hint="Decides who reviews this claim. You can't pick a reviewer directly.">
          <select className={inputCls} value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
            <option value="">Choose…</option>
            {scopes.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.kind})</option>)}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Actual purchase / activity purpose" hint="What was bought and why. Reviewers rely on this.">
            <textarea rows={3} className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </Field>
        </div>
      </div>
      <Nav next={save} disabled={busy} nextLabel={claim ? "Save & continue" : "Create draft & continue"} />
    </Card>
  );
}

export function StudentPicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const { data: students = [] } = useStudents();
  const [q, setQ] = useState("");
  const sel = students.find((s) => s.id === value);
  const list = students.filter((s) => `${s.full_name} ${s.prn}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  return (
    <div>
      {sel ? (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-accent px-3 py-2 text-sm">
          <span><b>{sel.full_name}</b> · {sel.prn}</span>
          <button type="button" className="text-xs font-semibold text-primary" onClick={() => onChange("")}>Change</button>
        </div>
      ) : (
        <div className="rounded-lg border border-input">
          <input className="w-full rounded-t-lg px-3 py-2 text-sm outline-none" placeholder="Type a name or PRN…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="max-h-48 overflow-auto border-t border-border">
            {list.map((s) => (
              <li key={s.id}><button type="button" onClick={() => onChange(s.id)} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-muted">
                <span>{s.full_name}</span><span className="text-xs text-muted-foreground tabular">{s.prn}</span></button></li>
            ))}
            {list.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">No students found. Add them under Students.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Step 2 ----------
function StepExpenses({ bundle, refetch, next, back }: { bundle: Bundle; refetch: () => void; next: () => void; back: () => void }) {
  const { claim, expenses, attachments } = bundle;
  async function add() {
    const { error } = await supabase.from("expenses").insert({ claim_id: claim.id });
    if (error) toast.error(errMsg(error));
    refetch();
  }
  async function del(id: string) {
    const files = attachments.filter((a) => a.expense_id === id).map((a) => a.storage_path);
    if (files.length) await supabase.storage.from("evidence").remove(files);
    await supabase.from("expenses").delete().eq("id", id);
    refetch();
  }
  useEffect(() => { if (expenses.length === 0) add(); /* eslint-disable-next-line */ }, []);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">One expense = one purchase. Attach its itemized receipt, the UPI screenshot used to pay, and anything supporting — all together.</p>
      {expenses.map((e, i) => (
        <Card key={e.id} className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-primary">Expense {i + 1}</h3>
            {expenses.length > 1 && <button onClick={() => del(e.id)} className="flex items-center gap-1 text-xs font-semibold text-destructive"><Trash2 className="h-3.5 w-3.5" /> Remove</button>}
          </div>
          <Uploader claimId={claim.id} expenseId={e.id} attachments={attachments.filter((a) => a.expense_id === e.id)} editable onChange={refetch} />
        </Card>
      ))}
      <button onClick={add} className={btn.ghost}><Plus className="h-4 w-4" /> Add another expense</button>
      <Nav back={back} next={next} disabled={expenses.length === 0} />
    </div>
  );
}

// ---------- Step 3: signature review ----------
type Facts = { vendor_name: string | null; amount: number | null; date: string | null; invoice_number: string | null; transaction_reference: string | null; payment_status: string | null; items_or_note: string | null };
type Extraction = { source: string; at: string; facts: Facts; suggestion: { category: string | null; explanation: string; confidence: string }; missing: string[]; amount_mismatch: boolean; documents: { file_name: string | null; kind: string | null; amount: number | null; payment_status: string | null }[] };

function StepReview({ bundle, refetch, next, back }: { bundle: Bundle; refetch: () => void; next: () => void; back: () => void }) {
  const [idx, setIdx] = useState(0);
  const { expenses } = bundle;
  const e = expenses[Math.min(idx, expenses.length - 1)];
  const allConfirmed = expenses.length > 0 && expenses.every((x) => x.confirmed_at);
  if (!e) return <Card className="p-6">Add an expense first.</Card>;
  return (
    <div>
      {expenses.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {expenses.map((x, i) => (
            <button key={x.id} onClick={() => setIdx(i)} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", i === idx ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>
              {x.confirmed_at && <Check className="h-3 w-3" />} Expense {i + 1}
            </button>
          ))}
        </div>
      )}
      <ReviewExpense key={e.id} bundle={bundle} expense={e} refetch={refetch} />
      <Nav back={back} next={next} disabled={!allConfirmed} nextLabel={allConfirmed ? "Continue" : "Confirm every expense to continue"} />
    </div>
  );
}

function ReviewExpense({ bundle, expense: e, refetch }: { bundle: Bundle; expense: Bundle["expenses"][number]; refetch: () => void }) {
  const atts = bundle.attachments.filter((a) => a.expense_id === e.id);
  const [active, setActive] = useState(atts[0]?.id);
  const att = atts.find((a) => a.id === active) ?? atts[0];
  const extract = useServerFn(extractExpense);
  const [scanning, setScanning] = useState(false);
  const x = e.extraction as Extraction | null;
  const rescan = e.extraction_rescan as Extraction | null;
  const [f, setF] = useState({
    vendor: e.vendor ?? "", amount: paiseToInput(e.amount_paise), date: e.expense_date ?? "", invoice: e.invoice_no ?? "",
    txn: e.txn_ref ?? "", category: validCategory(e.category), description: e.description ?? "",
  });
  useEffect(() => {
    setF({ vendor: e.vendor ?? "", amount: paiseToInput(e.amount_paise), date: e.expense_date ?? "", invoice: e.invoice_no ?? "", txn: e.txn_ref ?? "", category: validCategory(e.category), description: e.description ?? "" });
  }, [e.updated_at]);

  const attention = useMemo(() => {
    const s = new Set<string>();
    if (!x) return s;
    if (x.facts.vendor_name == null) s.add("vendor");
    if (x.facts.amount == null || x.amount_mismatch) s.add("amount");
    if (x.facts.date == null) s.add("date");
    if (!x.suggestion.category || x.suggestion.confidence === "low") s.add("category");
    return s;
  }, [x]);

  async function scan() {
    setScanning(true);
    try {
      const r = await extract({ data: { expenseId: e.id } });
      toast.success(r.applied ? "Details extracted — please check every field" : "Re-scan saved separately; your confirmed details were not changed");
      refetch();
    } catch (err) { toast.error(errMsg(err)); } finally { setScanning(false); }
  }

  async function save(confirm: boolean) {
    const amount = parseRupeesToPaise(f.amount);
    if (confirm && (!amount || amount <= 0)) return toast.error("Enter a valid amount");
    if (confirm && !f.category) return toast.error("Choose a category");
    if (confirm && !f.vendor.trim()) return toast.error("Enter the vendor / payee");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("expenses").update({
      vendor: f.vendor || null, amount_paise: amount, expense_date: f.date || null, invoice_no: f.invoice || null,
      txn_ref: f.txn || null, category: (validCategory(f.category) || null) as never, description: f.description,
      confirmed_at: confirm ? new Date().toISOString() : null, confirmed_by: confirm ? (u.user?.id ?? null) : null,
    }).eq("id", e.id);
    if (error) return toast.error(errMsg(error));
    toast.success(confirm ? "Details confirmed" : "Saved");
    refetch();
  }
  const set = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: ev.target.value });
  const ring = (k: string) => (attention.has(k) && !e.confirmed_at ? " border-warning ring-2 ring-warning/20" : "");

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.05fr]">
      <Card className="p-4">
        {att ? <EvidencePreview att={att} scanning={scanning} className="h-[420px] lg:h-[520px]" /> :
          <div className="grid h-64 place-items-center rounded-xl bg-muted text-sm text-muted-foreground">No documents — you can still enter details manually.</div>}
        {atts.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {atts.map((a) => (
              <button key={a.id} onClick={() => setActive(a.id)} className={cn("rounded-full px-3 py-1 text-xs font-semibold", a.id === att?.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {a.kind === "upi_screenshot" ? "UPI screenshot" : a.kind === "receipt" ? "Receipt" : "Supporting"}
              </button>
            ))}
          </div>
        )}
        <button onClick={scan} disabled={scanning || !atts.length} className={btn.lime + " mt-4 w-full"}>
          <Sparkles className="h-4 w-4" /> {scanning ? "Reading documents…" : x ? "Re-scan (won't overwrite)" : "Scan with AI"}
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">AI suggests; you decide. Scanning never approves or pays a claim.</p>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-primary">Payment details</h3>
          {x ? <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">Live AI result · {new Date(x.at).toLocaleTimeString()}</span>
            : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manual entry</span>}
        </div>

        {x && (x.amount_mismatch || ["FAILED", "PENDING"].includes(x.facts.payment_status ?? "")) && (
          <div className="mb-4 flex gap-2 rounded-xl bg-warning-soft p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              {x.amount_mismatch && <p>Receipt and screenshot show <b>different amounts</b>: {x.documents.map((d) => d.amount != null ? `₹${d.amount}` : "—").join(" vs ")}.</p>}
              {["FAILED", "PENDING"].includes(x.facts.payment_status ?? "") && <p>The document displays a <b>{x.facts.payment_status?.toLowerCase()}</b> payment status.</p>}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Vendor / payee (received the purchase payment)" attention={attention.has("vendor")}><input className={inputCls + ring("vendor")} value={f.vendor} onChange={set("vendor")} /></Field></div>
          <Field label="Amount (₹)" attention={attention.has("amount")}><input inputMode="decimal" className={inputCls + " tabular" + ring("amount")} value={f.amount} onChange={set("amount")} /></Field>
          <Field label="Date" attention={attention.has("date")}><input type="date" className={inputCls + ring("date")} value={f.date} onChange={set("date")} /></Field>
          <Field label="Invoice number"><input className={inputCls} value={f.invoice} onChange={set("invoice")} /></Field>
          <Field label="Transaction reference"><input className={inputCls} value={f.txn} onChange={set("txn")} /></Field>
          <div className="sm:col-span-2"><Field label="Items / payment note"><textarea rows={2} className={inputCls} value={f.description} onChange={set("description")} /></Field></div>
          <div className="sm:col-span-2">
            <Field label="Category" attention={attention.has("category")}>
              <select className={inputCls + ring("category")} value={f.category} onChange={set("category")}>
                <option value="">Choose a category…</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            {x && (
              <div className="mt-2 rounded-xl bg-accent p-3 text-sm">
                <p className="text-xs font-semibold text-muted-foreground">Suggestion (inferred, not a fact) · {x.suggestion.confidence} confidence</p>
                <p className="mt-1"><b>{x.suggestion.category ?? "No category — purpose not visible"}</b> — {x.suggestion.explanation}</p>
                {x.suggestion.category && x.suggestion.category !== f.category && (
                  <button onClick={() => setF({ ...f, category: x.suggestion.category! })} className="mt-1 text-xs font-semibold text-primary hover:underline">Use suggestion</button>
                )}
              </div>
            )}
          </div>
        </div>
        {x && x.missing.length > 0 && (
          <ul className="mt-3 list-inside list-disc text-xs text-muted-foreground">{x.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
        )}
        {rescan && (
          <div className="mt-3 rounded-xl border border-dashed border-border p-3 text-xs">
            <p className="font-semibold">Latest re-scan (not applied)</p>
            <p className="text-muted-foreground">Vendor {rescan.facts.vendor_name ?? "—"} · Amount {rescan.facts.amount ?? "—"} · Date {rescan.facts.date ?? "—"} · Suggests {rescan.suggestion.category ?? "—"}</p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          {e.confirmed_at ? <span className="flex items-center gap-1.5 text-sm font-semibold text-primary"><Check className="h-4 w-4" /> Confirmed {new Date(e.confirmed_at).toLocaleString()}</span>
            : <button onClick={() => save(false)} className={btn.ghost}>Save draft</button>}
          <button onClick={() => save(true)} className={btn.primary}><Check className="h-4 w-4" /> {e.confirmed_at ? "Re-confirm changes" : "Confirm details"}</button>
        </div>
      </Card>
    </div>
  );
}

// ---------- Step 4 ----------
function StepBeneficiary({ bundle, refetch, next, back }: { bundle: Bundle; refetch: () => void; next: () => void; back: () => void }) {
  const { claim } = bundle;
  const bens = (claim.students?.beneficiaries ?? []).filter((b) => b.is_active);
  const { data: advances = [] } = useQuery({
    queryKey: ["advances-student", claim.student_id],
    queryFn: async () => (await supabase.from("advances").select("*").eq("student_id", claim.student_id)).data ?? [],
  });
  async function choose(id: string) {
    await supabase.from("claims").update({ beneficiary_id: id, beneficiary_confirmed: false }).eq("id", claim.id);
    refetch();
  }
  async function confirm(v: boolean) {
    await supabase.from("claims").update({ beneficiary_confirmed: v }).eq("id", claim.id);
    refetch();
  }
  const open = advances.filter((a) => a.amount_paise > a.allocated_paise);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Card className="p-5">
        <h3 className="font-semibold text-primary">Who receives the reimbursement</h3>
        <p className="mt-1 text-sm text-muted-foreground">This is the student's account — not the vendor who was paid for the purchase.</p>
        <div className="mt-4 space-y-2">
          {bens.map((b) => (
            <button key={b.id} onClick={() => choose(b.id)} className={cn("flex w-full items-center justify-between rounded-xl border p-4 text-left transition",
              claim.beneficiary_id === b.id ? "border-primary bg-accent" : "border-border hover:bg-muted")}>
              <div>
                <p className="font-semibold">{b.holder_name} {b.is_default && <span className="ml-1 rounded bg-lime px-1.5 text-[10px] font-bold text-lime-foreground">Default</span>}</p>
                <p className="text-sm text-muted-foreground">{b.bank_name} · {b.ifsc}</p>
                <p className="text-sm tabular">{maskAccount(b.account_last4)}</p>
              </div>
              {b.is_fictional && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase text-warning">Fictional</span>}
            </button>
          ))}
          {bens.length === 0 && <p className="rounded-xl bg-warning-soft p-3 text-sm">No beneficiary on file. Finance staff add these under <b>Students</b>.</p>}
        </div>
        {claim.beneficiary_id && (
          <label className="mt-4 flex items-start gap-2 rounded-xl bg-muted p-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={claim.beneficiary_confirmed} onChange={(e) => confirm(e.target.checked)} />
            I confirm this is the correct beneficiary account for {claim.students?.full_name}.
          </label>
        )}
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold text-primary">Advances</h3>
        <p className="mt-1 text-sm text-muted-foreground">Finance applies open advances after review. Net settlement = approved − advance applied.</p>
        <ul className="mt-3 space-y-2">
          {open.map((a) => (
            <li key={a.id} className="rounded-xl border border-border p-3 text-sm">
              <p className="font-semibold">{a.purpose}</p>
              <p className="text-muted-foreground tabular">{formatINR(a.amount_paise - a.allocated_paise)} unallocated of {formatINR(a.amount_paise)}</p>
            </li>
          ))}
          {open.length === 0 && <li className="text-sm text-muted-foreground">No open advances for this student.</li>}
        </ul>
      </Card>
      <div className="lg:col-span-2"><Nav back={back} next={next} disabled={!claim.beneficiary_confirmed} /></div>
    </div>
  );
}

// ---------- Step 5 ----------
function StepConfirm({ bundle, back, onSubmitted, goto }: { bundle: Bundle; back: () => void; onSubmitted: () => void; goto: (n: number) => void }) {
  const { claim, expenses, attachments } = bundle;
  const total = expenses.reduce((s, e) => s + (e.amount_paise ?? 0), 0);
  const ben = claim.students?.beneficiaries?.find((b) => b.id === claim.beneficiary_id);
  const [busy, setBusy] = useState(false);
  const problems = [
    !expenses.length && "Add at least one expense",
    expenses.some((e) => !e.confirmed_at) && "Confirm every expense's details",
    !claim.beneficiary_confirmed && "Confirm the beneficiary",
  ].filter(Boolean) as string[];

  async function submit() {
    setBusy(true);
    const { error } = await supabase.rpc("submit_claim", { _claim: claim.id });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    kickEmails();
    toast.success(`${claim.ref} submitted successfully. Your confirmation email is queued.`);
    onSubmitted();
  }
  return (
    <Card className="p-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Claim</p>
          <p className="text-lg font-bold text-primary">{claim.title}</p>
          <p className="text-sm text-muted-foreground">{claim.purpose}</p>
          <p className="mt-3 text-xs font-semibold text-muted-foreground">Student</p>
          <p className="text-sm">{claim.students?.full_name} · {claim.students?.prn}</p>
          <p className="mt-3 text-xs font-semibold text-muted-foreground">Reimburse to</p>
          <p className="text-sm">{ben ? `${ben.holder_name} · ${ben.bank_name} · ${maskAccount(ben.account_last4)}` : "—"}</p>
        </div>
        <div>
          <table className="w-full text-sm tabular">
            <tbody>
              {expenses.map((e, i) => (
                <tr key={e.id} className="border-b border-border">
                  <td className="py-2">{e.vendor ?? `Expense ${i + 1}`}<p className="text-xs text-muted-foreground">{e.category} · {attachments.filter((a) => a.expense_id === e.id).length} file(s)</p></td>
                  <td className="text-right">{formatINR(e.amount_paise)}</td>
                </tr>
              ))}
              <tr><td className="pt-3 font-bold">Total claimed</td><td className="pt-3 text-right text-lg font-bold">{formatINR(total)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      {problems.length > 0 && (
        <div className="mt-5 rounded-xl bg-warning-soft p-3 text-sm">
          {problems.map((p) => <p key={p}>• {p}</p>)}
          <button className="mt-1 text-xs font-semibold text-primary" onClick={() => goto(3)}>Go to review</button>
        </div>
      )}
      <p className="mt-5 text-xs text-muted-foreground">After submission, details are locked. Faculty may request changes, which reopens the claim for editing.</p>
      <Nav back={back} next={submit} disabled={busy || problems.length > 0} nextLabel={busy ? "Submitting…" : `Submit ${formatINR(total)}`} />
    </Card>
  );
}
