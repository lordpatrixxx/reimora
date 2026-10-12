import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, type Role } from "@/hooks/use-auth";
import { Card, Field, PageHeader, btn, errMsg, inputCls } from "@/components/app/ui-bits";
import { StudentOnboarding, RequestReviewerAccess } from "@/components/app/student-onboarding";

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
          <p className="text-sm">Roles: <b className="capitalize">{me.roles.map((r) => (r === "faculty" ? "bill reviewer" : r)).join(", ")}</b></p>
          <button onClick={save} className={btn.primary}>Save</button>
        </div>
      </Card>
      {!me.isStaff && me.student && <div className="max-w-xl"><RequestReviewerAccess /></div>}
      {me.student ? (
        <Card className="max-w-xl p-5 text-sm">
          <p className="font-semibold text-primary">Student record</p>
          <p className="mt-1">{me.student.full_name} · {me.student.prn} · {me.student.department} {me.student.year} {me.student.division && `Div ${me.student.division}`}</p>
        </Card>
      ) : me.isStudent && <StudentOnboarding />}
      {me.isFinance && <RoleManager />}
    </div>
  );
}

function RoleManager() {
  const { data: me } = useMe();
  const { data: people = [], refetch } = useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([supabase.from("profiles").select("*").order("created_at"), supabase.from("user_roles").select("*")]);
      return (profiles ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role) }));
    },
  });
  async function toggle(uid: string, role: Role, grant: boolean) {
    const { error } = await supabase.rpc("set_user_role", { _user_id: uid, _role: role, _grant: grant });
    if (error) return toast.error(errMsg(error));
    refetch();
  }
  return (
    <Card className="p-5">
      <p className="font-semibold text-primary">Team roles</p>
      {people.some((p) => p.requested_role && !p.roles.includes(p.requested_role as Role)) && <p className="mt-1 text-sm font-semibold text-warning">Access requests are waiting for your approval.</p>}
      <p className="mb-3 text-sm text-muted-foreground">Finance can grant roles to others. Nobody can change their own roles.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Person</th>{(["student", "faculty", "finance"] as Role[]).map((r) => <th key={r} className="capitalize">{r === "faculty" ? "Bill reviewer" : r}</th>)}</tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-2.5">{p.full_name}<p className="text-xs text-muted-foreground">{p.email}{p.college && ` · ${p.college}`}</p>
                  {p.requested_role && !p.roles.includes(p.requested_role as Role) && (
                    <button onClick={() => toggle(p.id, p.requested_role as Role, true)} className="mt-1 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-bold text-warning">
                      Approve {p.requested_role === "faculty" ? "reviewer" : "finance"} request
                    </button>
                  )}</td>
                {(["student", "faculty", "finance"] as Role[]).map((r) => (
                  <td key={r}><input type="checkbox" disabled={p.id === me?.user.id} checked={p.roles.includes(r)} onChange={(e) => toggle(p.id, r, e.target.checked)} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
