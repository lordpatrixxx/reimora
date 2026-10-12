import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const THEME_KEY = "reimora-theme";

/** Inline script run before paint: stored choice, else device preference. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var d=document.documentElement;d.classList.toggle('dark',t==='dark');d.style.colorScheme=t}catch(e){}})();`;

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  const toggle = () => {
    const next = !dark;
    const root = document.documentElement;
    root.classList.add("theme-transition");
    root.classList.toggle("dark", next);
    root.style.colorScheme = next ? "dark" : "light";
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch { /* ignore */ }
    setDark(next);
    window.setTimeout(() => root.classList.remove("theme-transition"), 350);
  };

  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Sun className={cn("absolute h-4 w-4 transition-all duration-300", dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0")} strokeWidth={1.75} />
      <Moon className={cn("absolute h-4 w-4 transition-all duration-300", dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100")} strokeWidth={1.75} />
    </button>
  );
}
