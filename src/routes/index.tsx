import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reimora — College reimbursements, clearly managed" },
      { name: "description", content: "Scan receipts, route approvals and settle student advances with precise, auditable totals." },
      { property: "og:title", content: "Reimora — College reimbursements, clearly managed" },
      { property: "og:description", content: "AI-assisted receipt scanning, faculty review and advance settlement for college students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");


function SampleTag() {
  return (
    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
      Sample data
    </span>
  );
}

const FIELDS = [
  ["Vendor", "Shree Stationers"],
  ["Amount", "₹750.00"],
  ["Date", "14 Sep 2026"],
  ["Paid via", "UPI"],
] as const;
const STAGES = ["Submitted", "Reviewed", "Approved", "Settled"];

function HeroPreview() {
  const [phase, setPhase] = useState<"scan" | "done">("scan");
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (phase !== "scan") return;
    setShown(0);
    const timers = FIELDS.map((_, i) => setTimeout(() => setShown(i + 1), 600 + i * 300));
    timers.push(setTimeout(() => setPhase("done"), 600 + FIELDS.length * 300 + 150));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  return (
    <div className="relative animate-rise" style={{ animationDelay: "120ms" }}>
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-lime/25 blur-3xl" aria-hidden />
      <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-float">
        {/* window bar */}
        <div className="flex items-center gap-3 border-b border-border bg-muted/60 px-4 py-2.5">
          <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-border" /><span className="h-2.5 w-2.5 rounded-full bg-border" /><span className="h-2.5 w-2.5 rounded-full bg-border" /></div>
          <span className="flex-1 truncate text-center font-mono text-[11px] text-muted-foreground">reimora · claim CS-0142</span>
          <SampleTag />
        </div>

        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-2xl text-primary">Robotics club supplies</p>
              <p className="mt-0.5 text-xs text-muted-foreground">1 receipt · paid by UPI</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${phase === "scan" ? "bg-warning-soft text-warning" : "bg-success-soft text-primary"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${phase === "scan" ? "animate-pulse bg-warning" : "bg-primary"}`} />
              {phase === "scan" ? "Reading receipt" : "Ready to confirm"}
            </span>
          </div>

          <div className="mt-5 grid items-stretch gap-5 sm:grid-cols-[170px_1fr]">
            <div className="relative mx-auto w-[170px] float-receipt">
              <div className="relative overflow-hidden rounded-t-lg border border-border bg-background px-4 pb-6 pt-4 font-mono text-[10px] leading-[1.7] text-foreground/75 shadow-soft receipt-edge">
                {phase === "scan" && <span className="beam" />}
                <p className="text-center text-[11px] font-semibold text-foreground">SHREE STATIONERS</p>
                <p className="text-center text-muted-foreground">Akurdi · INV-2291</p>
                <div className="my-2 border-t border-dashed border-border" />
                {[["Notebooks ×6", "360"], ["Chart paper ×10", "150"], ["Markers", "240"]].map(([x, y]) => (
                  <div key={x} className="flex justify-between"><span>{x}</span><span className="tabular">{y}</span></div>
                ))}
                <div className="my-2 border-t border-dashed border-border" />
                <div className="flex justify-between font-semibold text-foreground"><span>TOTAL</span><span className="tabular">750.00</span></div>
                <p className="mt-1 text-muted-foreground">14/09/26 · UPI</p>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="grid grid-cols-2 gap-2">
                {FIELDS.map(([k, v], i) => (
                  <div key={k} className="rounded-xl border border-border bg-background/60 px-3 py-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{k}</p>
                    {i < shown ? <p className="animate-fade mt-0.5 truncate text-sm font-semibold tabular">{v}</p> : <div className="skeleton mt-1.5 h-3.5 w-16" />}
                  </div>
                ))}
              </div>
              <div className={`mt-2 flex items-center justify-between rounded-xl border border-dashed border-border px-3 py-2 text-xs transition-opacity duration-500 ${phase === "done" ? "opacity-100" : "opacity-0"}`}>
                <span className="text-muted-foreground">Suggested category</span>
                <span className="rounded-full bg-lime px-2 py-0.5 font-semibold text-lime-foreground">Stationery</span>
              </div>
              <button onClick={() => setPhase("scan")} disabled={phase === "scan"} className="mt-auto self-end pt-2 text-xs font-semibold text-muted-foreground transition hover:text-primary disabled:opacity-0">↻ Replay scan</button>
            </div>
          </div>
        </div>

        {/* footer: progress + settlement */}
        <div className="flex flex-col gap-4 border-t border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div className="flex flex-1 items-center gap-1.5 sm:max-w-[240px]">
            {STAGES.map((st, i) => (
              <div key={st} className="flex flex-1 flex-col gap-1.5">
                <span className={`h-1 rounded-full ${i < 3 ? "bg-primary" : "bg-border"}`} />
                <span className={`text-[10px] font-semibold ${i < 3 ? "text-foreground" : "text-muted-foreground"}`}>{st}</span>
              </div>
            ))}
          </div>
          <div className="flex items-baseline gap-2 whitespace-nowrap tabular text-sm">
            <span className="text-muted-foreground">₹2,650 − ₹2,000 =</span>
            <span className="font-display text-2xl text-primary">₹650</span>
            <span className="text-xs text-muted-foreground">to student</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const steps = [
  ["Upload", "Add a receipt and, if paid by UPI, its screenshot — both attach to one expense."],
  ["Review", "AI reads vendor, amount and date. You confirm every field before submitting."],
  ["Approve", "Faculty approves in full or in part, with reasons recorded for every change."],
  ["Settle", "Finance applies advances and records the payout or the amount to return."],
];

const features = [
  ["AI extraction", "Facts and suggestions kept separate. Unknown values stay empty — never guessed."],
  ["Saved beneficiaries", "Masked account details with change history and a snapshot on every payment."],
  ["Advances", "Track advances per purpose. Approved − advance = net settlement, both directions."],
  ["Notifications", "Emails for each status change, with honest queued, sent and failed states."],
];

function Index() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 md:pt-20 lg:grid-cols-[1fr_1.05fr]">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-lime ring-2 ring-primary/20" /> Receipts · Approvals · Settlement
            </span>
            <h1 className="mt-6 font-display text-5xl leading-[0.98] text-primary md:text-7xl">
              College reimbursements, <em>clearly</em> managed.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Scan a receipt, confirm what AI found, and let faculty and finance take it from there —
              with every rupee of approval and advance accounted for.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:-translate-y-0.5">Get started</Link>
              <Link to="/demo" className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-primary transition hover:bg-muted">Explore demo</Link>
            </div>
          </div>
          <HeroPreview />
        </section>

        <section id="how" className="border-y border-border bg-card py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="font-display text-4xl text-primary md:text-5xl">Four calm steps.</h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-4">
              {steps.map(([t, d], i) => (
                <li key={t} className="animate-rise rounded-2xl border border-border p-5" style={{ animationDelay: `${i * 80}ms` }}>
                  <span className="text-xs font-bold text-muted-foreground tabular">0{i + 1}</span>
                  <h3 className="mt-2 text-lg font-bold text-primary">{t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-display text-4xl text-primary md:text-5xl">Built for precision.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {features.map(([t, d]) => (
              <div key={t} className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-float">
                <span className="block h-1 w-8 rounded-full bg-lime transition-all group-hover:w-14" />
                <h3 className="mt-4 text-lg font-bold text-primary">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="demo" className="bg-primary py-20 text-primary-foreground">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="font-display text-4xl md:text-5xl">The faculty view.</h2>
              <p className="mt-4 opacity-75">Every expense, attachment and flag in one place. Partial approvals require a reason.</p>
              <p className="mt-6 text-sm opacity-60">Try every scenario in the demo — all fictional, no emails sent.</p>
            </div>
            <div className="rounded-2xl bg-card p-5 text-card-foreground shadow-float">
              <div className="mb-4 flex items-center justify-between"><span className="font-semibold">Review · CS-0139</span><SampleTag /></div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2">Expense</th><th className="pb-2">Category</th><th className="pb-2 text-right">Claimed</th><th className="pb-2 text-right">Approved</th></tr></thead>
                <tbody className="tabular">
                  <tr className="border-t border-border"><td className="py-2.5">Banner printing</td><td>Printing</td><td className="text-right">{inr(1200)}</td><td className="text-right font-semibold">{inr(1200)}</td></tr>
                  <tr className="border-t border-border"><td className="py-2.5">Team snacks</td><td>Refreshment</td><td className="text-right">{inr(800)}</td><td className="text-right font-semibold text-warning">{inr(500)}</td></tr>
                  <tr className="border-t border-border"><td className="py-2.5">Auto fare <span className="ml-1 rounded bg-destructive-soft px-1.5 text-[10px] font-bold text-destructive">Possible duplicate</span></td><td>Travel</td><td className="text-right">{inr(300)}</td><td className="text-right text-muted-foreground">—</td></tr>
                </tbody>
              </table>
              <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-xs">Reduction reason: “Snacks capped at ₹500 per event.”</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
