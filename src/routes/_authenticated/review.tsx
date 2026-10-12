import { createFileRoute, Link } from "@tanstack/react-router";
import { useClaims } from "@/lib/queries";
import { formatINR } from "@/lib/money";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({ meta: [{ title: "Review queue — CampusSettle" }, { name: "description", content: "Claims awaiting faculty review." }] }),
  component: Review,
});

function Review() {
  const { data: claims = [] } = useClaims();
  const queue = claims.filter((c) => c.status === "submitted" || c.status === "under_review")
    .sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""));
  return (
    <div>
      <PageHeader title="Review queue" sub="Oldest first. Inspect each receipt, approve fully or partially, request changes, or reject with a reason." />
      {queue.length === 0 ? <Empty title="Queue is clear" body="New submissions will appear here." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {queue.map((c) => (
            <Link key={c.id} to="/claims/$id" params={{ id: c.id }}>
              <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-float">
                <div className="flex justify-between gap-2"><p className="font-semibold">{c.title}</p><StatusBadge status={c.status} /></div>
                <p className="text-xs text-muted-foreground">{c.ref} · {c.students?.full_name} · {c.students?.prn}</p>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-xs text-muted-foreground">{c.expenses.length} expense(s) · submitted {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString("en-IN") : "—"}</span>
                  <span className="text-lg font-bold tabular text-primary">{formatINR(c.claimed_paise)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
