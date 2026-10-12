import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { processNotifications } from "@/lib/evidence.functions";
import { Card, Empty, PageHeader, StatusBadge, btn, errMsg } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — CampusSettle" }, { name: "description", content: "Claim updates and email delivery status." }] }),
  component: Notifications,
});

function Notifications() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const process = useServerFn(processNotifications);
  const { data: rows = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const mine = rows.filter((n) => n.recipient_user === me?.user.id);
  const others = me?.isFinance ? rows : [];

  async function markRead() {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_user", me!.user.id).is("read_at", null);
    qc.invalidateQueries();
  }
  async function deliver() {
    try {
      const r = await process();
      toast[r.configured ? "success" : "warning"](r.configured ? `${r.sent} sent` : `Email sender not configured — ${r.failed} marked failed; nothing was sent.`);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <div>
      <PageHeader title="Notifications" sub="In-app copies of every claim email." action={mine.some((n) => !n.read_at) && <button onClick={markRead} className={btn.ghost}>Mark all read</button>} />
      <div className="mb-4 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
        <b>Email delivery is not set up yet.</b> Notifications are queued and shown here, but no email is sent until a sender domain is configured. Status never shows "sent" unless delivery succeeds.
      </div>
      {mine.length === 0 && !me?.isFinance ? <Empty title="No notifications" body="You'll see updates here when your claims change status." /> : (
        <Card className="divide-y divide-border">
          {mine.map((n) => <Row key={n.id} n={n} />)}
        </Card>
      )}
      {me?.isFinance && (
        <>
          <div className="mb-3 mt-8 flex items-center justify-between">
            <h2 className="font-semibold text-primary">Delivery log (all recipients)</h2>
            <button onClick={deliver} className={btn.ghost}>Attempt delivery</button>
          </div>
          <Card className="divide-y divide-border">
            {others.map((n) => <Row key={n.id} n={n} showMeta />)}
            {others.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nothing queued.</p>}
          </Card>
        </>
      )}
    </div>
  );
}

function Row({ n, showMeta }: { n: { id: string; claim_id: string | null; subject: string; body: string; status: string; created_at: string; read_at: string | null; recipient_email: string; attempts: number; last_error: string | null }; showMeta?: boolean }) {
  return (
    <div className={`flex gap-3 p-4 ${!n.read_at && !showMeta ? "bg-accent/40" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{n.subject}</p><StatusBadge status={n.status} /></div>
        <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(n.created_at).toLocaleString("en-IN")}
          {showMeta && ` · to ${n.recipient_email} · attempts ${n.attempts}${n.last_error ? ` · ${n.last_error}` : ""}`}
        </p>
      </div>
      {n.claim_id && <Link to="/claims/$id" params={{ id: n.claim_id }} className="self-center text-xs font-semibold text-primary">Open</Link>}
    </div>
  );
}
