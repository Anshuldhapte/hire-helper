// The live job listing: how the job will look to job seekers, built from the current form.
// Missing details show as grey "Add …" hints, never as made-up facts.
import { mustHaveLabels, payText, roleLabel, scheduleText, shopLabel, type JobDraft } from "@/lib/draft";
import { ACCOMMODATION_OPTIONS, FEE_LINE } from "@/lib/roles";
import { CheckIcon, Eyebrow, PencilIcon } from "./ui";

const Hint = ({ children }: { children: string }) => <span className="font-medium italic text-hint">{children}</span>;

function EditButton({ step, what, onEdit }: { step: number; what: string; onEdit?: (step: number) => void }) {
  if (!onEdit) return null;
  return (
    <button
      type="button"
      onClick={() => onEdit(step)}
      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-slate hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
      aria-label={`Edit ${what}`}
    >
      <PencilIcon className="h-4 w-4" />
      Edit
    </button>
  );
}

type Props = {
  draft: JobDraft;
  onEdit?: (step: number) => void; // shows "Edit" next to each part when given
};

export function JobPreview({ draft, onEdit }: Props) {
  const role = roleLabel(draft);
  const shop = shopLabel(draft);
  const pay = payText(draft);
  const schedule = scheduleText(draft);
  const musts = mustHaveLabels(draft);
  const stay = ACCOMMODATION_OPTIONS.find((o) => o.key === draft.accommodation)?.card;
  const notes = draft.notes.trim();

  return (
    <article className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-line" aria-label="Job listing preview">
      <div className="flex items-start justify-between gap-3">
        <Eyebrow>Job · Kaam Pakka</Eyebrow>
        {draft.openings > 1 && (
          <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold ring-1 ring-line">{draft.openings} openings</span>
        )}
      </div>

      <div className="mt-3 flex items-start justify-between gap-2">
        <h3 className="break-words text-2xl font-extrabold leading-tight tracking-tight">{role || <Hint>Add the work</Hint>}</h3>
        <EditButton step={0} what="the work" onEdit={onEdit} />
      </div>
      <div className="mt-1 flex items-start justify-between gap-2 text-base text-slate">
        <p className="break-words">
          {shop ? `${shop} · ` : ""}
          {draft.area.trim() || <Hint>Add the area</Hint>}
        </p>
        <EditButton step={3} what="the location" onEdit={onEdit} />
      </div>

      <dl className="mt-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Salary</dt>
            <dd className="mt-1 text-xl font-bold">{pay || <Hint>Add salary</Hint>}</dd>
          </div>
          <EditButton step={2} what="the salary and hours" onEdit={onEdit} />
        </div>
        {schedule && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Work hours</dt>
            <dd className="mt-1 break-words text-base font-medium">{schedule}</dd>
          </div>
        )}
        {stay && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Place to stay</dt>
            <dd className="mt-1 text-base font-medium">{stay}</dd>
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Must have</dt>
            <dd className="mt-2">
              {musts.length > 0 ? (
                <ul className="space-y-2">
                  {musts.map((m) => (
                    <li key={m} className="flex gap-2 break-words text-base">
                      <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-go-700" />
                      {m}
                    </li>
                  ))}
                </ul>
              ) : (
                <Hint>We&apos;ll suggest the basics for this work</Hint>
              )}
            </dd>
          </div>
          <EditButton step={1} what="the must-haves" onEdit={onEdit} />
        </div>
        {notes && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Also</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-base">{notes}</dd>
          </div>
        )}
      </dl>

      <p className="mt-6 border-t border-line pt-4 text-sm font-medium text-slate">{FEE_LINE}</p>
    </article>
  );
}
