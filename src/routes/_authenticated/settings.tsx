import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, roleLabel } from "@/hooks/use-auth";
import { Card, Field, PageHeader, btn, errMsg, inputCls } from "@/components/app/ui-bits";
import { StudentOnboarding } from "@/components/app/student-onboarding";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Profile & settings — Reimora" }, { name: "description", content: "Your profile and team roles." }] }),
  component: Settings,
});

function Settings() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [name, setName] = useState(me?.profile?.full_name ?? "");
  if (!me) return null;
  async function save() {
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", me!.user.id);
    if (error) return toast.error(errMsg(error));
    toast.success("Saved"); qc.invalidateQueries({ queryKey: ["me"] });
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Profile & settings" />
      <Card className="max-w-xl p-5">
        <div className="space-y-3">
          <Field label="Display name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email"><input disabled className={inputCls} value={me.user.email ?? ""} /></Field>
          {me.profile?.college && <Field label="College"><input disabled className={inputCls} value={me.profile.college} /></Field>}
          <p className="text-sm">Access: <b>{me.roles.map((r) => roleLabel[r]).join(", ")}</b></p>
          {me.approverScopes.length > 0 && <p className="text-sm">Reviews claims for: <b>{me.approverScopes.map((s) => s.scopes?.name).join(", ")}</b></p>}
          <button onClick={save} className={btn.primary}>Save</button>
        </div>
      </Card>
      {me.student ? (
        <Card className="max-w-xl p-5 text-sm">
          <p className="font-semibold text-primary">Student record</p>
          <p className="mt-1">{me.student.full_name} · {me.student.prn} · {me.student.department} {me.student.year} {me.student.division && `Div ${me.student.division}`}</p>
        </Card>
      ) : me.isStudent && <StudentOnboarding />}
      <Card className="max-w-xl p-5 text-sm">
        <p className="font-semibold text-primary">Need another role?</p>
        <p className="mt-1 text-muted-foreground">Request Student or Faculty / Club Approver access. Only an administrator can grant it.</p>
        <Link to="/access" className={btn.ghost + " mt-3"}>Request additional access</Link>
      </Card>
    </div>
  );
}

