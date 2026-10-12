import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, roleLabel, type Role } from "@/hooks/use-auth";
import { usePeople, useScopes, type Person } from "@/lib/admin";
import { Card, Empty, PageHeader, btn, errMsg, inputCls } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users & roles — Reimora" }, { name: "description", content: "Grant, change, suspend or revoke access." }] }),
  component: Users,
});

const ROLES: Role[] = ["student", "faculty", "finance", "super_admin"];

function Users() {
  const { data: people = [], isLoading } = usePeople();
  const [q, setQ] = useState("");
  const list = people.filter((p) => `${p.full_name} ${p.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Users & roles" sub="Roles take effect immediately. Nobody can change their own roles, and at least one active super administrator always remains." />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className={inputCls + " mb-4 max-w-sm"} />
      {isLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}</div>
        : list.length === 0 ? <Empty title="No people found" body="People appear after they sign in for the first time." />
        : <div className="space-y-3">{list.map((p) => <PersonCard key={p.id} p={p} />)}</div>}
    </div>
  );
}

function PersonCard({ p }: { p: Person }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: scopes = [] } = useScopes();
  const [busy, setBusy] = useState(false);
  const self = p.id === me?.user.id;
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-people"] });

  async function run(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(ok);
    refresh();
  }
  const toggleRole = (role: Role, grant: boolean) => {
    if (!grant && !confirm(`Revoke ${roleLabel[role]} from ${p.full_name}?`)) return;
    run(() => supabase.rpc("set_user_role", { _user_id: p.id, _role: role, _grant: grant }), grant ? "Role granted" : "Role revoked");
  };
  const suspend = () => {
    if (p.suspended) return run(() => supabase.rpc("admin_set_suspension", { _user: p.id, _suspend: false, _reason: "" }), "Access restored");
    const reason = prompt(`Why are you suspending ${p.full_name}? This is shown to them.`);
    if (!reason?.trim()) return;
    run(() => supabase.rpc("admin_set_suspension", { _user: p.id, _suspend: true, _reason: reason }), "Account suspended");
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{p.full_name} {self && <span className="text-xs text-muted-foreground">(you)</span>}</p>
          <p className="truncate text-xs text-muted-foreground">{p.email}{p.college && ` · ${p.college}`}</p>
          {p.suspended && <p className="mt-1 text-xs font-semibold text-destructive">Suspended{p.suspendedReason && `: ${p.suspendedReason}`}</p>}
          {p.roles.length === 0 && !p.suspended && <p className="mt-1 text-xs text-warning">No access yet</p>}
        </div>
        {!self && <button disabled={busy} onClick={suspend} className={p.suspended ? btn.ghost : btn.ghost + " text-destructive"}>{p.suspended ? "Restore access" : "Suspend"}</button>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {ROLES.map((r) => {
          const on = p.roles.includes(r);
          return (
            <button key={r} disabled={busy || self} onClick={() => toggleRole(r, !on)} aria-pressed={on}
              className={"rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-60 " + (on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted")}>
              {on ? "✓ " : "+ "}{roleLabel[r]}
            </button>
          );
        })}
      </div>
      {p.roles.includes("faculty") && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-semibold text-muted-foreground">Reviews claims for</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.scopes.map((s) => (
              <span key={s.scope_id} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                {s.scopes?.name}
                <button disabled={busy} aria-label={`Remove ${s.scopes?.name}`} onClick={() => run(() => supabase.rpc("admin_set_approver_scope", { _user: p.id, _scope: s.scope_id, _grant: false }), "Scope removed")}>×</button>
              </span>
            ))}
            {p.scopes.length === 0 && <span className="text-xs text-warning">No scope yet — this approver sees only claims assigned directly.</span>}
            <select disabled={busy} value="" aria-label="Add scope" className="rounded-full border border-border bg-card px-2 py-1 text-xs"
              onChange={(e) => e.target.value && run(() => supabase.rpc("admin_set_approver_scope", { _user: p.id, _scope: e.target.value, _grant: true }), "Scope assigned")}>
              <option value="">+ Add scope</option>
              {scopes.filter((s) => !p.scopes.some((x) => x.scope_id === s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      )}
    </Card>
  );
}
