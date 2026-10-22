"use client";
// The 5-step job form: Work → Details → Pay & hours → Location → Review.
// Taps first, typing only when the owner wants their own words. Values are kept when
// moving back and forth; only work, pay and area are required.
import { useState } from "react";
import {
  AREAS,
  DAYS,
  MUST_HAVES,
  MUST_HAVES_FOR,
  PAY_PICKS,
  ROLES,
  SHIFTS,
  SHOPS,
  STEP_LABELS,
  composeDescription,
  formatRupees,
  stepError,
  type JobDraft,
  type MustHaveId,
} from "@/lib/draft";
import { ACCOMMODATION_OPTIONS } from "@/lib/roles";
import { JobPreview } from "./JobPreview";
import {
  ArrowIcon,
  BackIcon,
  FieldError,
  GroupLabel,
  OptionCard,
  OptionPill,
  ProgressTrack,
  ROLE_ICONS,
  Spinner,
  StepHeading,
  ghostButton,
  primaryButton,
  secondaryButton,
  textInput,
} from "./ui";

type Props = {
  draft: JobDraft;
  setDraft: (d: JobDraft) => void;
  step: number;
  setStep: (s: number) => void;
  creating: boolean;
  onCreate: (description: string) => void;
};

export function JobWizard({ draft, setDraft, step, setStep, creating, onCreate }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [ownMustHave, setOwnMustHave] = useState("");
  const set = (changes: Partial<JobDraft>) => {
    setDraft({ ...draft, ...changes });
    setError(null);
  };
  const last = STEP_LABELS.length - 1;

  function goTo(next: number) {
    // Moving forward checks the current step; moving back never blocks.
    if (next > step) {
      const problem = stepError(step, draft);
      if (problem) return setError(problem);
    }
    setError(null);
    setStep(next);
  }

  function create() {
    for (const s of [0, 2, 3]) {
      const problem = stepError(s, draft);
      if (problem) {
        setStep(s);
        return setError(problem);
      }
    }
    onCreate(composeDescription(draft));
  }

  function addOwnMustHave() {
    const words = ownMustHave.trim();
    if (!words || draft.customMustHaves.includes(words)) return;
    set({ customMustHaves: [...draft.customMustHaves, words] });
    setOwnMustHave("");
  }

  const suggested: MustHaveId[] = MUST_HAVES_FOR[draft.roleKey || "custom"] ?? MUST_HAVES_FOR.custom;
  // Keep any already-picked must-haves visible even if the work type changed.
  const mustHaveIds = [...new Set([...suggested, ...(draft.mustHaves as MustHaveId[])])];

  return (
    <div>
      <ProgressTrack step={step} labels={STEP_LABELS} />

      <div key={step} className="rise-in">
        {step === 0 && (
          <>
            <StepHeading eyebrow="The work" title="What work do you need help with?" hint="Pick the closest one. You can change it later." />
            <fieldset>
              <legend className="sr-only">Kind of work</legend>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {ROLES.map((r) => {
                  const Icon = ROLE_ICONS[r.key];
                  return (
                    <OptionCard key={r.key} name="role" value={r.key} checked={draft.roleKey === r.key} onChange={() => set({ roleKey: r.key })}>
                      <Icon className="mb-1 h-6 w-6 text-slate" />
                      <span className="pr-6 text-base font-bold leading-snug">{r.label}</span>
                      <span className="text-sm leading-snug text-slate">{r.hint}</span>
                    </OptionCard>
                  );
                })}
                <OptionCard name="role" value="custom" checked={draft.roleKey === "custom"} onChange={() => set({ roleKey: "custom" })}>
                  <ROLE_ICONS.custom className="mb-1 h-6 w-6 text-slate" />
                  <span className="text-base font-bold leading-snug">Something else</span>
                  <span className="text-sm leading-snug text-slate">Type your own</span>
                </OptionCard>
              </div>
            </fieldset>
            {draft.roleKey === "custom" && (
              <div className="rise-in mt-4">
                <label htmlFor="custom-role" className="mb-2 block text-base font-bold">
                  What work is it?
                </label>
                <input
                  id="custom-role"
                  autoFocus
                  value={draft.customRole}
                  onChange={(e) => set({ customRole: e.target.value })}
                  placeholder="e.g. cashier, दुकान सहायक, godown helper"
                  maxLength={60}
                  className={textInput}
                />
              </div>
            )}

            <fieldset className="mt-8">
              <legend>
                <GroupLabel optional>What kind of shop?</GroupLabel>
              </legend>
              <div className="flex flex-wrap gap-2">
                {SHOPS.map((s) => (
                  <OptionPill key={s} name="shop" value={s} checked={draft.shop === s} onChange={() => set({ shop: draft.shop === s ? "" : s })}>
                    {s}
                  </OptionPill>
                ))}
                <OptionPill name="shop" value="custom" checked={draft.shop === "custom"} onChange={() => set({ shop: "custom" })}>
                  Other
                </OptionPill>
              </div>
              {draft.shop === "custom" && (
                <input
                  aria-label="Kind of shop"
                  value={draft.customShop}
                  onChange={(e) => set({ customShop: e.target.value })}
                  placeholder="e.g. hardware shop, mobile shop"
                  maxLength={40}
                  className={`${textInput} rise-in mt-3`}
                />
              )}
            </fieldset>
          </>
        )}

        {step === 1 && (
          <>
            <StepHeading
              eyebrow="Details"
              title="What should they be able to do?"
              hint="Tap what matters to you. If you skip this, we'll suggest the basics for this work."
            />
            <fieldset>
              <legend className="sr-only">Must-haves</legend>
              <div className="flex flex-wrap gap-2">
                {mustHaveIds.map((id) => (
                  <OptionPill
                    key={id}
                    type="checkbox"
                    name="must"
                    value={id}
                    checked={draft.mustHaves.includes(id)}
                    onChange={() =>
                      set({
                        mustHaves: draft.mustHaves.includes(id) ? draft.mustHaves.filter((m) => m !== id) : [...draft.mustHaves, id],
                      })
                    }
                  >
                    {MUST_HAVES[id].label}
                  </OptionPill>
                ))}
              </div>
            </fieldset>

            {draft.customMustHaves.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {draft.customMustHaves.map((m) => (
                  <li key={m} className="flex min-h-12 items-center gap-1 rounded-full bg-crimson-50 py-1 pl-4 pr-1 text-base font-medium ring-2 ring-crimson">
                    <span className="break-words">{m}</span>
                    <button
                      type="button"
                      onClick={() => set({ customMustHaves: draft.customMustHaves.filter((x) => x !== m) })}
                      aria-label={`Remove ${m}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate hover:bg-white hover:text-ink"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex gap-2">
              <label htmlFor="own-must" className="sr-only">
                Add your own must-have
              </label>
              <input
                id="own-must"
                value={ownMustHave}
                onChange={(e) => setOwnMustHave(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOwnMustHave();
                  }
                }}
                placeholder="Add your own, e.g. Marathi bolta aana chahiye"
                maxLength={80}
                className={textInput}
              />
              <button type="button" onClick={addOwnMustHave} disabled={!ownMustHave.trim()} className={secondaryButton}>
                Add
              </button>
            </div>

            <fieldset className="mt-8">
              <legend>
                <GroupLabel>How many people?</GroupLabel>
              </legend>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <OptionPill key={n} name="openings" value={String(n)} checked={draft.openings === n} onChange={() => set({ openings: n })}>
                    <span className="min-w-4 text-center">{n}</span>
                  </OptionPill>
                ))}
              </div>
            </fieldset>

            <div className="mt-8">
              <label htmlFor="notes" className="mb-3 block text-base font-bold">
                Anything else?<span className="ml-2 text-sm font-medium text-slate">Optional</span>
              </label>
              <textarea
                id="notes"
                value={draft.notes}
                onChange={(e) => set({ notes: e.target.value })}
                rows={3}
                maxLength={200}
                placeholder="e.g. Sunday off, uniform given, खाना मिलेगा"
                className={`${textInput} leading-relaxed`}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <StepHeading eyebrow="Pay & hours" title="What will you pay?" hint="Tap an amount or type your own." />
            <fieldset>
              <legend className="sr-only">Paid per</legend>
              <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-line-strong">
                {(["month", "day"] as const).map((per) => (
                  <label
                    key={per}
                    className="flex min-h-11 cursor-pointer items-center rounded-full px-5 text-base font-semibold text-slate has-checked:bg-ink has-checked:text-white has-focus-visible:ring-4 has-focus-visible:ring-crimson-100"
                  >
                    <input
                      type="radio"
                      name="per"
                      value={per}
                      checked={draft.payPer === per}
                      onChange={() => set({ payPer: per, payAmount: "" })}
                      className="sr-only"
                    />
                    Per {per}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="sr-only">Common amounts</legend>
              <div className="flex flex-wrap gap-2">
                {PAY_PICKS[draft.payPer].map((amount) => (
                  <OptionPill
                    key={amount}
                    name="pay"
                    value={String(amount)}
                    checked={draft.payAmount === String(amount)}
                    onChange={() => set({ payAmount: String(amount) })}
                  >
                    {formatRupees(String(amount))}
                  </OptionPill>
                ))}
              </div>
            </fieldset>

            <label htmlFor="pay" className="mb-2 mt-5 block text-sm font-semibold text-slate">
              Or type the amount
            </label>
            <div className="relative max-w-xs">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-semibold text-slate">₹</span>
              <input
                id="pay"
                inputMode="numeric"
                value={draft.payAmount ? Number(draft.payAmount).toLocaleString("en-IN") : ""}
                onChange={(e) => set({ payAmount: e.target.value.replace(/[^\d]/g, "").slice(0, 7) })}
                placeholder={draft.payPer === "month" ? "12,000" : "500"}
                className={`${textInput} pl-9 text-lg font-semibold`}
              />
            </div>
            <FieldError text={error} />

            <fieldset className="mt-10">
              <legend>
                <GroupLabel optional>When will they work?</GroupLabel>
              </legend>
              <div className="flex flex-wrap gap-2">
                {SHIFTS.map((s) => (
                  <OptionPill key={s.key} name="shift" value={s.key} checked={draft.shift === s.key} onChange={() => set({ shift: draft.shift === s.key ? "" : s.key })}>
                    {s.label}
                  </OptionPill>
                ))}
              </div>
              <input
                aria-label="Exact hours (optional)"
                value={draft.hours}
                onChange={(e) => set({ hours: e.target.value })}
                placeholder="Exact hours (optional), e.g. 4 pm to 11 pm"
                maxLength={40}
                className={`${textInput} mt-3 max-w-md`}
              />
            </fieldset>

            <fieldset className="mt-6">
              <legend>
                <GroupLabel optional>Days a week</GroupLabel>
              </legend>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <OptionPill key={d} name="days" value={d} checked={draft.days === d} onChange={() => set({ days: draft.days === d ? "" : d })}>
                    {d}
                  </OptionPill>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {step === 3 && (
          <>
            <StepHeading eyebrow="Location" title="Where is the job?" hint="The area helps nearby people find it." />
            <fieldset>
              <legend className="sr-only">Area</legend>
              <div className="flex flex-wrap gap-2">
                {AREAS.map((a) => (
                  <OptionPill key={a} name="area" value={a} checked={draft.area === a} onChange={() => set({ area: a })}>
                    {a}
                  </OptionPill>
                ))}
              </div>
            </fieldset>
            <label htmlFor="area" className="mb-2 mt-5 block text-sm font-semibold text-slate">
              Or type the area
            </label>
            <input
              id="area"
              value={draft.area}
              onChange={(e) => set({ area: e.target.value })}
              placeholder="e.g. Sinhagad Road, Pune"
              maxLength={60}
              className={`${textInput} max-w-md`}
            />
            <FieldError text={error} />

            <fieldset className="mt-10">
              <legend>
                <GroupLabel optional>Can you give a place to stay?</GroupLabel>
              </legend>
              <p className="-mt-2 mb-3 text-sm text-slate">Helps people from villages and small towns decide.</p>
              <div className="flex flex-wrap gap-2">
                {ACCOMMODATION_OPTIONS.map((o) => (
                  <OptionPill
                    key={o.key}
                    name="stay"
                    value={o.key}
                    checked={draft.accommodation === o.key}
                    onChange={() => set({ accommodation: draft.accommodation === o.key ? null : o.key })}
                  >
                    {o.label}
                  </OptionPill>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {step === 4 && (
          <>
            <StepHeading
              eyebrow="Review"
              title="Check your job"
              hint="This is how job seekers will see it. Tap Edit to change anything."
            />
            {/* On desktop the listing is already on the right, with Edit buttons. */}
            <div className="max-w-xl lg:hidden">
              <JobPreview draft={draft} onEdit={(s) => goTo(s)} />
            </div>
            <p className="hidden rounded-2xl bg-canvas px-5 py-4 text-base text-slate lg:block">
              Your listing is on the right. Tap <span className="font-semibold text-ink">Edit</span> next to anything you want to change.
            </p>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate">
              We&apos;ll write the post from: <span className="text-ink">“{composeDescription(draft)}”</span>
            </p>
          </>
        )}

        {step !== 2 && step !== 3 && <FieldError text={error} />}
      </div>

      {/* Back / Continue */}
      <div className="mt-10 flex flex-wrap items-center gap-3">
        {step > 0 && (
          <button type="button" onClick={() => goTo(step - 1)} className={ghostButton} disabled={creating}>
            <BackIcon />
            Back
          </button>
        )}
        {step < last ? (
          <button type="button" onClick={() => goTo(step + 1)} className={`${primaryButton} min-w-40`}>
            Continue
            <ArrowIcon />
          </button>
        ) : (
          <button type="button" onClick={create} disabled={creating} className={`${primaryButton} min-w-56`}>
            {creating && <Spinner />}
            {creating ? "Writing your post… (up to 15 seconds)" : "Create job post"}
          </button>
        )}
      </div>
      {step === last && (
        <p className="mt-3 text-sm text-slate">Nothing is posted anywhere. You copy or share the post yourself.</p>
      )}
    </div>
  );
}
