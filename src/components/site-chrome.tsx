import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary">
        <span className="h-3 w-3 rounded-sm bg-lime" />
      </span>
      <span className="text-[17px] font-bold tracking-tight text-primary">CampusSettle</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <a href="/#how" className="hover:text-foreground">How it works</a>
          <a href="/#features" className="hover:text-foreground">Features</a>
          <Link to="/demo" className="hover:text-foreground">Demo</Link>
          <Link to="/about" className="hover:text-foreground">About</Link>
        </nav>
        <Link to="/auth" className="rounded-full border border-primary/20 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-70">Sign in</Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 text-sm text-muted-foreground md:grid-cols-[1fr_auto]">
        <div>
          <Logo />
          <p className="mt-3 max-w-md">
            A student project by Pratik Deepak Phapale (IT, SE, Div B), PCCoE Pune. Not an official
            institutional system.
          </p>
        </div>
        <div className="flex gap-6 self-end">
          <Link to="/about" className="hover:text-foreground">About the project</Link>
        </div>
      </div>
    </footer>
  );
}
