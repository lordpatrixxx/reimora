import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/site-chrome";
import { ThemeToggle } from "@/components/theme-toggle";
import { btn, inputCls, errMsg } from "@/components/app/ui-bits";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Reimora" },
      { name: "description", content: "Sign in to submit, review and settle college reimbursements." },
      { property: "og:title", content: "Sign in — Reimora" },
      { property: "og:description", content: "Sign in to Reimora." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<"student" | "faculty" | "finance">("student");
  const isCollege = email.toLowerCase().endsWith("@pccoepune.org");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/dashboard" });
    });
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name, requested_role: role } },
        });
        if (error) throw error;
        if (!data.session) toast.success("Check your inbox to confirm your email, then sign in.");
        else nav({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(errMsg(r.error));
    else if (!r.redirected) nav({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8">
        <div className="flex items-center justify-between"><Logo /><ThemeToggle /></div>
        <div className="mx-auto w-full max-w-sm animate-rise">
          <h1 className="font-display text-4xl text-primary">{mode === "in" ? "Welcome back." : "Create your account."}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "in" ? "Sign in to track and settle claims." : "Students submit bills. Reviewers check bills and approve them. Finance records payments."}
          </p>
          <button onClick={google} className={btn.ghost + " mt-6 w-full py-2.5"}>Continue with Google</button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "up" && <input required className={inputCls} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />}
            <input required type="email" className={inputCls} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {isCollege && <p className="rounded-lg bg-accent px-3 py-2 text-xs text-primary">College detected: <b>Pimpri Chinchwad College of Engineering, Pune</b></p>}
            {mode === "up" && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">I am joining as</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {([["student", "Student"], ["faculty", "Bill reviewer"], ["finance", "Finance"]] as const).map(([v, l]) => (
                    <button type="button" key={v} onClick={() => setRole(v)}
                      className={"rounded-lg border px-2 py-2 text-xs font-semibold transition " + (role === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted")}>{l}</button>
                  ))}
                </div>
                {role !== "student" && <p className="mt-1.5 text-xs text-muted-foreground">Reviewer and finance access is granted after an existing finance admin approves your request.</p>}
              </div>
            )}
            <input required type="password" minLength={8} className={inputCls} placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button disabled={busy} className={btn.primary + " w-full"}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</button>
          </form>
          <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 text-sm font-semibold text-primary hover:underline">
            {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">A student project · not an official institutional system.</p>
      </div>
      <div className="hidden items-center justify-center bg-primary p-12 lg:flex">
        <div className="max-w-md text-primary-foreground">
          <span className="block h-1.5 w-12 rounded-full bg-lime" />
          <p className="mt-6 font-display text-5xl leading-tight">Every rupee, accounted for.</p>
          <p className="mt-4 opacity-70">Receipts scanned, approvals recorded, advances reconciled — with a human confirming every step.</p>
        </div>
      </div>
    </div>
  );
}
