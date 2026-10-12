import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePeople } from "@/lib/admin";
import { Card, Empty, PageHeader } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit log — Reimora" }, { name: "description", content: "History of administrative actions." }] }),
  component: Audit,
});

function Audit() {
  const { data: people = [] } = usePeople();
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => (await supabase.from("admin_audit").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const nm = (id: string | null) => people.find((p) => p.id === id)?.full_name ?? "";
  return (
    <div>
      <PageHeader title="Audit log" sub="Every administrative change: who acted, what changed, and when. Entries cannot be edited." />
      {isLoading ? <div className="skeleton h-40" /> : data.length === 0 ? <Empty title="No administrative actions yet" body="Approvals, role changes and reassignments will be recorded here." /> : (
        <Card className="divide-y divide-border">
          {data.map((a) => (
            <div key={a.id} className="flex flex-wrap justify-between gap-2 p-4 text-sm">
              <div className="min-w-0">
                <p><b>{a.actor_name}</b> · {a.action}{a.target_user && <> · <span className="text-muted-foreground">{nm(a.target_user)}</span></>}</p>
                {a.details && <p className="truncate text-xs text-muted-foreground">{Object.entries(a.details as Record<string, unknown>).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
              </div>
              <time className="text-xs tabular text-muted-foreground">{new Date(a.created_at).toLocaleString("en-IN")}</time>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
