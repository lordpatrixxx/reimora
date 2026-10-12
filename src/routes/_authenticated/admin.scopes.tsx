import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePeople, useScopes } from "@/lib/admin";
import { Card, Empty, Field, PageHeader, btn, errMsg, inputCls } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/admin/scopes")({
  head: () => ({ meta: [{ title: "Approver scopes — Reimora" }, { name: "description", content: "Departments, clubs and activities used to route claims." }] }),
  component: Scopes,
});

function Scopes() {
  const qc = useQueryClient();
  const { data: scopes = [], isLoading } = useScopes(true);
  const { data: people = [] } = usePeople();
  const [kind, setKind] = useState("club");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(id: string | null, k: string, n: string, active: boolean) {
    setBusy(true);
    const { error } = await supabase.rpc("admin_upsert_scope", { _id: id as string, _kind: k, _name: n, _active: active });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(id ? "Updated" : "Scope added");
    setName("");
    qc.invalidateQueries({ queryKey: ["scopes"] });
  }

  return (
    <div>
      <PageHeader title="Approver scopes" sub="Students pick one of these when creating a claim. Claims go to the approvers assigned here (assign them under Users & roles)." />
      <Card className="mb-6 p-5">
        <form onSubmit={(e) => { e.preventDefault(); save(null, kind, name, true); }} className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
          <Field label="Type"><select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="department">Department</option><option value="club">Club</option><option value="activity">Activity</option></select></Field>
          <Field label="Name"><input required className={inputCls} placeholder="e.g. Robotics Club" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <button disabled={busy} className={btn.primary}>{busy ? "Adding…" : "Add scope"}</button>
        </form>
      </Card>
      {isLoading ? <div className="skeleton h-40" /> : scopes.length === 0 ? <Empty title="No scopes yet" body="Add a department, club or activity so claims can be routed." /> : (
        <Card className="divide-y divide-border">
          {scopes.map((s) => {
            const approvers = people.filter((p) => p.scopes.some((x) => x.scope_id === s.id) && !p.suspended);
            return (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{s.name} <span className="text-xs font-normal capitalize text-muted-foreground">· {s.kind}</span>{!s.active && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}</p>
                  <p className={"text-xs " + (approvers.length ? "text-muted-foreground" : "text-warning")}>
                    {approvers.length ? `Approvers: ${approvers.map((a) => a.full_name).join(", ")}` : "No approver — claims here go to the Unassigned list"}
                  </p>
                </div>
                <button disabled={busy} onClick={() => save(s.id, s.kind, s.name, !s.active)} className={btn.ghost}>{s.active ? "Deactivate" : "Activate"}</button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
