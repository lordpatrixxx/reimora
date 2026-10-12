import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Reimora" },
      { name: "description", content: "Reimora is a student project on reimbursement and advance settlement." },
      { property: "og:title", content: "About — Reimora" },
      { property: "og:description", content: "A student project on college reimbursement and advance settlement." },
    ],
  }),
  component: About,
});

const rows = [
  ["Student", "Pratik Deepak Phapale"],
  ["PRN", "125B1F210"],
  ["Programme", "Information Technology · Second Year · Semester III · Division B"],
  ["Institution", "Pimpri Chinchwad College of Engineering, Pune"],
  ["Faculty", "Tanuja Patankar"],
];

function About() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-20">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary/70">About</p>
        <h1 className="mt-3 font-display text-5xl leading-tight text-primary md:text-6xl">
          A student project on fair, transparent settlement.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Reimora explores how receipt scanning, human review and precise settlement math can
          make college reimbursements calmer for everyone involved.
        </p>
        <dl className="mt-12 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-6 py-4 sm:grid-cols-[160px_1fr]">
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 rounded-xl bg-warning-soft px-4 py-3 text-sm text-foreground">
          This is an academic project. It is not endorsed by, or an official system of, the institution.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
