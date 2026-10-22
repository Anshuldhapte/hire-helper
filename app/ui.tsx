// Kaam Pakka's small design system: buttons, selectable cards and pills, the progress
// track, headings, notices and icons. Every page element is built from these.
import type { ReactNode } from "react";
import type { CheckStatus } from "@/lib/schemas";

export type Message = { tone: "yellow" | "red"; text: string } | null;

// ---- Buttons ----
const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4";
export const primaryButton = `${base} bg-crimson text-white hover:bg-crimson-700 focus-visible:ring-crimson-100`;
export const secondaryButton = `${base} bg-white text-ink ring-1 ring-line-strong hover:bg-canvas focus-visible:ring-crimson-100`;
export const ghostButton = `${base} px-3 text-slate hover:text-ink focus-visible:ring-crimson-100`;
export const whatsappButton = `${base} bg-go-600 text-white hover:bg-go-700 focus-visible:ring-go-100`;
export const textInput =
  "w-full rounded-xl bg-white px-4 py-3 text-base text-ink ring-1 ring-line-strong outline-none transition placeholder:text-hint focus:ring-2 focus:ring-ink disabled:bg-canvas";

// ---- Brand ----
// "काम" in ink, "पक्का" in red inside a tilted circle, like a clean rubber stamp.
export function Logo() {
  return (
    <div className="flex items-center gap-2 font-display leading-none" aria-label="Kaam Pakka">
      <span className="text-[34px] text-ink" aria-hidden>
        काम
      </span>
      <span
        className="inline-flex -rotate-[8deg] items-center justify-center rounded-full border-2 border-crimson px-2.5 pb-1 pt-2 text-[28px] text-crimson"
        aria-hidden
      >
        पक्का
      </span>
    </div>
  );
}

// ---- Headings ----
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">{children}</p>;
}

export function StepHeading({ eyebrow, title, hint }: { eyebrow: string; title: string; hint?: string }) {
  return (
    <div className="mb-6">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h2>
      {hint && <p className="mt-2 max-w-prose text-base leading-relaxed text-slate">{hint}</p>}
    </div>
  );
}

export function GroupLabel({ children, optional }: { children: ReactNode; optional?: boolean }) {
  return (
    <p className="mb-3 text-base font-bold">
      {children}
      {optional && <span className="ml-2 text-sm font-medium text-slate">Optional</span>}
    </p>
  );
}

// ---- Progress ----
// A thin track with short labels. `step` is 0-based.
export function ProgressTrack({ step, labels }: { step: number; labels: string[] }) {
  const percent = ((step + 1) / labels.length) * 100;
  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{labels[step]}</span>
        <span className="text-slate">
          Step {step + 1} of {labels.length}
        </span>
      </div>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={labels.length}
        aria-valuenow={step + 1}
        aria-label={`Step ${step + 1} of ${labels.length}: ${labels[step]}`}
      >
        <div className="h-full rounded-full bg-crimson transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <ol className="mt-3 hidden grid-cols-5 gap-2 text-xs text-slate sm:grid">
        {labels.map((l, i) => (
          <li key={l} className={i === step ? "font-semibold text-ink" : i < step ? "text-ink" : ""}>
            {l}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---- Selectable options (real radio buttons / checkboxes, styled) ----
type OptionProps = {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  type?: "radio" | "checkbox";
};

const optionShell =
  "relative flex cursor-pointer select-none rounded-2xl bg-white ring-1 ring-line-strong transition hover:ring-ink/30 has-checked:bg-crimson-50 has-checked:ring-2 has-checked:ring-crimson has-focus-visible:ring-4 has-focus-visible:ring-crimson-100";

// A big card for the main choice (e.g. the kind of work).
export function OptionCard({ name, value, checked, onChange, children, type = "radio" }: OptionProps) {
  return (
    <label className={`${optionShell} min-h-[88px] flex-col justify-center gap-1 p-4`}>
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {children}
      {checked && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-crimson text-white" aria-hidden>
          <CheckIcon className="h-3.5 w-3.5" />
        </span>
      )}
    </label>
  );
}

// A compact rounded pill for quick picks (amounts, shifts, areas, must-haves).
export function OptionPill({ name, value, checked, onChange, children, type = "radio" }: OptionProps) {
  return (
    <label className={`${optionShell} min-h-12 items-center gap-2 rounded-full px-4 text-base font-medium`}>
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {type === "checkbox" && (
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ${checked ? "bg-crimson text-white ring-crimson" : "ring-line-strong"}`}
          aria-hidden
        >
          {checked && <CheckIcon className="h-3 w-3" />}
        </span>
      )}
      {children}
    </label>
  );
}

export function FieldError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rise-in mt-3 text-base font-medium text-danger">
      {text}
    </p>
  );
}

export function Notice({ message }: { message: Message }) {
  if (!message) return null;
  const colours = message.tone === "yellow" ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-crimson-50 text-danger ring-crimson-100";
  return <p className={`rise-in rounded-xl px-4 py-3 text-base font-medium ring-1 ${colours}`}>{message.text}</p>;
}

export function Spinner() {
  return <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;
}

// A clean white surface. One level only: no cards inside cards.
export function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rise-in rounded-3xl bg-white p-5 shadow-soft ring-1 ring-line sm:p-8 ${className}`}>{children}</section>;
}

// Score out of 100 as a thin ring in ink.
export function ScoreRing({ score }: { score: number }) {
  return (
    <div
      className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#111827 ${score * 3.6}deg, rgba(17,24,39,0.08) 0deg)` }}
    >
      <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-white">
        <span className="text-sm font-bold">{score}/100</span>
      </div>
    </div>
  );
}

// ✓ met = green, ✗ missed = red, ? unclear = amber, all as quiet tonal chips.
export const STATUS_STYLE: Record<CheckStatus, { icon: string; chip: string; label: string }> = {
  met: { icon: "✓", chip: "bg-go-50 text-go-700", label: "Meets this" },
  missed: { icon: "✗", chip: "bg-crimson-50 text-danger", label: "Doesn't meet this" },
  unclear: { icon: "?", chip: "bg-amber-50 text-amber-800", label: "Not clear" },
};

// ---- Icons (simple line drawings, decorative) ----
type IconProps = { className?: string };
const Svg = ({ className = "h-5 w-5", children }: IconProps & { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
);

export const CheckIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="3" />
  </Svg>
);
export const CopyIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Svg>
);
export const MicIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Svg>
);
export const ArrowIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const BackIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Svg>
);
export const PencilIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />
  </Svg>
);
export const ChatIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 4 3.5 1.5.6 2.1.7 2.8.6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.2Z" />
  </svg>
);

// One icon per kind of work, shown on the work cards.
export const ROLE_ICONS: Record<string, (p: IconProps) => ReactNode> = {
  counter: ({ className }) => (
    <Svg className={className}>
      <rect x="3" y="10" width="18" height="10" rx="2" />
      <path d="M7 10V5h10v5M7 15h4" />
    </Svg>
  ),
  helper: ({ className }) => (
    <Svg className={className}>
      <path d="M3 8l9-5 9 5v8l-9 5-9-5V8Z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </Svg>
  ),
  delivery: ({ className }) => (
    <Svg className={className}>
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M9 17h6l-2-7h-3M13 10h3l2 7M4 10h5" />
    </Svg>
  ),
  packing: ({ className }) => (
    <Svg className={className}>
      <rect x="4" y="7" width="16" height="13" rx="1" />
      <path d="M4 11h16M10 7V4h4v3" />
    </Svg>
  ),
  sales: ({ className }) => (
    <Svg className={className}>
      <path d="M6 7h12l-1 13H7L6 7Z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </Svg>
  ),
  kitchen: ({ className }) => (
    <Svg className={className}>
      <path d="M6 13h12v7H6zM6 13a4 4 0 0 1 2-7.5A4 4 0 0 1 16 5.5 4 4 0 0 1 18 13" />
    </Svg>
  ),
  custom: ({ className }) => (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
};
