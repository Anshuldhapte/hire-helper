// The start page: two big doors, one for shops that want staff and one for people who want work.
import Link from "next/link";
import { Logo } from "./ui";

const DOORS = [
  {
    href: "/hire",
    emoji: "🏪",
    title: "I want to hire",
    local: "मला कामगार हवा · मुझे स्टाफ चाहिए",
    steps: ["Describe the job in one line", "See the 3 best workers, with proof", "Invite them on WhatsApp for tomorrow"],
    cta: "Find workers",
  },
  {
    href: "/work",
    emoji: "🙋",
    title: "I want work",
    local: "मला काम हवे · मुझे काम चाहिए",
    steps: ["Answer a few easy questions", "Tell us what you can do and where you worked", "Shops message you on WhatsApp"],
    cta: "Find work",
  },
];

export default function Start() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-brand-100 bg-white/70 px-4 pb-6 pt-6">
        <div className="mx-auto max-w-[480px]">
          <div className="flex items-start justify-between gap-3">
            <Logo />
            <span className="mt-2 rounded-full bg-go-50 px-3 py-1 text-center text-xs font-semibold leading-snug text-go-700 ring-1 ring-go-100">
              एक रुपया फीस नहीं · No fee for workers
            </span>
          </div>
          <p className="mt-3 text-[18px] font-semibold leading-snug">स्टाफ पक्का, काम पक्का</p>
          <p className="text-sm text-muted">Trusted staff. Confirmed jobs.</p>
          <p className="mt-3 text-base font-medium text-brand-700">A shortlist of 3 trusted workers, not 40 random calls.</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-4 py-6">
        <h1 className="text-xl font-bold">What do you want to do?</h1>
        {DOORS.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className="rise-in group block rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(20,43,110,0.08)] ring-1 ring-brand-100 transition hover:ring-brand-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
          >
            <div className="flex items-center gap-3">
              <span className="text-4xl" aria-hidden>
                {d.emoji}
              </span>
              <div>
                <h2 className="text-2xl font-bold leading-tight">{d.title}</h2>
                <p className="text-base font-semibold text-muted">{d.local}</p>
              </div>
            </div>
            <ol className="mt-4 flex flex-col gap-2">
              {d.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-base">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marigold-400 text-sm font-bold text-ink">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <span className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-brand-600 text-base font-semibold text-white group-hover:bg-brand-700">
              {d.cta} →
            </span>
          </Link>
        ))}
      </main>

      <footer className="mt-auto bg-brand-900 px-4 py-4 text-center text-sm font-medium text-white">
        Pay only when a worker joins · Free replacement within 30 days · Workers never pay a fee
      </footer>
    </div>
  );
}
