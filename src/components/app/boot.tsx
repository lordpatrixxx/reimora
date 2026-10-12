import { supabase } from "@/integrations/supabase/client";
import { btn } from "./ui-bits";

const WORD = "Reimora".split("");

/** Shown only while the session and permissions are actually resolving. */
export function BootScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-background" role="status" aria-live="polite">
      <div className="flex flex-col items-center">
        <div className="relative">
          <span className="absolute inset-0 rounded-2xl bg-lime/40 ring-pulse motion-reduce:hidden" aria-hidden />
          <div className="relative h-24 w-20 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-float receipt-edge" aria-hidden>
            {[70, 100, 55, 85, 40].map((w, i) => (
              <span key={i} className="line-grow mb-2 block h-1.5 rounded-full bg-muted-foreground/25" style={{ width: `${w}%`, animationDelay: `${i * 90}ms` }} />
            ))}
            <span className="line-grow mt-3 block h-2 w-3/5 rounded-full bg-primary" style={{ animationDelay: "500ms" }} />
            <span className="beam motion-reduce:hidden" />
          </div>
          <span className="boot-check absolute -bottom-2 -right-3 grid h-8 w-8 place-items-center rounded-full bg-lime shadow-soft ring-4 ring-background" style={{ animationDelay: "900ms" }} aria-hidden>
            <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M6 12l4 4 8-8" fill="none" stroke="var(--lime-foreground)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
        <p className="mt-7 flex text-2xl font-bold tracking-tight text-primary" aria-label="Reimora">
          {WORD.map((c, i) => <span key={i} className="letter-in" style={{ animationDelay: `${300 + i * 45}ms` }} aria-hidden>{c}</span>)}
        </p>
        <div className="progress-indeterminate mt-4 w-32" aria-hidden />
        <p className="mt-3 text-xs text-muted-foreground">Restoring your session…</p>
      </div>
    </div>
  );
}

export function BootError({ error, retry }: { error: unknown; retry: () => void }) {
  const msg = error && typeof error === "object" && "message" in error ? String((error as { message: string }).message) : "Unknown error";
  return (
    <div className="grid min-h-screen place-items-center bg-background px-5">
      <div className="max-w-sm text-center">
        <p className="text-xl font-bold text-primary">We couldn't load your workspace</p>
        <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again. ({msg})</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={retry} className={btn.primary}>Retry</button>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }} className={btn.ghost}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
