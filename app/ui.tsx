// Small building blocks for the one screen: header logo, step bar, cards, notices and icons.
import type { ReactNode } from "react";
import type { CheckStatus } from "@/lib/schemas";

export type Message = { tone: "yellow" | "red"; text: string } | null;

export const buttonBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4";
export const primaryButton = `${buttonBase} bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:ring-brand-200`;
export const secondaryButton = `${buttonBase} border border-brand-200 bg-white text-brand-700 hover:bg-brand-50 focus-visible:ring-brand-100`;
export const whatsappButton = `${buttonBase} bg-go-600 text-white shadow-sm hover:bg-go-700 focus-visible:ring-go-100`;

// "काम" in ink, "पक्का" in red inside a tilted circle, like a clean rubber stamp.
export function Logo() {
  return (
    <div>
      <div className="flex items-center gap-2 font-display leading-none">
        <span className="text-[40px] text-ink">काम</span>
        <span className="inline-flex -rotate-[8deg] items-center justify-center rounded-full border-2 border-stamp px-3 pb-1.5 pt-2.5 text-[34px] text-stamp">
          पक्का
        </span>
      </div>
      <p className="mt-1 text-xs font-semibold tracking-[0.35em] text-muted">KAAM PAKKA</p>
    </div>
  );
}

const STEPS = ["Describe", "Add replies", "Top 3"];

// The 1-2-3 progress bar under the header. `current` is 1–3.
export function Stepper({ current, labels = STEPS }: { current: number; labels?: string[] }) {
  return (
    <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="Progress">
      {labels.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                active
                  ? "bg-brand-600 text-white ring-4 ring-brand-100"
                  : done
                    ? "bg-go-600 text-white"
                    : "bg-white text-muted ring-1 ring-slate-200"
              }`}
            >
              {done ? "✓" : step}
            </span>
            <span className={`text-sm leading-tight ${active ? "font-bold text-ink" : "text-muted"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section
      id={id}
      className={`rise-in rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(20,43,110,0.08)] ring-1 ring-brand-100 ${className}`}
    >
      {children}
    </section>
  );
}

export function StepTitle({ step, title, hint }: { step: number; title: string; hint: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marigold-400 text-base font-bold text-ink">
        {step}
      </span>
      <div>
        <h2 className="text-xl font-bold leading-tight">{title}</h2>
        <p className="mt-1 text-base text-muted">{hint}</p>
      </div>
    </div>
  );
}

export function Notice({ message }: { message: Message }) {
  if (!message) return null;
  const colours =
    message.tone === "yellow"
      ? "border-marigold-300 bg-marigold-100 text-marigold-800"
      : "border-red-200 bg-red-50 text-danger";
  return <p className={`rise-in rounded-xl border px-4 py-3 text-base font-medium ${colours}`}>{message.text}</p>;
}

export function Spinner() {
  return <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;
}

// Circular score out of 100, coloured green (strong), amber (maybe) or red (weak).
export function ScoreRing({ score }: { score: number }) {
  const colour = score >= 75 ? "#15803d" : score >= 50 ? "#d97706" : "#b42318";
  return (
    <div
      className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${colour} ${score * 3.6}deg, #e8edf5 0deg)` }}
    >
      <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-white">
        <span className="text-sm font-bold">{score}/100</span>
      </div>
    </div>
  );
}

// ✓ met = green, ✗ missed = red, ? unclear = amber.
export const STATUS_STYLE: Record<CheckStatus, { icon: string; chip: string; label: string }> = {
  met: { icon: "✓", chip: "bg-go-50 text-go-700", label: "Meets this" },
  missed: { icon: "✗", chip: "bg-red-50 text-danger", label: "Doesn't meet this" },
  unclear: { icon: "?", chip: "bg-amber-50 text-amber-800", label: "Not clear" },
};

export function ChatIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.2Z" />
    </svg>
  );
}

export function CopyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export function MicIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
