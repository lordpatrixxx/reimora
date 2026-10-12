import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { StatusBadge, btn } from "@/components/app/ui-bits";
import { formatINR, netSettlement } from "@/lib/money";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Explore the demo — CampusSettle" },
      { name: "description", content: "Walk through fictional reimbursement scenarios: receipts, UPI screenshots, duplicates, partial approvals and advances." },
      { property: "og:title", content: "Explore the demo — CampusSettle" },
      { property: "og:description", content: "Fictional scenarios showing how CampusSettle handles receipts, approvals and settlement." },
    ],
  }),
  component: Demo,
});

type Doc = { kind: "Receipt" | "UPI screenshot"; vendor: string; lines: [string, number][]; total: number; meta: string };
type Scenario = {
  id: string; title: string; student: string; status: string; settlement: string; docs: Doc[];
  extracted: { vendor: string | null; amount: number | null; category: string | null; why: string };
  flag?: { sev: string; text: string }; claimed: number; approved: number | null; advance: number; note?: string; lesson: string;
};

const S: Scenario[] = [
  { id: "a", title: "Workshop stationery", student: "Aarav Demo · DEMO001", status: "approved", settlement: "settled",
    docs: [{ kind: "Receipt", vendor: "Sample Stationers", lines: [["Notebooks ×6", 360], ["Pens ×12", 120]], total: 480, meta: "INV-1001 · PAID" }],
    extracted: { vendor: "Sample Stationers", amount: 480, category: "Stationery", why: "Receipt lists notebooks and pens." }, claimed: 480, approved: 480, advance: 0,
    lesson: "A clean receipt: AI fills the fields, the student confirms, faculty approves in full." },
  { id: "b", title: "Club snacks (receipt + UPI)", student: "Meera Demo · DEMO002", status: "approved", settlement: "pending",
    docs: [
      { kind: "Receipt", vendor: "Demo Café", lines: [["Sandwich ×8", 640], ["Tea ×8", 160]], total: 800, meta: "Bill 77 · 12 Sep" },
      { kind: "UPI screenshot", vendor: "Demo Café", lines: [["Paid to DEMOCAFE@upi", 800]], total: 800, meta: "UPI ref 4410 · SUCCESS" }],
    extracted: { vendor: "Demo Café", amount: 800, category: "Refreshment", why: "Receipt items are food and drinks from a café." }, claimed: 800, approved: 800, advance: 0,
    lesson: "Receipt and its payment screenshot are two attachments on ONE expense — counted once, ₹800, not ₹1,600." },
  { id: "c", title: "Payment to an individual", student: "Rohan Demo · DEMO003", status: "submitted", settlement: "not_applicable",
    docs: [{ kind: "UPI screenshot", vendor: "R. Sample", lines: [["Paid to rsample@upi", 1500]], total: 1500, meta: "No note · SUCCESS" }],
    extracted: { vendor: "R. Sample", amount: 1500, category: null, why: "A person's name alone does not reveal the purpose; category left for the student to choose." }, claimed: 1500, approved: null, advance: 0,
    lesson: "Ambiguous evidence: AI refuses to guess (no 'Rent' from a name). The student selects the category manually." },
  { id: "d", title: "Printing — possible duplicate", student: "Aarav Demo · DEMO001", status: "under_review", settlement: "not_applicable",
    docs: [{ kind: "Receipt", vendor: "Demo Print Hub", lines: [["A3 posters ×10", 600]], total: 600, meta: "INV-552 · 03 Sep" }],
    extracted: { vendor: "Demo Print Hub", amount: 600, category: "Printing", why: "Receipt lists poster printing." },
    flag: { sev: "possible", text: "Another submitted expense has the same vendor and invoice number. Faculty documents a resolution before deciding." }, claimed: 600, approved: null, advance: 0,
    lesson: "Possible matches are explained without revealing anyone else's records." },
  { id: "e", title: "Event décor — partial approval", student: "Meera Demo · DEMO002", status: "approved", settlement: "pending",
    docs: [{ kind: "Receipt", vendor: "Sample Crafts", lines: [["Chart paper", 300], ["Fairy lights", 900]], total: 1200, meta: "INV-88" }],
    extracted: { vendor: "Sample Crafts", amount: 1200, category: "Design Material", why: "Items are craft and décor supplies." }, claimed: 1200, approved: 900, advance: 0,
    note: "Lights capped at ₹600 per event (reason recorded).", lesson: "Faculty can approve less than claimed — never more — and must give a reason." },
  { id: "f", title: "Tech fest stall — advance, pay out", student: "Rohan Demo · DEMO003", status: "approved", settlement: "partially_settled",
    docs: [{ kind: "Receipt", vendor: "Demo Electronics", lines: [["Breadboards ×5", 1250], ["Sensors kit", 1400]], total: 2650, meta: "INV-310" }],
    extracted: { vendor: "Demo Electronics", amount: 2650, category: "Equipment", why: "Receipt lists electronic components." }, claimed: 2650, approved: 2650, advance: 2000,
    lesson: "Approved ₹2,650 − advance ₹2,000 = ₹650 payable to the student. Partial payments are tracked until settled." },
  { id: "g", title: "Field trip — advance, money back", student: "Aarav Demo · DEMO001", status: "approved", settlement: "pending",
    docs: [{ kind: "Receipt", vendor: "Sample Travels", lines: [["Bus hire", 1700]], total: 1700, meta: "INV-12" }],
    extracted: { vendor: "Sample Travels", amount: 1700, category: "Travel", why: "Receipt is for bus hire." }, claimed: 1700, approved: 1700, advance: 2000,
    lesson: "Approved ₹1,700 − advance ₹2,000 = ₹300 returnable by the student." },
];

function Demo() {
  const [sel, setSel] = useState(S[0].id);
  const s = S.find((x) => x.id === sel)!;
  const net = s.approved != null ? netSettlement(s.approved * 100, s.advance * 100) : null;
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-warning">Demo · all data fictional · no emails sent</span>
            <h1 className="mt-4 font-display text-5xl text-primary">Seven scenarios, one calm flow.</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">Pick a scenario. Nothing here touches real records.</p>
          </div>
          <Link to="/auth" className={btn.primary}>Get started</Link>
        </div>
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <ul className="space-y-1.5">
            {S.map((x) => (
              <li key={x.id}>
                <button onClick={() => setSel(x.id)} className={cn("w-full rounded-xl px-4 py-3 text-left text-sm transition", sel === x.id ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
                  <p className="font-semibold">{x.title}</p>
                  <p className={cn("text-xs", sel === x.id ? "opacity-70" : "text-muted-foreground")}>{x.student}</p>
                </button>
              </li>
            ))}
          </ul>
          <div key={s.id} className="animate-rise space-y-4">
            <div className="rounded-2xl bg-lime/40 p-4 text-sm text-lime-foreground"><b>What this shows:</b> {s.lesson}</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                {s.docs.map((d, i) => (
                  <div key={i} className="rounded-2xl border border-dashed border-border bg-card p-4 font-mono text-xs shadow-soft">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{d.kind} · sample</p>
                    <p className="text-center font-bold">{d.vendor.toUpperCase()}</p>
                    <div className="my-2 border-t border-dashed border-border" />
                    {d.lines.map(([l, v]) => <div key={l} className="flex justify-between"><span>{l}</span><span className="tabular">{v}.00</span></div>)}
                    <div className="my-2 border-t border-dashed border-border" />
                    <div className="flex justify-between font-bold"><span>TOTAL</span><span>{d.total}.00</span></div>
                    <p className="mt-1 text-muted-foreground">{d.meta}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-primary">Extracted (sample, not live AI)</p><StatusBadge status={s.status} /></div>
                  {[["Vendor", s.extracted.vendor], ["Amount", s.extracted.amount != null ? formatINR(s.extracted.amount * 100) : null]].map(([k, v]) => (
                    <div key={k} className="mb-2 flex justify-between rounded-lg border border-border px-3 py-2 text-sm"><span className="text-muted-foreground">{k}</span><b className="tabular">{v ?? "—"}</b></div>
                  ))}
                  <div className={cn("rounded-lg p-3 text-sm", s.extracted.category ? "bg-accent" : "bg-warning-soft")}>
                    <b>{s.extracted.category ?? "Needs manual category"}</b>
                    <p className="text-xs text-muted-foreground">{s.extracted.why}</p>
                  </div>
                  {s.flag && <div className="mt-2 rounded-lg bg-warning-soft p-3 text-xs"><StatusBadge status={s.flag.sev} /> <span className="ml-1">{s.flag.text}</span></div>}
                </div>
                <div className="rounded-2xl bg-primary p-4 text-sm text-primary-foreground tabular">
                  <div className="flex justify-between"><span>Claimed</span><span>{formatINR(s.claimed * 100)}</span></div>
                  <div className="flex justify-between"><span>Approved</span><span>{s.approved != null ? formatINR(s.approved * 100) : "In review"}</span></div>
                  {s.note && <p className="text-xs opacity-70">{s.note}</p>}
                  <div className="flex justify-between"><span>Advance applied</span><span>− {formatINR(s.advance * 100)}</span></div>
                  {net && <div className="mt-2 flex justify-between border-t border-primary-foreground/20 pt-2 font-bold">
                    <span>{net.kind === "payable" ? "Payable to student" : net.kind === "returnable" ? "Returnable by student" : "Net"}</span>
                    <span className="text-lime">{formatINR(net.amount)}</span></div>}
                  <div className="mt-2"><StatusBadge status={s.settlement} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
