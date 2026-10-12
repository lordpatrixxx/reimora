import { supabase } from "@/integrations/supabase/client";
import { btn } from "./ui-bits";

/** Shown only while the session and permissions are actually resolving. */
export function BootScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-background" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <svg width="64" height="76" viewBox="0 0 64 76" aria-hidden className="text-primary">
          <path className="boot-outline" d="M8 4h48v66l-8-5-8 5-8-5-8 5-8-5-8 5z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
          <g className="motion-reduce:hidden">
            <rect className="boot-scan" x="10" y="12" width="44" height="3" rx="1.5" fill="var(--lime)" />
          </g>
          <g className="boot-check" style={{ transformOrigin: "32px 36px" }}>
            <circle cx="32" cy="36" r="12" fill="var(--lime)" />
            <path d="M26 36l4 4 8-8" fill="none" stroke="var(--lime-foreground)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
        <p className="boot-word text-xl font-bold tracking-tight text-primary">Reimora</p>
        <p className="text-xs text-muted-foreground">Restoring your session…</p>
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
