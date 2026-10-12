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
    const timers = FIELDS.map((_, i) => setTimeout(() => setShown(i + 1), 700 + i * 350));
    timers.push(setTimeout(() => setPhase("done"), 700 + FIELDS.length * 350 + 200));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  return (
    <div className="relative animate-rise" style={{ animationDelay: "120ms" }}>
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent/60 blur-2xl" aria-hidden />
      <div className="rounded-3xl border border-border bg-card p-5 shadow-float md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Claim CS-0142</p>
            <p className="font-semibold text-primary">Robotics club supplies</p>
          </div>
          <SampleTag />
        </div>

        <div className="mt-5 grid items-center gap-6 sm:grid-cols-[180px_1fr]">
          {/* Receipt */}
          <div className="relative mx-auto w-[180px] float-receipt">
            <div className="relative overflow-hidden rounded-t-xl border border-border bg-background p-4 font-mono text-[10.5px] leading-relaxed text-foreground/80 shadow-soft receipt-edge pb-6">
              {phase === "scan" && <span className="beam" />}
              <p className="text-center text-[11px] font-bold tracking-wide">SHREE STATIONERS</p>
              <p className="text-center text-muted-foreground">Akurdi · INV-2291</p>
              <div className="my-2 border-t border-dashed border-border" />
              {[["Notebooks ×6", "360"], ["Chart paper ×10", "150"], ["Markers", "240"]].map(([a, b]) => (
                <div key={a} className="flex justify-between"><span>{a}</span><span className="tabular">{b}</span></div>
              ))}
              <div className="my-2 border-t border-dashed border-border" />
              <div className="flex justify-between font-bold"><span>TOTAL</span><span className="tabular">750.00</span></div>
              <p className="mt-1 text-muted-foreground">14/09/26 · UPI ✓</p>
            </div>
          </div>

          {/* Extracted */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${phase === "scan" ? "animate-pulse bg-warning" : "bg-primary"}`} />
                {phase === "scan" ? "Reading receipt…" : "Read — waiting for your confirmation"}
              </span>
              <button onClick={() => setPhase("scan")} disabled={phase === "scan"} className="text-xs font-semibold text-primary hover:underline disabled:opacity-40">Replay</button>
            </div>
            <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {FIELDS.map(([k, v], i) => (
                <div key={k} className="flex items-center justify-between px-3 py-2 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  {i < shown ? <dd className="animate-fade font-semibold tabular">{v}</dd> : <dd className="skeleton h-3 w-20" />}
                </div>
              ))}
            </dl>
            <div className={`mt-2 flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs transition-opacity duration-500 ${phase === "done" ? "opacity-100" : "opacity-0"}`}>
              <span className="rounded-full bg-lime px-2 py-0.5 font-bold text-lime-foreground">Stationery</span>
              <span className="text-muted-foreground">suggested category</span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-6">
          <div className="relative flex justify-between">
            <div className="absolute left-2 right-2 top-[7px] h-0.5 bg-border" aria-hidden />
            <div className="absolute left-2 top-[7px] h-0.5 bg-primary" style={{ width: "calc(66% - 8px)" }} aria-hidden />
            {STAGES.map((s, i) => (
              <div key={s} className="relative flex flex-col items-center gap-1.5">
                <span className={`h-4 w-4 rounded-full border-2 ${i < 3 ? "border-primary bg-primary" : "border-border bg-card"}`} />
                <span className={`text-[11px] font-semibold ${i < 3 ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Settlement */}
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-primary-foreground tabular">
          <div><p className="text-[10px] uppercase tracking-wider opacity-60">Approved</p><p className="font-bold">₹2,650</p></div>
          <span className="opacity-50">−</span>
          <div><p className="text-[10px] uppercase tracking-wider opacity-60">Advance</p><p className="font-bold">₹2,000</p></div>
          <span className="opacity-50">=</span>
          <div className="text-right"><p className="text-[10px] uppercase tracking-wider opacity-60">To student</p><p className="text-lg font-bold">₹650</p></div>
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
            <h1 className="mt-6 font-display text-5xl leading-[1.02] text-primary md:text-7xl">
              College reimbursements, <em className="italic">clearly</em> managed.
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
