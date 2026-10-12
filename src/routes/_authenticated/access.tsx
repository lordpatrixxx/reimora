import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-auth";
import { RequestAccessForm, PendingCard } from "@/components/app/access-gate";
import { Card, StatusBadge } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/access")({
  head: () => ({ meta: [{ title: "Request more access — Reimora" }, { name: "description", content: "Request an additional role in Reimora." }] }),
  component: Access,
});

function Access() {
  const { data: me } = useMe();
  const nav = useNavigate();
  if (!me) return null;
  const pending = me.requests.filter((r) => r.status === "PENDING");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {pending.map((r) => <PendingCard key={r.id} req={r} />)}
      <RequestAccessForm me={me} onDone={() => nav({ to: "/settings" })} />
      {me.requests.length > 0 && (
        <Card className="divide-y divide-border">
          <p className="p-4 font-semibold text-primary">Your access requests</p>
          {me.requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div><p className="font-semibold">{r.requested_role === "student" ? "Student" : "Faculty / Club Approver"} · {r.ref}</p>
                {r.decision_reason && <p className="text-xs text-muted-foreground">{r.decision_reason}</p>}</div>
              <StatusBadge status={r.status.toLowerCase() === "pending" ? "pending_access" : r.status.toLowerCase()} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
