import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { processNotifications } from "@/lib/evidence.functions";
import { Card, Empty, PageHeader, StatusBadge, btn, errMsg } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Reimora" }, { name: "description", content: "Claim updates and email delivery status." }] }),
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
  const [cat, setCat] = useState<"all" | "access" | "claim">("all");
  const mine = rows.filter((n) => n.recipient_user === me?.user.id && (cat === "all" || n.category === cat));
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
      <PageHeader title="Notifications" sub="In-app copies of every email. Access updates and claim updates are labelled separately." action={mine.some((n) => !n.read_at) && <button onClick={markRead} className={btn.ghost}>Mark all read</button>} />
      <div className="mb-4 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
        <b>Email delivery is not set up yet.</b> Notifications are queued and shown here, but no email is sent until a sender domain is configured. Status never shows "sent" unless delivery succeeds.
      </div>
      <div className="mb-4 flex rounded-full border border-border bg-card p-1 w-fit" role="tablist">
        {(["all", "access", "claim"] as const).map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)}
            className={"rounded-full px-3 py-1.5 text-xs font-semibold transition " + (cat === c ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {c === "all" ? "All" : c === "access" ? "Access requests" : "Reimbursement claims"}
          </button>
        ))}
      </div>
      {mine.length === 0 && !me?.isFinance ? <Empty title="No notifications" body="You'll see updates here when your claims change status." /> : (
        <Card className="divide-y divide-border">
          {mine.map((n) => <Row key={n.id} n={n} showAdmin={!!me?.isSuperAdmin} />)}
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

function Row({ n, showMeta, showAdmin }: { showAdmin?: boolean; n: { id: string; claim_id: string | null; access_request_id: string | null; category: string; subject: string; body: string; status: string; created_at: string; read_at: string | null; recipient_email: string; attempts: number; last_error: string | null }; showMeta?: boolean }) {
  return (
    <div className={`flex gap-3 p-4 ${!n.read_at && !showMeta ? "bg-accent/40" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-muted px-1.5 py-px text-[10px] font-bold uppercase text-muted-foreground">{n.category === "access" ? "Access" : "Claim"}</span><p className="font-semibold">{n.subject}</p><StatusBadge status={n.status} /></div>
        <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(n.created_at).toLocaleString("en-IN")}
          {showMeta && ` · to ${n.recipient_email} · attempts ${n.attempts}${n.last_error ? ` · ${n.last_error}` : ""}`}
        </p>
      </div>
      {n.claim_id ? <Link to="/claims/$id" params={{ id: n.claim_id }} className="self-center text-xs font-semibold text-primary">Open claim</Link>
        : n.access_request_id && showAdmin ? <Link to="/admin/requests" search={{ id: n.access_request_id }} className="self-center text-xs font-semibold text-primary">Open request</Link> : null}
    </div>
  );
}
