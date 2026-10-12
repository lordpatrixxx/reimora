import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { Card, Field, btn, inputCls, errMsg } from "./ui-bits";

/** Students link their account to their own student record (name + PRN). */
export function StudentOnboarding() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: me?.profile?.full_name ?? "", prn: "", department: "Information Technology", year: "", division: "" });
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setBusy(true);
    const { error } = await supabase.from("students").insert({ ...f, college: me.profile?.college ?? null, prn: f.prn.trim().toUpperCase(), user_id: me.user.id, email: me.user.email!, created_by: me.user.id });
    setBusy(false);
    if (error) return toast.error(error.code === "23505" ? "That PRN is already registered. Ask finance to link it to your account." : errMsg(error));
    toast.success("Student profile saved");
    qc.invalidateQueries();
  }
  return (
    <Card className="mx-auto max-w-lg p-6">
      <h1 className="font-display text-3xl text-primary">Set up your student profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">Claims you create are always linked to this record. Notifications go to {me?.user.email}.</p>
      {me?.profile?.college && (
        <p className="mt-4 rounded-xl bg-accent px-3 py-2 text-sm text-primary">College: <b>{me.profile.college}</b> <span className="text-xs text-muted-foreground">(from your college email)</span></p>
      )}
      <RequestReviewerAccess />
      <form onSubmit={save} className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Full name"><input required className={inputCls} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field></div>
        <Field label="PRN"><input required className={inputCls} value={f.prn} onChange={(e) => setF({ ...f, prn: e.target.value })} /></Field>
        <Field label="Department"><input required className={inputCls} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></Field>
        <Field label="Year"><input className={inputCls} placeholder="Second Year" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></Field>
        <Field label="Division"><input className={inputCls} placeholder="B" value={f.division} onChange={(e) => setF({ ...f, division: e.target.value })} /></Field>
        <button disabled={busy} className={btn.primary + " sm:col-span-2"}>Save profile</button>
      </form>
      <p className="mt-4 text-xs text-muted-foreground">Bank beneficiary details are added by finance staff. During this demonstration, only fictional details are accepted.</p>
    </Card>
  );
}

export function RequestReviewerAccess() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  if (!me || me.isStaff) return null;
  const pending = me.profile?.requested_role;
  async function ask(role: "faculty" | "finance") {
    const { error } = await supabase.rpc("request_role", { _role: role });
    if (error) return toast.error(errMsg(error));
    toast.success("Request sent to finance for approval");
    qc.invalidateQueries({ queryKey: ["me"] });
  }
  return (
    <div className="mt-4 rounded-xl border border-dashed border-border p-3 text-sm">
      {pending ? (
        <p>Your request for <b>{pending === "faculty" ? "bill reviewer" : "finance"}</b> access is waiting for approval.</p>
      ) : (
        <>
          <p className="text-muted-foreground">Here to check bills and approve reimbursements instead?</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => ask("faculty")} className={btn.ghost}>Request reviewer access</button>
            <button type="button" onClick={() => ask("finance")} className={btn.ghost}>Request finance access</button>
          </div>
        </>
      )}
    </div>
  );
}
