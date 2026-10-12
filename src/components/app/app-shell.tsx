import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  LayoutDashboard, FilePlus2, Files, ClipboardCheck, Users, Wallet, BarChart3, Bell, Settings, Info, LogOut, Menu, X, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { Logo } from "@/components/site-chrome";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; show?: (m: NonNullable<ReturnType<typeof useMe>["data"]>) => boolean };
const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/claims/new", label: "New claim", icon: FilePlus2, show: (m) => m.isFinance || !!m.student },
  { to: "/claims", label: "Claims", icon: Files },
  { to: "/review", label: "Bills to review", icon: ClipboardCheck, show: (m) => m.isFaculty },
  { to: "/students", label: "Students", icon: Users, show: (m) => m.isStaff },
  { to: "/settlements", label: "Advances & settlements", icon: Wallet, show: (m) => m.isFinance || m.isStudent },
  { to: "/reports", label: "Reports", icon: BarChart3, show: (m) => m.isStaff },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/settings", label: "Profile & settings", icon: Settings },
];

export function AppShell() {
  const { data: me, isLoading } = useMe();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const { data: unread = 0 } = useQuery({
    queryKey: ["unread", me?.user.id],
    enabled: !!me,
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_user", me!.user.id).is("read_at", null);
      return count ?? 0;
    },
  });

  if (isLoading) return <Splash />;
  const items = me ? nav.filter((n) => !n.show || n.show(me)) : [];
  const current = [...nav].sort((a, b) => b.to.length - a.to.length).find((n) => path.startsWith(n.to));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5"><Logo /></div>
      <nav className="flex-1 space-y-0.5 px-3">
        {items.map((n) => {
          const active = current?.to === n.to;
          return (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <n.icon className="h-4 w-4" strokeWidth={1.75} />
              <span className="flex-1">{n.label}</span>
              {n.to === "/notifications" && unread > 0 && (
                <span className="rounded-full bg-lime px-1.5 text-[10px] font-bold text-lime-foreground tabular">{unread}</span>
              )}
            </Link>
          );
        })}
        <Link to="/about" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
          <Info className="h-4 w-4" strokeWidth={1.75} /> About
        </Link>
      </nav>
      {me && (
        <div className="m-3 rounded-xl border border-border bg-background p-3">
          <p className="truncate text-sm font-semibold">{me.profile?.full_name ?? me.user.email}</p>
          <p className="text-xs capitalize text-muted-foreground">{me.roles.join(" · ")}</p>
          <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}
            className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-border bg-card lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-rise bg-card shadow-float">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <span className="text-sm font-semibold text-primary">{current?.label ?? "Reimora"}</span>
          <form className="ml-auto hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 md:flex"
            onSubmit={(e) => { e.preventDefault(); navigate({ to: "/claims", search: { q } }); }}>
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search claims" className="w-48 bg-transparent text-sm outline-none" />
          </form>
          <Link to="/notifications" className="relative rounded-full p-2 hover:bg-muted md:ml-0 ml-auto" aria-label="Notifications">
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-lime ring-2 ring-background" />}
          </Link>
          <ThemeToggle />
          <Link to="/settings" className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {(me?.profile?.full_name ?? me?.user.email ?? "?").charAt(0).toUpperCase()}
          </Link>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-5 animate-rise">
        <div className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-primary shadow-float">
          <span className="h-5 w-5 rounded-md bg-lime" />
          <div className="scan-line" />
        </div>
        <p className="text-lg font-bold tracking-tight text-primary">Reimora</p>
        <p className="text-xs text-muted-foreground">Preparing your workspace…</p>
      </div>
    </div>
  );
}
