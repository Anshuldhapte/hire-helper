"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildRanking, splitApplicants, type Ranking, type RankedCard } from "@/lib/applicants";
import { EMPTY_DRAFT, type JobDraft } from "@/lib/draft";
import { ACCOMMODATION_OPTIONS, FEE_LINE, LEGAL_NOTE, type AccommodationKey } from "@/lib/roles";
import { BUILT_IN_SAMPLES, DEMO_JOB_LINE } from "@/lib/samples";
import {
  MAX_DESCRIPTION_CHARS,
  type CreatePostResponse,
  type Job,
  type PreviewResponse,
  type RankResponse,
  type RequiredDetail,
  type SamplesResponse,
} from "@/lib/schemas";
import { checkInMessage, whatsappLink, whatsappShareLink } from "@/lib/whatsapp";
import { JobPreview } from "./JobPreview";
import { JobWizard } from "./JobWizard";
import { findVoice, getRecognition, speak, useMicSupported, useVoices, type Recognition } from "./speech";
import {
  ChatIcon,
  CopyIcon,
  Eyebrow,
  Logo,
  MicIcon,
  Notice,
  OptionPill,
  PencilIcon,
  STATUS_STYLE,
  ScoreRing,
  Spinner,
  StepHeading,
  Surface,
  ghostButton,
  primaryButton,
  secondaryButton,
  textInput,
  whatsappButton,
  type Message,
} from "./ui";

const NETWORK_ERROR = "The AI is busy right now. Please try again.";

// One tap fills in a realistic line (for the "describe it in one line" option).
const EXAMPLES = [
  { label: "Wine shop counter", text: DEMO_JOB_LINE },
  { label: "Petrol pump attendant", text: "Need a petrol pump attendant in Hadapsar, Pune, ₹13,000 a month, day shift, must handle cash and UPI" },
  { label: "Kirana helper", text: "Need a helper for my kirana store in Karve Nagar, Pune, ₹11,000 a month, 9 am to 9 pm, must lift stock and do home delivery" },
  { label: "Café helper", text: "Need a kitchen helper for my café in Baner, Pune, ₹12,000 a month, 6 days a week, must know basic cutting and cleaning" },
  { label: "Delivery staff", text: "Need a delivery rider for my shop in Aundh, Pune, ₹14,000 a month, must have a bike and licence" },
];

const MISSING_HINT: Record<RequiredDetail, string> = {
  role: "what they'll do, e.g. “counter staff”",
  pay: "e.g. “₹12,000 a month”",
  area: "e.g. “Kothrud”",
};

const MIC_LANGUAGES = [
  { code: "mr-IN", label: "मराठी" },
  { code: "hi-IN", label: "हिंदी" },
  { code: "en-IN", label: "English" },
];

// POSTs JSON and always resolves to a response shape, even if the network or server
// fails. Gives up after `timeoutMs`, so the owner is never left waiting.
async function postJson<T>(url: string, body: unknown, timeoutMs: number): Promise<T> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return (await res.json()) as T;
  } catch {
    return { status: "error", message: NETWORK_ERROR } as T;
  }
}

// Copy: try the modern clipboard first (gives up after 1 second if the browser never
// answers), then an older hidden-textarea method. Returns false if both are blocked.
async function copyText(text: string) {
  try {
    const ok = await Promise.race([
      navigator.clipboard.writeText(text).then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000)),
    ]);
    if (ok) return true;
  } catch {
    // blocked; try the older way below
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  return ok;
}

// The post the owner shares: the AI's post, plus lines added by code (suggested must-haves,
// the accommodation answer) just before its last "how to apply" line, plus the fee line.
function fullPost(job: Job, accommodation: AccommodationKey | null) {
  const lines = job.postBody.split("\n");
  const applyLine = lines.length > 1 ? lines.pop()! : null;
  const extra = [
    ...job.mustHaves.filter((m) => m.source === "suggested").map((m) => `✅ ${m.label}`),
    ACCOMMODATION_OPTIONS.find((o) => o.key === accommodation)?.postLine,
  ].filter((l): l is string => Boolean(l));
  return [...lines, ...extra, applyLine, FEE_LINE].filter((l) => l !== null).join("\n");
}

function CopyButton({ text, label, primary }: { text: string; label: string; primary?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={primary ? primaryButton : secondaryButton}
        onClick={async () => {
          const ok = await copyText(text);
          setState(ok ? "copied" : "failed");
          if (ok) setTimeout(() => setState("idle"), 2000);
        }}
      >
        <CopyIcon />
        {state === "copied" ? "Copied!" : label}
      </button>
      {state === "failed" && <Notice message={{ tone: "yellow", text: "Press and hold the text to copy it" }} />}
    </div>
  );
}

export default function Home() {
  // ---- Creating the job ----
  const [mode, setMode] = useState<"steps" | "line">("steps");
  const [draft, setDraft] = useState<JobDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [postMessage, setPostMessage] = useState<Message>(null);
  const [missing, setMissing] = useState<RequiredDetail[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [accommodation, setAccommodation] = useState<AccommodationKey | null>(null);

  // ---- Village preview ----
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ marathi: string; hindi: string } | null>(null);
  const [previewMessage, setPreviewMessage] = useState<Message>(null);
  const [previewTab, setPreviewTab] = useState<"marathi" | "hindi">("marathi");
  const voices = useVoices();

  // ---- Voice input ----
  const micSupported = useMicSupported();
  const [micLang, setMicLang] = useState("mr-IN");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);

  // ---- Applicants ----
  const [replies, setReplies] = useState("");
  const [fromSamples, setFromSamples] = useState(false);
  const [samplesNote, setSamplesNote] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [interviewTime, setInterviewTime] = useState("");
  const [ranking, setRanking] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [rankMessage, setRankMessage] = useState<Message>(null);

  // ---- Top 3 ----
  const [result, setResult] = useState<Ranking | null>(null);
  const [hiredId, setHiredId] = useState<string | null>(null);

  const postRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const replyCount = useMemo(() => splitApplicants(replies).applicants.length, [replies]);
  const needsConsent = replies.trim() !== "" && !fromSamples;

  // Bring each new result into view, so the owner doesn't have to hunt for it.
  useEffect(() => {
    if (job) postRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [job]);
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  function clearAfterJobChange() {
    setResult(null);
    setRankMessage(null);
    setPreview(null);
    setPreviewMessage(null);
    setHiredId(null);
  }

  // Both ways of creating a job end here, with one line of text: the same API as before.
  async function createPost(text: string, stay: AccommodationKey | null) {
    setMissing([]);
    const line = text.trim();
    if (!line) {
      setPostMessage({ tone: "yellow", text: "Please describe the job" });
      return;
    }
    if (line.length > MAX_DESCRIPTION_CHARS) {
      setPostMessage({ tone: "yellow", text: "Please keep it to one or two lines" });
      return;
    }

    // A new line replaces the old job straight away, so an old post or ranking can never be
    // used with the new job, even if this request fails. The typed text stays.
    setCreating(true);
    setPostMessage(null);
    setJob(null);
    setAccommodation(stay);
    clearAfterJobChange();
    const data = await postJson<CreatePostResponse>("/api/create-post", { description: line }, 16_000);
    setCreating(false);

    if (data.status === "error") {
      setPostMessage({ tone: "red", text: data.message });
    } else if (data.status === "missing") {
      setMissing(data.missing);
      setPostMessage({ tone: "yellow", text: `Please add: ${data.missing.join(", ")}` });
    } else {
      setJob({
        description: data.description,
        roleTitle: data.roleTitle,
        roleKey: data.roleKey,
        openings: data.openings,
        area: data.area,
        pay: data.pay,
        shift: data.shift,
        postBody: data.postBody,
        mustHaves: data.mustHaves,
        questions: data.questions,
      });
    }
  }

  function editJob() {
    // Go back to the form with every answer still filled in.
    setJob(null);
    clearAfterJobChange();
    if (mode === "steps") setStep(4);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeMustHave(id: string) {
    if (!job || job.mustHaves.length <= 1) return; // keep at least one to rank on
    setJob({ ...job, mustHaves: job.mustHaves.filter((m) => m.id !== id) });
    clearAfterJobChange();
  }

  function chooseAccommodation(key: AccommodationKey) {
    setAccommodation(key); // plain code: updates the card and post, no AI call
    setDraft({ ...draft, accommodation: key });
    setPreview(null); // the preview mentions where they'll stay, so make a fresh one
    setPreviewMessage(null);
  }

  function toggleMic() {
    const RecognitionClass = getRecognition();
    if (!RecognitionClass) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const r = new RecognitionClass();
    r.lang = micLang;
    r.interimResults = false;
    r.onresult = (e) => {
      const said = Array.from(e.results)
        .map((res) => res[0].transcript)
        .join(" ");
      setDescription((d) => (d.trim() ? `${d.trim()} ${said}` : said));
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    setListening(true);
    r.start();
  }

  async function makePreview() {
    if (!job) return;
    setPreviewing(true);
    setPreview(null);
    setPreviewMessage(null);
    const data = await postJson<PreviewResponse>(
      "/api/preview",
      {
        roleTitle: job.roleTitle,
        pay: job.pay,
        area: job.area,
        shift: job.shift,
        openings: job.openings,
        accommodation: ACCOMMODATION_OPTIONS.find((o) => o.key === accommodation)?.card ?? "",
        mustHaves: job.mustHaves.map((m) => m.label),
      },
      16_000,
    );
    setPreviewing(false);
    if (data.status === "error") setPreviewMessage({ tone: "red", text: data.message });
    else setPreview({ marathi: data.marathi, hindi: data.hindi });
  }

  // The demo job uses the built-in samples; any other job gets AI-written ones that fit it.
  async function loadSamples() {
    if (!job) return;
    setRankMessage(null);
    setResult(null);
    setSamplesNote(null);
    const showBuiltInSamples = () => {
      setReplies(BUILT_IN_SAMPLES);
      setFromSamples(true);
      setSamplesNote("Showing built-in wine shop samples");
    };
    if (job.description === DEMO_JOB_LINE) return showBuiltInSamples();

    setLoadingSamples(true);
    const data = await postJson<SamplesResponse>(
      "/api/samples",
      { roleTitle: job.roleTitle, pay: job.pay, area: job.area, shift: job.shift, mustHaves: job.mustHaves.map((m) => m.label) },
      16_000,
    );
    setLoadingSamples(false);
    if (data.status === "error") return showBuiltInSamples();
    setReplies(data.text);
    setFromSamples(true);
  }

  async function rank() {
    if (!job) return;
    setRankMessage(null);
    setResult(null); // never leave old results next to new replies or an error
    setHiredId(null);

    const { applicants, tooMany } = splitApplicants(replies);
    if (applicants.length === 0) {
      setRankMessage({ tone: "yellow", text: "Please paste replies or tap Load sample applicants" });
      return;
    }
    if (tooMany) {
      setRankMessage({ tone: "yellow", text: "Please paste up to 30 replies at a time." });
      return;
    }

    let checked: Extract<RankResponse, { status: "ok" }>["results"] = [];
    const usable = applicants.filter((a) => !a.junkReason);
    // Only call the AI when at least one reply is worth checking.
    if (usable.length > 0) {
      setRanking(true);
      const data = await postJson<RankResponse>(
        "/api/rank",
        {
          roleTitle: job.roleTitle,
          mustHaves: job.mustHaves.map(({ id, label }) => ({ id, label })),
          applicants: usable.map(({ id, text }) => ({ id, text })),
        },
        21_000,
      );
      setRanking(false);
      if (data.status === "error") {
        setRankMessage({ tone: "red", text: data.message });
        return;
      }
      checked = data.results;
    }
    setResult(buildRanking(applicants, checked, job.mustHaves, job.roleTitle, interviewTime));
  }

  const post = job ? fullPost(job, accommodation) : "";
  const copyPostText = job
    ? `${post}\n\nPlease reply with your name, phone number and answers:\n${job.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : "";
  const previewText = preview ? preview[previewTab] : "";
  const previewVoice = findVoice(voices, previewTab === "marathi" ? "mr" : "hi");

  // What the side preview shows: the real post once it exists, otherwise the live form.
  const sidePreview = job ? (
    <article className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-line" aria-label="Your job post">
      <Eyebrow>Your post · ready to share</Eyebrow>
      <p className="post-text mt-4 whitespace-pre-wrap break-words text-base leading-relaxed">{post}</p>
    </article>
  ) : mode === "steps" ? (
    <JobPreview draft={draft} onEdit={step === 4 ? setStep : undefined} />
  ) : (
    <div className="rounded-3xl border border-dashed border-line-strong p-6 text-base text-slate">
      Your job post will appear here once it&apos;s written.
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-5 pb-2 pt-6 sm:px-8">
        <Logo />
        <span className="rounded-full bg-white px-3 py-1.5 text-center text-xs font-semibold leading-snug text-ink ring-1 ring-line">
          एक रुपया फीस नहीं · No fee for workers
        </span>
      </header>

      <main className="mx-auto grid w-full max-w-[1200px] gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <div className="min-w-0">
          {/* ---- Intro ---- */}
          {/* Letter-spacing breaks Devanagari joined letters, so the Hindi line has none. */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Eyebrow>For shop owners</Eyebrow>
            <span className="text-sm font-semibold text-slate">स्टाफ पक्का, काम पक्का</span>
          </div>
          <h1 className="mt-3 max-w-2xl text-[32px] font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            A shortlist of 3 trusted workers, not 40 random calls.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate">
            Tell us the job in a few taps. We write a clear post, check every reply, and show you the 3 worth calling.
          </p>

          {/* ================= Create the job ================= */}
          <Surface className="mt-10">
            {mode === "steps" ? (
              <>
                {!job && (
                  <details className="mb-8 rounded-2xl bg-canvas lg:hidden">
                    <summary className="flex min-h-12 cursor-pointer items-center px-4 text-base font-semibold">Preview job listing</summary>
                    <div className="px-2 pb-3">
                      <JobPreview draft={draft} />
                    </div>
                  </details>
                )}
                <JobWizard
                  draft={draft}
                  setDraft={setDraft}
                  step={step}
                  setStep={setStep}
                  creating={creating}
                  onCreate={(line) => createPost(line, draft.accommodation)}
                />
              </>
            ) : (
              <>
                <StepHeading eyebrow="Quick start" title="Describe the job in one line" hint="The work, pay and area are enough. Type, tap an example, or speak." />
                <div className="mb-4 flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => setDescription(ex.text)}
                      className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-line-strong hover:ring-ink/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-crimson-100"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
                <label htmlFor="job" className="sr-only">
                  Job description
                </label>
                <textarea
                  id="job"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="e.g. Need a delivery rider in Pune, ₹15,000 a month, 6 days a week, must have a bike and licence"
                  className={`${textInput} min-h-28 text-lg leading-relaxed`}
                />
                <div className="mb-6 mt-2 flex items-center justify-between gap-3 text-sm text-slate">
                  {micSupported ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleMic}
                        aria-label={listening ? "Stop voice input" : "Speak the job"}
                        className={`flex h-11 w-11 items-center justify-center rounded-full ${listening ? "animate-pulse bg-crimson text-white" : "bg-white text-ink ring-1 ring-line-strong"}`}
                      >
                        <MicIcon />
                      </button>
                      <select
                        value={micLang}
                        onChange={(e) => setMicLang(e.target.value)}
                        aria-label="Voice language"
                        className="h-11 rounded-xl bg-white px-2 text-sm ring-1 ring-line-strong"
                      >
                        {MIC_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span />
                  )}
                  <span className={`shrink-0 ${description.length > MAX_DESCRIPTION_CHARS ? "font-bold text-danger" : ""}`}>
                    {description.length}/{MAX_DESCRIPTION_CHARS}
                  </span>
                </div>
                <button onClick={() => createPost(description, null)} disabled={creating} className={`${primaryButton} min-w-48`}>
                  {creating && <Spinner />}
                  {creating ? "Writing your post… (up to 15 seconds)" : "Create post"}
                </button>
              </>
            )}

            <div aria-live="polite" className="mt-4 flex flex-col gap-2">
              <Notice message={postMessage} />
              {missing.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {missing.map((m) => (
                    <li key={m} className="flex items-center gap-3 text-base">
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-bold capitalize text-amber-900 ring-1 ring-amber-200">{m}</span>
                      <span className="text-slate">{MISSING_HINT[m]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-8 border-t border-line pt-5">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "steps" ? "line" : "steps");
                  setPostMessage(null);
                  setMissing([]);
                }}
                className="text-base font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
              >
                {mode === "steps" ? "Prefer to type or speak? Describe it in one line" : "Use the step-by-step form instead"}
              </button>
            </div>
          </Surface>

          {/* ================= The finished post ================= */}
          {job && (
            <div ref={postRef} className="mt-10 flex scroll-mt-6 flex-col gap-10">
              <Surface>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <StepHeading eyebrow="Ready to share" title="Your job post" />
                  <button type="button" onClick={editJob} className={ghostButton}>
                    <PencilIcon />
                    Edit job
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  {[
                    ["Role", job.roleTitle],
                    ["Openings", String(job.openings)],
                    ["Area", job.area],
                    ["Shift/hours", job.shift || "Not given"],
                    ["Pay", job.pay],
                    ["Accommodation", ACCOMMODATION_OPTIONS.find((o) => o.key === accommodation)?.card ?? "Not answered yet"],
                  ].map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">{k}</dt>
                      <dd className="mt-1 break-words text-base font-semibold">{v}</dd>
                    </div>
                  ))}
                </dl>

                <h3 className="mb-3 mt-8 text-base font-bold">Must-haves</h3>
                <ul className="divide-y divide-line">
                  {job.mustHaves.map((m) => (
                    <li key={m.id} className="flex min-h-12 items-center gap-3 py-1 text-base">
                      <span className="flex-1 break-words">{m.label}</span>
                      {m.source === "suggested" && (
                        <>
                          <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-slate ring-1 ring-line">Suggested</span>
                          {job.mustHaves.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeMustHave(m.id)}
                              aria-label={`Remove ${m.label}`}
                              className="flex h-11 w-11 items-center justify-center rounded-full text-slate hover:bg-canvas hover:text-ink"
                            >
                              ✕
                            </button>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-slate">{LEGAL_NOTE}</p>

                {/* The one follow-up question: plain code, no AI call. */}
                <fieldset className="mt-8">
                  <legend className="mb-3 text-base font-bold">Is accommodation provided?</legend>
                  <div className="flex flex-wrap gap-2">
                    {ACCOMMODATION_OPTIONS.map((o) => (
                      <OptionPill key={o.key} name="accommodation" value={o.key} checked={accommodation === o.key} onChange={() => chooseAccommodation(o.key)}>
                        {o.label}
                      </OptionPill>
                    ))}
                  </div>
                </fieldset>

                <h3 className="mb-3 mt-8 text-base font-bold">The post</h3>
                <p className="post-text whitespace-pre-wrap break-words rounded-2xl bg-canvas p-5 text-base leading-relaxed">{post}</p>

                <h3 className="mb-3 mt-8 text-base font-bold">Screening questions</h3>
                <ol className="flex flex-col gap-3">
                  {job.questions.map((q, i) => (
                    <li key={q} className="flex gap-3 text-base">
                      <span className="w-6 shrink-0 font-bold text-slate">{i + 1}.</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-8 flex flex-wrap gap-3">
                  <CopyButton text={copyPostText} label="Copy post" primary />
                </div>
              </Surface>

              <Surface>
                <StepHeading eyebrow="Reach more people" title="For village candidates" hint="A short job preview in Marathi and Hindi to send to village groups." />
                <button onClick={makePreview} disabled={previewing} className={secondaryButton}>
                  {previewing && <Spinner />}
                  {previewing ? "Making preview… (up to 15 seconds)" : "Make job preview for village candidates"}
                </button>
                <div aria-live="polite" className="mt-3">
                  <Notice message={previewMessage} />
                </div>
                {preview && (
                  <div className="rise-in mt-6 max-w-2xl">
                    <div role="tablist" className="mb-4 inline-flex rounded-full bg-canvas p-1 ring-1 ring-line">
                      {(["marathi", "hindi"] as const).map((tab) => (
                        <button
                          key={tab}
                          role="tab"
                          aria-selected={previewTab === tab}
                          onClick={() => setPreviewTab(tab)}
                          className={`min-h-11 rounded-full px-6 text-base font-bold ${previewTab === tab ? "bg-ink text-white" : "text-slate"}`}
                        >
                          {tab === "marathi" ? "मराठी" : "हिंदी"}
                        </button>
                      ))}
                    </div>
                    <p className="whitespace-pre-wrap break-words rounded-2xl bg-canvas p-5 text-base leading-relaxed">{previewText}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {previewVoice ? (
                        <button type="button" onClick={() => speak(previewText, previewVoice)} className={secondaryButton}>
                          Listen
                        </button>
                      ) : (
                        <p className="flex min-h-12 items-center text-sm text-slate">Audio not available on this phone</p>
                      )}
                      <a href={whatsappShareLink(previewText)} target="_blank" rel="noopener noreferrer" className={whatsappButton}>
                        <ChatIcon />
                        Share on WhatsApp
                      </a>
                      <CopyButton text={previewText} label="Copy" />
                    </div>
                  </div>
                )}
              </Surface>
            </div>
          )}

          {/* ================= Applicants ================= */}
          <Surface className={`mt-10 ${job ? "" : "opacity-60"}`}>
            <StepHeading
              eyebrow="Applicants"
              title="Add applicants' replies"
              hint="Paste all replies at once. Put a blank line between people, or paste a copied WhatsApp chat."
            />
            {!job && <p className="mb-4 text-base font-medium text-slate">Create a job post first.</p>}

            <label htmlFor="replies" className="sr-only">
              Applicants&apos; replies
            </label>
            <textarea
              id="replies"
              value={replies}
              onChange={(e) => {
                setReplies(e.target.value);
                setFromSamples(false); // the owner's own replies need their consent tick
                setSamplesNote(null);
              }}
              rows={8}
              disabled={!job}
              className={`${textInput} leading-relaxed`}
            />
            <p className="mb-5 mt-2 text-sm text-slate">
              {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? "reply" : "replies"} found` : "No replies yet? Load samples to try it."}
              {samplesNote && <span className="ml-2 font-semibold text-ink">· {samplesNote}</span>}
            </p>

            <button onClick={loadSamples} disabled={!job || loadingSamples || ranking} className={secondaryButton}>
              {loadingSamples && <Spinner />}
              {loadingSamples ? "Loading samples…" : "Load sample applicants"}
            </button>

            <label htmlFor="when" className="mb-2 mt-8 block text-base font-bold">
              Interview time<span className="ml-2 text-sm font-medium text-slate">Optional</span>
            </label>
            <input
              id="when"
              value={interviewTime}
              onChange={(e) => setInterviewTime(e.target.value)}
              disabled={!job}
              placeholder="e.g. tomorrow at 11 am"
              className={`${textInput} max-w-md`}
            />

            {/* Privacy (India's DPDP Act): say where replies go, and get consent for real ones. */}
            <p className="mt-8 text-sm leading-relaxed text-slate">
              Replies are sent to Google&apos;s Gemini AI to be ranked and are not saved by Kaam Pakka.
            </p>
            {needsConsent && (
              <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-base">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-crimson"
                />
                <span>These applicants agreed to share their replies with me for this job.</span>
              </label>
            )}

            <button
              onClick={rank}
              disabled={!job || ranking || loadingSamples || (needsConsent && !consent)}
              className={`${primaryButton} mt-6 min-w-48`}
            >
              {ranking && <Spinner />}
              {ranking ? "Checking each applicant… (up to 20 seconds)" : "Rank applicants"}
            </button>
            <div aria-live="polite" className="mt-4">
              <Notice message={rankMessage} />
            </div>
          </Surface>

          {/* ================= Top 3 ================= */}
          {result && (
            <div ref={resultRef} aria-live="polite" className="mt-10 flex scroll-mt-6 flex-col gap-5">
              <StepHeading eyebrow="Shortlist" title="Your top 3" />
              {result.notes.map((n) => (
                <Notice key={n} message={{ tone: "yellow", text: n }} />
              ))}
              {result.top.map((card, i) => (
                <ResultCard
                  key={card.id}
                  card={card}
                  rank={i + 1}
                  hired={hiredId === card.id}
                  onHired={() => setHiredId(hiredId === card.id ? null : card.id)}
                />
              ))}
              {result.top.length > 0 && (
                <p className="text-sm text-slate">Ranked only on job skills and availability — never on caste, religion or native place.</p>
              )}
              {[...result.notEnoughInfo, ...result.unchecked].length > 0 && (
                <details className="rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6">
                  <summary className="cursor-pointer text-base font-bold text-slate">
                    Not enough info ({result.notEnoughInfo.length + result.unchecked.length})
                  </summary>
                  <ul className="mt-3 divide-y divide-line text-sm">
                    {[...result.notEnoughInfo, ...result.unchecked].map((n) => (
                      <li key={n.id} className="py-3">
                        <span className="block break-words text-ink">{n.preview}</span>
                        <span className="text-slate">Why: {n.why}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        {/* ---- Live preview (desktop) ---- */}
        <aside className="hidden lg:block" aria-label="Live preview">
          <div className="sticky top-8">
            <Eyebrow>Live preview</Eyebrow>
            <div className="mt-4">{sidePreview}</div>
          </div>
        </aside>
      </main>

      <footer className="mt-auto border-t border-line bg-white px-5 py-5 text-center text-sm font-medium text-slate">
        Pay only when a worker joins · Free replacement within 30 days · Workers never pay a fee
      </footer>
    </div>
  );
}

function ResultCard({ card, rank, hired, onHired }: { card: RankedCard; rank: number; hired: boolean; onHired: () => void }) {
  const name = card.name.startsWith("Applicant ") ? "" : card.name;
  return (
    <article
      className={`rise-in rounded-3xl bg-white p-5 shadow-soft ring-1 sm:p-7 ${rank === 1 ? "ring-2 ring-ink" : "ring-line"}`}
      style={{ animationDelay: `${(rank - 1) * 60}ms` }}
    >
      <div className="flex items-center gap-4">
        <span className="text-3xl font-extrabold tabular-nums text-slate">{rank}</span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-xl font-extrabold leading-tight">{card.name}</h3>
          {rank === 1 && <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-crimson">Best match</p>}
        </div>
        <ScoreRing score={card.score} />
      </div>

      <p className="mt-4 text-base leading-relaxed">{card.reason}</p>

      <ul className="mt-4 flex flex-col gap-3">
        {card.checks.map((c) => (
          <li key={c.label} className="flex gap-3 text-base">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${STATUS_STYLE[c.status].chip}`}
              title={STATUS_STYLE[c.status].label}
            >
              {STATUS_STYLE[c.status].icon}
            </span>
            <span className="min-w-0">
              <span className="font-medium">{c.label}</span>
              <span className="block break-words text-sm italic text-slate">{c.proof ? `“${c.proof}”` : "No proof found"}</span>
            </span>
          </li>
        ))}
      </ul>

      {card.strengths.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1">
          {card.strengths.map((s) => (
            <li key={s.text} className="break-words text-sm">
              <span className="font-semibold">+ {s.text}</span> <span className="italic text-slate">“{s.proof}”</span>
            </li>
          ))}
        </ul>
      )}

      {(card.canJoin || card.stay) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {card.canJoin && (
            <span className="rounded-full bg-canvas px-3 py-1 text-sm ring-1 ring-line" title={`“${card.canJoin.proof}”`}>
              Can join: {card.canJoin.text}
            </span>
          )}
          {card.stay && (
            <span className="rounded-full bg-canvas px-3 py-1 text-sm ring-1 ring-line" title={`“${card.stay.proof}”`}>
              Stay: {card.stay.text}
            </span>
          )}
        </div>
      )}

      <details className="mt-4 text-base">
        <summary className="cursor-pointer font-semibold text-ink underline decoration-line-strong underline-offset-4">Show original reply</summary>
        <p className="mt-2 whitespace-pre-wrap break-words text-slate">{card.text}</p>
      </details>

      {card.whatsapp ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={card.whatsapp} target="_blank" rel="noopener noreferrer" className={whatsappButton}>
            <ChatIcon />
            Send WhatsApp reminder
          </a>
          <button type="button" onClick={onHired} className={secondaryButton}>
            {hired ? "Hide check-in message" : "Mark as hired"}
          </button>
          {hired && card.phone && (
            <div className="rise-in w-full rounded-2xl bg-canvas p-4 text-sm">
              <p className="font-semibold">Day-7 check-in message (send it after their first week):</p>
              <p className="mt-1 italic">{checkInMessage(name)}</p>
              <a href={whatsappLink(card.phone, checkInMessage(name))} target="_blank" rel="noopener noreferrer" className={`${whatsappButton} mt-3`}>
                <ChatIcon />
                Send check-in on WhatsApp
              </a>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-6 text-base text-hint">No phone number found</p>
      )}
    </article>
  );
}
