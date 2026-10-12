import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/site-chrome";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROLE_PREF_KEY } from "@/components/app/access-gate";
import { btn, inputCls, errMsg } from "@/components/app/ui-bits";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Reimora" },
      { name: "description", content: "Sign in to submit, review and settle college reimbursements." },
      { property: "og:title", content: "Sign in — Reimora" },
      { property: "og:description", content: "Sign in to Reimora with Google." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

async function homeFor() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "/dashboard";
  const { data: admin } = await supabase.rpc("is_admin", { _uid: data.user.id });
  return admin ? "/admin" : "/dashboard";
}

function AuthPage() {
  const nav = useNavigate();
  const [showEmail, setShowEmail] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [gBusy, setGBusy] = useState(false);
  const [pref, setPref] = useState<"student" | "faculty" | "">("");

  const go = async () => nav({ to: await homeFor(), replace: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) go(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rememberPref() {
    if (pref) sessionStorage.setItem(ROLE_PREF_KEY, pref);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    rememberPref();
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth", data: { full_name: name } } });
        if (error) throw error;
        if (!data.session) toast.success("Check your inbox to confirm your email, then sign in.");
        else await go();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await go();
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setGBusy(true);
    rememberPref();
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    setGBusy(false);
    if (r.error) toast.error(errMsg(r.error));
    else if (!r.redirected) await go();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between gap-10 p-6 sm:p-8">
        <div className="flex items-center justify-between"><Logo /><ThemeToggle /></div>
        <div className="mx-auto w-full max-w-sm animate-rise">
          <h1 className="font-display text-4xl text-primary sm:text-5xl">Sign in to Reimora</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Signing in confirms who you are. New users then request access — an administrator approves every student and approver account.
          </p>

          <button onClick={google} disabled={gBusy} className={btn.primary + " mt-8 w-full py-3"}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14zM12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 5.9 12 5.9z" /></svg>
            {gBusy ? "Opening Google…" : "Continue with Google"}
          </button>

          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">New here? I plan to use Reimora as <span className="font-normal">(optional — you'll confirm after signing in)</span></p>
            <div className="grid grid-cols-2 gap-2">
              {([["student", "Student"], ["faculty", "Faculty / Club Approver"]] as const).map(([v, l]) => (
                <button type="button" key={v} onClick={() => setPref(pref === v ? "" : v)} aria-pressed={pref === v}
                  className={"rounded-xl border px-3 py-2 text-xs font-semibold transition " + (pref === v ? "border-primary bg-accent text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted")}>{l}</button>
              ))}
            </div>
          </div>

          {!showEmail ? (
            <button onClick={() => setShowEmail(true)} className="mt-6 text-sm font-semibold text-muted-foreground hover:text-primary">Use email and password instead</button>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-3 animate-fade">
              {mode === "up" && <input required className={inputCls} placeholder="Full name" aria-label="Full name" value={name} onChange={(e) => setName(e.target.value)} />}
              <input required type="email" className={inputCls} placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input required type="password" minLength={8} className={inputCls} placeholder="Password (8+ characters)" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button disabled={busy} className={btn.ghost + " w-full"}>{busy ? "Please wait…" : mode === "in" ? "Sign in with email" : "Create account"}</button>
              <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="text-xs font-semibold text-primary hover:underline">
                {mode === "in" ? "No account? Create one" : "Already have an account? Sign in"}
              </button>
            </form>
          )}
        </div>
        <p className="text-xs text-muted-foreground">A student project · not an official institutional system.</p>
      </div>
      <div className="hidden items-center justify-center bg-primary p-12 lg:flex">
        <div className="max-w-md text-primary-foreground">
          <span className="block h-1.5 w-12 rounded-full bg-lime" />
          <p className="mt-6 font-display text-5xl leading-tight">Every rupee, accounted for.</p>
          <ol className="mt-8 space-y-3 text-sm opacity-80">
            <li>1 · Sign in with your college Google account</li>
            <li>2 · Request Student or Approver access</li>
            <li>3 · Submit, review and settle claims once approved</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
