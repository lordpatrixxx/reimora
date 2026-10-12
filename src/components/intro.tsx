// First-visit full-page intro. Decided pre-paint so the page never flashes before it.
export const introInitScript = `(function(){try{var k='reimora-intro-v1';if(localStorage.getItem(k))return;if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){localStorage.setItem(k,'1');return;}var d=document.documentElement;d.classList.add('intro');localStorage.setItem(k,'1');setTimeout(function(){d.classList.remove('intro');d.classList.add('intro-done');},1600);}catch(e){}})();`;

export function IntroOverlay() {
  const word = "Reimora";
  return (
    <div className="intro-overlay" aria-hidden>
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-16 w-12">
          <svg viewBox="0 0 48 64" className="intro-mark h-16 w-12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="42" height="58" rx="6" />
            <path className="tick" d="M15 33l7 7 12-14" stroke="var(--lime)" strokeWidth="3.5" />
          </svg>
          <span className="intro-beam" />
        </div>
        <p className="intro-word font-display text-5xl md:text-6xl">
          {word.split("").map((c, i) => <span key={i} style={{ animationDelay: `${300 + i * 45}ms` }}>{c}</span>)}
        </p>
        <span className="intro-line block h-0.5 w-24 rounded-full bg-lime" />
      </div>
    </div>
  );
}
