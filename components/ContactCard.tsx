import { CONTACT_LINKS } from "@/lib/contact-links";

export function ContactCard() {
  return (
    <section
      aria-labelledby="contact-card-title"
      className="mt-7 w-full rounded-3xl border border-slate-700/80 bg-slate-900/75 p-4 shadow-[0_12px_34px_rgba(0,0,0,0.2)] backdrop-blur sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-400/80">
            Stay connected
          </p>
          <h2 id="contact-card-title" className="mt-1 text-xl font-extrabold text-white">
            Contact Me
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Find me on your favorite platform.
          </p>
        </div>
        <div
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-400/10 text-xl text-yellow-300"
        >
          ↗
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CONTACT_LINKS.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${link.name}: ${link.description} (opens in a new tab)`}
            className={`group flex min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${link.className}`}
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950/40 text-[11px] font-black tracking-wide"
            >
              {link.shortLabel}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-white">{link.name}</span>
              <span className="mt-0.5 block truncate text-[10px] leading-4 opacity-75">
                {link.description}
              </span>
            </span>
            <span aria-hidden="true" className="ml-auto hidden text-xs opacity-60 sm:inline">
              ↗
            </span>
          </a>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/70 pt-3">
        <p className="text-xs text-slate-400">All links in one text file.</p>
        <a
          href="./contact-links.txt"
          download="contact-links.txt"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-100 transition hover:border-yellow-400/50 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
        >
          <span aria-hidden="true">↓</span>
          Download links (.txt)
        </a>
      </div>
    </section>
  );
}
