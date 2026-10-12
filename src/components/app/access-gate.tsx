import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GraduationCap, ShieldCheck, Clock, XCircle, LogOut, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, roleLabel, type Me } from "@/hooks/use-auth";
import { Logo } from "@/components/site-chrome";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, Field, btn, errMsg, inputCls } from "./ui-bits";
import { cn } from "@/lib/utils";

export type Details = Partial<Record<"full_name" | "department" | "club" | "reason" | "prn" | "year" | "division" | "designation" | "review_scope", string>>;
export const ROLE_PREF_KEY = "reimora-role-pref";

async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/auth";
}

function GateFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-5">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={signOut} className={btn.ghost}><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-10 animate-rise">{children}</main>
    </div>
  );
}

/** Shown instead of the app for users without active access. */
export function AccessGate({ me }: { me: Me }) {
  const [showForm, setShowForm] = useState(false);
  if (me.suspended) {
    return (
      <GateFrame>
        <Card className="p-8 text-center">
          <Ban className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 font-display text-4xl text-primary">Your access is suspended</h1>
          <p className="mt-2 text-sm text-muted-foreground">An administrator has paused your Reimora access. You can't view or change claims while suspended.</p>
          {me.suspendedReason && <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm"><b>Reason:</b> {me.suspendedReason}</p>}
          <p className="mt-4 text-xs text-muted-foreground">Contact the administrator if you think this is a mistake.</p>
        </Card>
      </GateFrame>
    );
  }
  const pending = me.requests.find((r) => r.status === "PENDING");
  const latest = me.requests[0];
  if (pending && !showForm) return <GateFrame><PendingCard req={pending} onNew={() => setShowForm(true)} /></GateFrame>;
  return (
    <GateFrame>
      {latest?.status === "REJECTED" && !showForm && (
        <Card className="mb-6 border-destructive/30 p-5">
          <div className="flex gap-3">
            <XCircle className="h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold">Your last request ({latest.ref}) was not approved</p>
              <p className="mt-1 text-sm text-muted-foreground">Reason: {latest.decision_reason}</p>
              <p className="mt-1 text-sm text-muted-foreground">You can update the details below and submit a new request.</p>
            </div>
          </div>
        </Card>
      )}
      <RequestAccessForm me={me} />
    </GateFrame>
  );
}

type Req = Me["requests"][number];

export function PendingCard({ req, onNew }: { req: Req; onNew?: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const d = req.details as Details;
  async function withdraw() {
    if (!confirm("Withdraw this access request?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("withdraw_access_request", { _id: req.id });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Request withdrawn");
    qc.invalidateQueries({ queryKey: ["me"] });
  }
  return (
    <Card className="p-8">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-warning-soft"><Clock className="h-6 w-6 text-warning" /></div>
      <h1 className="mt-4 font-display text-4xl text-primary">Access request pending</h1>
      <p className="mt-2 text-sm text-muted-foreground">The administrator has been notified. Once your request is approved, this page opens your dashboard automatically the next time you visit or refresh.</p>
      <dl className="mt-6 grid gap-3 rounded-xl border border-border p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Requested role</dt><dd className="font-semibold">{roleLabel[req.requested_role]}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Department / club</dt><dd className="font-semibold">{req.scopes?.name ?? req.scope_text ?? d.department}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Submitted</dt><dd className="font-semibold">{new Date(req.created_at).toLocaleString("en-IN")}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Status</dt><dd><span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">Pending review</span></dd></div>
      </dl>
      <div className="mt-4 rounded-xl bg-muted p-4 text-sm">
        <p className="font-semibold">What happens next</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted-foreground">
          <li>An administrator checks your details.</li>
          <li>They approve (possibly adjusting the scope) or explain why not.</li>
          <li>You get an in-app notification, and an email once email sending is set up.</li>
        </ol>
      </div>
      {open && (
        <div className="mt-4 space-y-1 rounded-xl border border-border p-4 text-sm animate-fade">
          <p className="text-xs text-muted-foreground">Request {req.ref}</p>
          {Object.entries(d).filter(([, v]) => v).map(([k, v]) => <p key={k}><span className="capitalize text-muted-foreground">{k.replace("_", " ")}:</span> {v}</p>)}
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <button onClick={() => setOpen(!open)} className={btn.ghost}>{open ? "Hide request" : "View request"}</button>
        <button onClick={withdraw} disabled={busy} className={btn.ghost}>{busy ? "Withdrawing…" : "Withdraw"}</button>
        {onNew && <button onClick={onNew} className={btn.ghost}>Request a different role</button>}
        <button onClick={signOut} className={btn.ghost}>Sign out</button>
      </div>
    </Card>
  );
}

export function RequestAccessForm({ me, onDone }: { me: Me; onDone?: () => void }) {
  const qc = useQueryClient();
  const pref = typeof window !== "undefined" ? sessionStorage.getItem(ROLE_PREF_KEY) : null;
  const [role, setRole] = useState<"student" | "faculty">(pref === "faculty" ? "faculty" : "student");
  const [f, setF] = useState<Details>({ full_name: me.profile?.full_name ?? "", department: "Information Technology" });
  const [scopeId, setScopeId] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: scopes = [] } = useQuery({
    queryKey: ["scopes"],
    queryFn: async () => (await supabase.from("scopes").select("*").eq("active", true).order("kind").order("name")).data ?? [],
  });
  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const keys: (keyof Details)[] = role === "student" ? ["full_name", "department", "club", "prn", "year", "division"] : ["full_name", "department", "club", "designation", "review_scope"];
    const details = Object.fromEntries(keys.map((k) => [k, (f[k] ?? "").trim()]));
    const { error } = await supabase.rpc("submit_access_request", {
      _role: role, _scope: scopeId || (null as unknown as string), _scope_text: role === "faculty" && !scopeId ? f.review_scope ?? "" : f.club ?? "", _details: details,
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    sessionStorage.removeItem(ROLE_PREF_KEY);
    toast.success("Request submitted. The administrator has been notified.");
    await qc.invalidateQueries({ queryKey: ["me"] });
    onDone?.();
  }

  const options = [
    { v: "student" as const, icon: GraduationCap, t: "Student", d: "Submit reimbursement claims, upload receipts, and track your payments." },
    { v: "faculty" as const, icon: ShieldCheck, t: "Faculty / Club Approver", d: "Review assigned reimbursement claims and approve eligible expenses." },
  ];

  return (
    <div>
      <h1 className="font-display text-4xl text-primary md:text-5xl">Request access to Reimora</h1>
      <p className="mt-2 text-muted-foreground">You're signed in as <b className="text-foreground">{me.user.email}</b>. Tell us how you'll use Reimora — an administrator approves every request.</p>
      <form onSubmit={submit} className="mt-8 space-y-6">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-muted-foreground">I need access as</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((o) => (
              <button type="button" key={o.v} onClick={() => setRole(o.v)} aria-pressed={role === o.v}
                className={cn("rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  role === o.v ? "border-primary bg-accent shadow-soft" : "border-border bg-card hover:bg-muted")}>
                <o.icon className="h-5 w-5 text-primary" />
                <p className="mt-2 font-semibold">{o.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{o.d}</p>
              </button>
            ))}
          </div>
        </fieldset>
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Full name"><input required className={inputCls} value={f.full_name ?? ""} onChange={set("full_name")} /></Field>
          <Field label="Verified email" hint="From your sign-in; can't be changed here."><input disabled className={inputCls} value={me.user.email ?? ""} /></Field>
          <Field label="Department"><input required className={inputCls} value={f.department ?? ""} onChange={set("department")} /></Field>
          <Field label="Club or organisation (optional)"><input className={inputCls} value={f.club ?? ""} onChange={set("club")} /></Field>
          {role === "student" ? (
            <>
              <Field label="PRN"><input required className={inputCls} value={f.prn ?? ""} onChange={set("prn")} /></Field>
              <Field label="Year"><select required className={inputCls} value={f.year ?? ""} onChange={set("year")}>
                <option value="">Choose…</option>{["First Year", "Second Year", "Third Year", "Final Year"].map((y) => <option key={y}>{y}</option>)}
              </select></Field>
              <Field label="Division"><input className={inputCls} placeholder="e.g. B" value={f.division ?? ""} onChange={set("division")} /></Field>
            </>
          ) : (
            <>
              <Field label="Designation or position"><input required className={inputCls} placeholder="e.g. Assistant Professor, Club coordinator" value={f.designation ?? ""} onChange={set("designation")} /></Field>
              <Field label="Department, club or activity you represent" hint="The administrator can adjust this before approval.">
                <select className={inputCls} value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                  <option value="">Not listed — describe below</option>
                  {scopes.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.kind})</option>)}
                </select>
              </Field>
              <Field label="Scope of claims you need to review"><input required className={inputCls} placeholder="e.g. Robotics club event expenses" value={f.review_scope ?? ""} onChange={set("review_scope")} /></Field>
            </>
          )}
        </Card>
        <p className="text-xs text-muted-foreground">Bank details are never collected here. Finance adds payment details separately.</p>
        <button disabled={busy} className={btn.primary + " w-full sm:w-auto"}>{busy ? "Submitting…" : "Submit access request"}</button>
      </form>
    </div>
  );
}
