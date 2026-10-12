import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { kickEmails } from "@/lib/kick-emails";
import {
  LayoutDashboard, FilePlus2, Files, ClipboardCheck, Users, Wallet, BarChart3, Bell, Settings, Info, LogOut, Menu, X, Search,
  ShieldCheck, UserCheck, Network, ScrollText, Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, roleLabel, type Me } from "@/hooks/use-auth";
import { Logo } from "@/components/site-chrome";
import { BootScreen, BootError } from "./boot";
import { AccessGate } from "./access-gate";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; badge?: "unread" | "requests" };
type Section = { title: string; items: NavItem[]; show: (m: Me) => boolean };

const sections: Section[] = [
  { title: "Administration", show: (m) => m.isSuperAdmin, items: [
    { to: "/admin", label: "Admin overview", icon: ShieldCheck },
    { to: "/admin/requests", label: "Access requests", icon: UserCheck, badge: "requests" },
    { to: "/admin/users", label: "Users & roles", icon: Users },
    { to: "/admin/scopes", label: "Approver scopes", icon: Network },
    { to: "/admin/email", label: "Email delivery", icon: Mail },
    { to: "/admin/audit", label: "Audit log", icon: ScrollText },
  ] },
  { title: "Reimbursement claims", show: () => true, items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/claims/new", label: "New claim", icon: FilePlus2 },
    { to: "/claims", label: "Claims", icon: Files },
  ] },
  { title: "Approvals", show: (m) => m.isFaculty, items: [{ to: "/review", label: "Claims to review", icon: ClipboardCheck }] },
  { title: "Finance", show: (m) => m.isFinance || m.isStudent, items: [{ to: "/settlements", label: "Advances & settlements", icon: Wallet }] },
  { title: "Records", show: (m) => m.isStaff, items: [
    { to: "/students", label: "Students", icon: Users },
    { to: "/reports", label: "Reports", icon: BarChart3 },
  ] },
  { title: "You", show: () => true, items: [
    { to: "/notifications", label: "Notifications", icon: Bell, badge: "unread" },
    { to: "/settings", label: "Profile & settings", icon: Settings },
  ] },
];

const hideFor = (m: Me, to: string) => to === "/claims/new" && !(m.isFinance || m.student);

export function AppShell() {
  const { data: me, isLoading, error, refetch } = useMe();
  // Once per browser session: send anything queued for this account (e.g. the welcome email after first sign-in).
  useEffect(() => {
    if (!me || sessionStorage.getItem("reimora-kick")) return;
    sessionStorage.setItem("reimora-kick", "1");
    kickEmails();
  }, [me]);
  if (isLoading) return <BootScreen />;
  if (error) return <BootError error={error} retry={() => refetch()} />;
  if (!me) return <BootError error={{ message: "Session expired" }} retry={() => (window.location.href = "/auth")} />;
  if (!me.hasAccess) return <AccessGate me={me} />;
  return <Shell me={me} />;
}

function Shell({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: unread = 0 } = useQuery({
    queryKey: ["unread", me.user.id],
    queryFn: async () => (await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_user", me.user.id).is("read_at", null)).count ?? 0,
  });
  const { data: pendingReq = 0 } = useQuery({
    queryKey: ["pending-requests"],
    enabled: me.isSuperAdmin,
    queryFn: async () => (await supabase.from("access_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING")).count ?? 0,
  });

  const visible = sections.filter((s) => s.show(me)).map((s) => ({ ...s, items: s.items.filter((i) => !hideFor(me, i.to)) }));
  const all = visible.flatMap((s) => s.items);
  const current = [...all].sort((a, b) => b.to.length - a.to.length).find((n) => path === n.to || path.startsWith(n.to + "/"));

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5"><Logo />
        <button className="lg:hidden rounded-full p-1.5 hover:bg-muted" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {visible.map((s) => (
          <div key={s.title}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">{s.title}</p>
            <div className="space-y-0.5">
              {s.items.map((n) => {
                const active = current?.to === n.to;
                const count = n.badge === "unread" ? unread : n.badge === "requests" ? pendingReq : 0;
                return (
                  <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
                    className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <n.icon className="h-4 w-4" strokeWidth={1.75} />
                    <span className="flex-1">{n.label}</span>
                    {count > 0 && <span className="rounded-full bg-lime px-1.5 text-[10px] font-bold text-lime-foreground tabular">{count}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        <Link to="/about" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
          <Info className="h-4 w-4" strokeWidth={1.75} /> About
        </Link>
      </nav>
      <div className="m-3 rounded-xl border border-border bg-background p-3">
        <p className="truncate text-sm font-semibold">{me.profile?.full_name ?? me.user.email}</p>
        <p className="truncate text-xs text-muted-foreground">{me.roles.map((r) => roleLabel[r]).join(" · ")}</p>
        <button onClick={signOut} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-border bg-card lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30 animate-fade" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-card shadow-float animate-rise">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
          <button className="lg:hidden rounded-full p-1.5 hover:bg-muted" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <span className="truncate text-sm font-semibold text-primary">{current?.label ?? "Reimora"}</span>
          <form className="ml-auto hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 md:flex"
            onSubmit={(e) => { e.preventDefault(); navigate({ to: "/claims", search: { q } }); }}>
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search claims" aria-label="Search claims" className="w-48 bg-transparent text-sm outline-none" />
          </form>
          <Link to="/notifications" className="relative ml-auto rounded-full p-2 hover:bg-muted md:ml-0" aria-label="Notifications">
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-lime ring-2 ring-background" />}
          </Link>
          <ThemeToggle />
          <Link to="/settings" aria-label="Profile" className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {(me.profile?.full_name ?? me.user.email ?? "?").charAt(0).toUpperCase()}
          </Link>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
