import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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

function HeroPreview() {
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(true);
  const rescan = () => {
    setDone(false);
    setScanning(true);
    setTimeout(() => { setScanning(false); setDone(true); }, 2200);
  };
  return (
    <div className="relative animate-rise rounded-3xl border border-border bg-card p-4 shadow-float md:p-5" style={{ animationDelay: "120ms" }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Claim CS-0142 · Robotics club supplies</span>
        <SampleTag />
      </div>
      <div className="grid gap-4 sm:grid-cols-[0.9fr_1.1fr]">
        {/* receipt */}
        <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-muted p-4 font-mono text-[11px] leading-relaxed text-foreground/80">
          {scanning && <div className="scan-line" />}
          <p className="text-center font-bold">SHREE STATIONERS</p>
          <p className="text-center text-muted-foreground">Akurdi, Pune · INV-2291</p>
          <div className="my-2 border-t border-dashed border-border" />
          {[["Notebooks ×6", 360], ["Chart paper ×10", 150], ["Markers set", 240]].map(([a, b]) => (
            <div key={a as string} className="flex justify-between"><span>{a}</span><span className="tabular">{b}.00</span></div>
          ))}
          <div className="my-2 border-t border-dashed border-border" />
          <div className="flex justify-between font-bold"><span>TOTAL</span><span className="tabular">750.00</span></div>
          <p className="mt-2 text-muted-foreground">14/09/2026 · PAID UPI</p>
        </div>
        {/* extracted */}
        <div className="space-y-2.5">
          <div className={`space-y-2.5 transition-opacity duration-300 ${done ? "opacity-100" : "opacity-30"}`}>
            {[["Vendor", "Shree Stationers"], ["Amount", inr(750)], ["Date", "14 Sep 2026"]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="text-muted-foreground">{k}</span><span className="font-semibold tabular">{v}</span>
              </div>
            ))}
            <div className="rounded-lg bg-accent px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Suggested</span>
                <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-bold text-lime-foreground">Stationery</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Items list notebooks, chart paper and markers.</p>
            </div>
          </div>
          <button onClick={rescan} disabled={scanning} className="w-full rounded-lg border border-border py-2 text-xs font-semibold text-primary transition hover:bg-muted disabled:opacity-60">
            {scanning ? "Reading receipt…" : "Replay scan"}
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Approval</p>
          <ol className="space-y-1.5 text-xs">
            {[["Submitted", true], ["Faculty review", true], ["Approved", true], ["Settled", false]].map(([s, ok]) => (
              <li key={s as string} className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${ok ? "bg-primary" : "border border-border bg-card"}`} />
                <span className={ok ? "" : "text-muted-foreground"}>{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-xl bg-primary p-3 text-primary-foreground">
          <p className="mb-2 text-xs font-semibold opacity-70">Settlement</p>
          <div className="space-y-1 text-xs tabular">
            <div className="flex justify-between"><span>Approved</span><span>{inr(2650)}</span></div>
            <div className="flex justify-between"><span>Advance applied</span><span>− {inr(2000)}</span></div>
            <div className="mt-1 flex justify-between border-t border-primary-foreground/20 pt-1 text-sm font-bold">
              <span>Payable to student</span><span className="text-lime">{inr(650)}</span>
            </div>
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
