"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildRanking, splitApplicants, type Ranking, type RankedCard } from "@/lib/applicants";
import {
  ACCOMMODATION_OPTIONS,
  FEE_LINE,
  LEGAL_NOTE,
  type AccommodationKey,
} from "@/lib/roles";
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
import { checkInMessage, matchInviteMessage, whatsappLink, whatsappShareLink } from "@/lib/whatsapp";
import { pickCandidates, workersAsApplicants } from "@/lib/workers";
import Link from "next/link";
import { useLocalWorkers, workerPool } from "../workerStore";
import { getRecognition, voiceFor, speak, useMicSupported, useVoices, type Recognition } from "../speech";
import {
  Card,
  ChatIcon,
  CopyIcon,
  Logo,
  MicIcon,
  Notice,
  STATUS_STYLE,
  ScoreRing,
  Spinner,
  StepTitle,
  Stepper,
  primaryButton,
  secondaryButton,
  whatsappButton,
  type Message,
} from "../ui";

const NETWORK_ERROR = "The AI is busy right now. Please try again.";

// One tap fills in a realistic line. The first one is our demo job.
const EXAMPLES = [
  { label: "🍷 Wine shop counter", text: DEMO_JOB_LINE },
  {
    label: "⛽ Petrol pump attendant",
    text: "Need a petrol pump attendant in Hadapsar, Pune, ₹13,000 a month, day shift, must handle cash and UPI",
  },
  {
    label: "🛒 Kirana helper",
    text: "Need a helper for my kirana store in Karve Nagar, Pune, ₹11,000 a month, 9 am to 9 pm, must lift stock and do home delivery",
  },
  {
    label: "🍳 Café helper",
    text: "Need a kitchen helper for my café in Baner, Pune, ₹12,000 a month, 6 days a week, must know basic cutting and cleaning",
  },
  {
    label: "🛵 Delivery staff",
    text: "Need a delivery rider for my shop in Aundh, Pune, ₹14,000 a month, must have a bike and licence",
  },
];

// Shown next to each missing detail so the owner knows exactly what to add.
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

type CopyState = "idle" | "copied" | "failed";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<CopyState>("idle");
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={secondaryButton}
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

export default function HirePage() {
  // ---- Step 1 ----
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [postMessage, setPostMessage] = useState<Message>(null);
  const [missing, setMissing] = useState<RequiredDetail[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [accommodation, setAccommodation] = useState<AccommodationKey | null>(null);

  // ---- Village preview ----
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{
    marathi: string;
    hindi: string;
    questionsMarathi: string[];
    questionsHindi: string[];
  } | null>(null);
  const [previewMessage, setPreviewMessage] = useState<Message>(null);
  const [previewTab, setPreviewTab] = useState<"marathi" | "hindi">("marathi");
  const voices = useVoices();

  // ---- Voice input ----
  const micSupported = useMicSupported();
  const [micLang, setMicLang] = useState("mr-IN");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);

  // ---- Step 2 ----
  const [replies, setReplies] = useState("");
  const [fromSamples, setFromSamples] = useState(false);
  const [samplesNote, setSamplesNote] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [interviewTime, setInterviewTime] = useState("tomorrow at 11 am");
  const [ranking, setRanking] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [rankMessage, setRankMessage] = useState<Message>(null);

  // ---- Ranking pasted replies ----
  const [result, setResult] = useState<Ranking | null>(null);
  const [hiredId, setHiredId] = useState<string | null>(null);

  // ---- Best matches from the Kaam Pakka worker list ----
  const localWorkers = useLocalWorkers();
  const [matching, setMatching] = useState(false);
  const [matches, setMatches] = useState<Ranking | null>(null);
  const [matchMessage, setMatchMessage] = useState<Message>(null);
  const [checkedCount, setCheckedCount] = useState(0);

  const postRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const replyCount = useMemo(() => splitApplicants(replies).applicants.length, [replies]);
  const needsConsent = replies.trim() !== "" && !fromSamples;
  const step = matches ? 3 : job ? 2 : 1;

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
    setMatches(null);
    setMatchMessage(null);
  }

  // As soon as the job card is ready: plain code picks the closest workers from the list,
  // then the same ranking (✓/✗/? with proof, fairness rules) picks the best 3.
  async function findMatches(forJob: Job) {
    const candidates = pickCandidates(workerPool(localWorkers), forJob.roleKey);
    const applicants = workersAsApplicants(candidates);
    setCheckedCount(applicants.length);
    setMatches(null);
    setMatchMessage(null);
    if (applicants.length === 0) {
      setMatchMessage({ tone: "yellow", text: "No workers on the list yet." });
      return;
    }
    setMatching(true);
    const data = await postJson<RankResponse>(
      "/api/rank",
      {
        roleTitle: forJob.roleTitle,
        mustHaves: forJob.mustHaves.map(({ id, label }) => ({ id, label })),
        applicants: applicants.map(({ id, text }) => ({ id, text })),
      },
      21_000,
    );
    setMatching(false);
    if (data.status === "error") {
      setMatchMessage({ tone: "red", text: data.message });
      return;
    }
    setMatches(buildRanking(applicants, data.results, forJob.mustHaves, forJob.roleTitle, interviewTime));
  }

  // `spoken` is passed by voice input, which creates the post as soon as the owner stops talking.
  async function createPost(spoken?: string) {
    const text = (spoken ?? description).trim();
    setMissing([]);
    if (!text) {
      setPostMessage({ tone: "yellow", text: "Please describe the job" });
      return;
    }
    if (text.length > MAX_DESCRIPTION_CHARS) {
      setPostMessage({ tone: "yellow", text: "Please keep it to one or two lines" });
      return;
    }

    // A new line replaces the old job straight away, so an old post or ranking can never be
    // used with the new job, even if this request fails. The typed text stays.
    setCreating(true);
    setPostMessage(null);
    setJob(null);
    setAccommodation(null);
    clearAfterJobChange();
    const data = await postJson<CreatePostResponse>("/api/create-post", { description: text }, 16_000);
    setCreating(false);

    if (data.status === "error") {
      setPostMessage({ tone: "red", text: data.message });
    } else if (data.status === "missing") {
      setMissing(data.missing);
      setPostMessage({ tone: "yellow", text: `Please add: ${data.missing.join(", ")}` });
    } else {
      const newJob: Job = {
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
      };
      setJob(newJob);
      findMatches(newJob);
    }
  }

  function removeMustHave(id: string) {
    if (!job || job.mustHaves.length <= 1) return; // keep at least one to rank on
    const updated = { ...job, mustHaves: job.mustHaves.filter((m) => m.id !== id) };
    setJob(updated);
    clearAfterJobChange();
    findMatches(updated); // the must-haves changed, so check the matches again
  }

  function chooseAccommodation(key: AccommodationKey) {
    setAccommodation(key); // plain code: updates the card and post, no AI call
    setPreview(null); // the preview mentions where they'll stay, so make a fresh one
    setPreviewMessage(null);
  }

  function toggleMic() {
    const Recognition = getRecognition();
    if (!Recognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const r = new Recognition();
    r.lang = micLang;
    // Show words in the box while the owner is still speaking, instead of only at the end.
    r.interimResults = true;
    const before = description.trim();
    let line = before;
    r.onresult = (e) => {
      const said = Array.from(e.results)
        .map((res) => res[0].transcript)
        .join(" ")
        .trim();
      line = before ? `${before} ${said}` : said;
      setDescription(line);
    };
    // When they stop talking, write the post straight away: no extra tap needed.
    r.onend = () => {
      setListening(false);
      if (line.trim() && line.trim() !== before) createPost(line);
    };
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
        questions: job.questions,
      },
      16_000,
    );
    setPreviewing(false);
    if (data.status === "error") setPreviewMessage({ tone: "red", text: data.message });
    else
      setPreview({
        marathi: data.marathi,
        hindi: data.hindi,
        questionsMarathi: data.questionsMarathi,
        questionsHindi: data.questionsHindi,
      });
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

  const accommodationCard = ACCOMMODATION_OPTIONS.find((o) => o.key === accommodation)?.card;
  const post = job ? fullPost(job, accommodation) : "";
  const copyPostText = job
    ? `${post}\n\nPlease reply with your name, phone number and answers:\n${job.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : "";
  const previewQuestions = preview ? (previewTab === "marathi" ? preview.questionsMarathi : preview.questionsHindi) : [];
  const questionsHeading = previewTab === "marathi" ? "हे प्रश्न तुमच्या उत्तरात सांगा:" : "अपने जवाब में ये बताएं:";
  // What Listen reads and Share/Copy send: the preview, then the numbered questions.
  const previewText = preview
    ? [preview[previewTab], "", questionsHeading, ...previewQuestions.map((q, i) => `${i + 1}. ${q}`)].join("\n")
    : "";
  const previewVoice = voiceFor(voices, previewTab === "marathi" ? "mr" : "hi");

  return (
    <div className="flex flex-1 flex-col">
      {/* ---- Header ---- */}
      <header className="border-b border-brand-100 bg-white/70 px-4 pb-5 pt-6">
        <div className="mx-auto max-w-[480px]">
          <div className="flex items-start justify-between gap-3">
            <Link href="/" aria-label="Kaam Pakka home">
              <Logo />
            </Link>
            <span className="mt-2 rounded-full bg-go-50 px-3 py-1 text-center text-xs font-semibold leading-snug text-go-700 ring-1 ring-go-100">
              एक रुपया फीस नहीं · No fee for workers
            </span>
          </div>
          <p className="mt-3 text-[18px] font-semibold leading-snug">स्टाफ पक्का, काम पक्का</p>
          <p className="text-sm text-muted">Trusted staff. Confirmed jobs.</p>
          <p className="mt-3 text-base font-medium text-brand-700">A shortlist of 3 trusted workers, not 40 random calls.</p>
          <Stepper current={step} labels={["Describe job", "Best matches", "Invite"]} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-4 py-5">
        {/* ================= STEP 1 ================= */}
        <Card>
          <StepTitle step={1} title="Describe the job" hint="One line is enough: the role, pay and area." />

          <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => setDescription(ex.text)}
                className="min-h-11 shrink-0 rounded-full border border-brand-200 bg-brand-50 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-100"
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
            className="w-full rounded-2xl border-2 border-brand-100 bg-white p-4 text-base leading-relaxed outline-none transition placeholder:text-slate-400 focus:border-brand-500"
          />
          <div className="mb-3 mt-1 flex items-center justify-between gap-3 text-sm text-muted">
            {micSupported ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={listening ? "Stop voice input" : "Speak the job"}
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${listening ? "animate-pulse bg-stamp text-white" : "bg-brand-50 text-brand-700 ring-1 ring-brand-200"}`}
                >
                  <MicIcon />
                </button>
                <select
                  value={micLang}
                  onChange={(e) => setMicLang(e.target.value)}
                  aria-label="Voice language"
                  className="h-11 rounded-xl border border-brand-200 bg-white px-2 text-sm"
                >
                  {MIC_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                {listening && (
                  <span aria-live="polite" className="text-sm font-semibold text-stamp">
                    Listening… stop talking to create the post
                  </span>
                )}
              </div>
            ) : (
              <span />
            )}
            <span className={`shrink-0 ${description.length > MAX_DESCRIPTION_CHARS ? "font-bold text-danger" : ""}`}>
              {description.length}/{MAX_DESCRIPTION_CHARS}
            </span>
          </div>

          <button onClick={() => createPost()} disabled={creating || listening} className={`${primaryButton} w-full`}>
            {creating && <Spinner />}
            {creating ? "Writing your post… (up to 15 seconds)" : "Create post"}
          </button>

          <div aria-live="polite" className="mt-3 flex flex-col gap-2">
            <Notice message={postMessage} />
            {missing.length > 0 && (
              <ul className="flex flex-col gap-2">
                {missing.map((m) => (
                  <li key={m} className="flex items-center gap-2 rounded-xl bg-marigold-100/60 px-3 py-2 text-sm">
                    <span className="rounded-full bg-marigold-400 px-2 py-0.5 text-xs font-bold capitalize text-ink">{m}</span>
                    <span className="text-marigold-800">{MISSING_HINT[m]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* ---- Job card, post, questions, preview ---- */}
        {job && (
          <div ref={postRef} className="flex scroll-mt-4 flex-col gap-5">
            <Card>
              <h2 className="mb-3 text-xl font-bold">Job card</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
                {[
                  ["Role", job.roleTitle],
                  ["Openings", String(job.openings)],
                  ["Area", job.area],
                  ["Shift/hours", job.shift || "Not given"],
                  ["Pay", job.pay],
                  ["Accommodation", accommodationCard ?? "Not answered yet"],
                ].map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>

              <h3 className="mb-2 mt-5 text-base font-bold">Must-haves</h3>
              <ul className="flex flex-col gap-2">
                {job.mustHaves.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-base">
                    <span className="flex-1">{m.label}</span>
                    {m.source === "suggested" && (
                      <>
                        <span className="rounded-full bg-marigold-100 px-2 py-0.5 text-xs font-bold text-marigold-800">Suggested</span>
                        {job.mustHaves.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMustHave(m.id)}
                            aria-label={`Remove ${m.label}`}
                            className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-muted hover:bg-white"
                          >
                            ✕
                          </button>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted">ℹ️ {LEGAL_NOTE}</p>

              {/* The one follow-up question: plain code, no AI call. */}
              <h3 className="mb-2 mt-5 text-base font-bold">Is accommodation provided?</h3>
              <div className="grid grid-cols-2 gap-2">
                {ACCOMMODATION_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => chooseAccommodation(o.key)}
                    aria-pressed={accommodation === o.key}
                    className={`min-h-12 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${
                      accommodation === o.key ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-brand-700 ring-brand-200 hover:bg-brand-50"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Card>

            {/* ================= STEP 2: best matches, found automatically ================= */}
            <Card>
              <StepTitle
                step={2}
                title="Best matches for this job"
                hint="We checked the Kaam Pakka worker list against your must-haves. Invite the best ones for an interview."
              />

              <label htmlFor="when" className="mb-1 block text-base font-semibold">
                Interview time
              </label>
              <input
                id="when"
                value={interviewTime}
                onChange={(e) => setInterviewTime(e.target.value)}
                placeholder="e.g. tomorrow at 11 am"
                className="h-12 w-full rounded-xl border-2 border-brand-100 bg-white px-4 text-base outline-none focus:border-brand-500"
              />
              <p className="mt-1 text-sm text-muted">This goes into every WhatsApp invite below.</p>

              {matching && (
                <p className="mt-4 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-base font-medium text-brand-700" aria-live="polite">
                  <Spinner />
                  Checking {checkedCount} workers against your must-haves… (up to 20 seconds)
                </p>
              )}
              <div aria-live="polite" className="mt-3">
                <Notice message={matchMessage} />
              </div>
              {matchMessage?.tone === "red" && (
                <button type="button" onClick={() => findMatches(job)} className={`${secondaryButton} mt-3 w-full`}>
                  Try again
                </button>
              )}

              {matches && (
                <div className="mt-4 flex flex-col gap-4">
                  <p className="text-sm text-muted">
                    Checked {checkedCount} workers from the Kaam Pakka list
                    {localWorkers.length > 0 ? ` (including ${localWorkers.length} added on this phone)` : ""}.
                  </p>
                  {matches.notes.map((n) => (
                    <Notice key={n} message={{ tone: "yellow", text: n }} />
                  ))}
                  {matches.top.map((card, i) => (
                    <ResultCard
                      key={card.id}
                      card={card}
                      rank={i + 1}
                      hired={hiredId === card.id}
                      onHired={() => setHiredId(hiredId === card.id ? null : card.id)}
                      invite={matchInviteMessage(card.name, job, interviewTime)}
                      inviteLabel="Invite for interview on WhatsApp"
                      originalLabel="Show full profile"
                    />
                  ))}
                  {matches.top.length > 0 && (
                    <p className="px-1 text-sm text-muted">⚖️ Ranked only on job skills and availability — never on caste, religion or native place.</p>
                  )}
                  {matches.notEnoughInfo.length > 0 && (
                    <details className="rounded-2xl bg-slate-50 p-4">
                      <summary className="cursor-pointer text-base font-bold text-muted">Not a match ({matches.notEnoughInfo.length})</summary>
                      <ul className="mt-3 flex flex-col gap-2 text-sm">
                        {matches.notEnoughInfo.map((n) => (
                          <li key={n.id}>
                            <span className="block text-ink">{n.preview}</span>
                            <span className="text-muted">Why: {n.why}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              <Link href="/work" className="mt-4 block text-sm font-semibold text-brand-700 underline underline-offset-4">
                Know someone looking for work? Add them to the list →
              </Link>
            </Card>

            <Card>
              <h2 className="text-xl font-bold">Want more applicants? Share your post</h2>
              <p className="mb-3 mt-1 text-base text-muted">Post it in WhatsApp groups or on job sites. Paste the replies below when they come in.</p>
              <div className="chat-wall rounded-2xl p-3">
                <div className="ml-auto max-w-[94%] rounded-2xl rounded-tr-sm bg-go-50 p-3 shadow-sm ring-1 ring-go-100">
                  <p className="whitespace-pre-wrap text-base leading-relaxed">{post}</p>
                </div>
              </div>

              <h3 className="mb-2 mt-5 text-base font-bold">Screening questions</h3>
              <ol className="flex flex-col gap-2">
                {job.questions.map((q, i) => (
                  <li key={q} className="flex gap-3 rounded-xl bg-slate-50 px-3 py-2 text-base">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <span>{q}</span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => {
                  if (!preview && !previewing) makePreview();
                  document.getElementById("village-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="mt-2 min-h-11 text-base font-bold text-brand-700 underline underline-offset-4"
              >
                मराठी / हिंदी मध्ये + 🔊 Listen →
              </button>

              <div className="mt-5">
                <CopyButton text={copyPostText} label="Copy post" />
              </div>
            </Card>

            <Card id="village-preview">
              <h2 className="text-xl font-bold">For village candidates</h2>
              <p className="mb-3 mt-1 text-base text-muted">
                A short job preview and the screening questions in Marathi and Hindi, to send to village groups or read aloud.
              </p>
              <button onClick={makePreview} disabled={previewing} className={`${secondaryButton} w-full`}>
                {previewing && <Spinner />}
                {previewing ? "Making preview… (up to 15 seconds)" : "Make job preview for village candidates"}
              </button>
              <div aria-live="polite" className="mt-3">
                <Notice message={previewMessage} />
              </div>
              {preview && (
                <div className="rise-in mt-3">
                  <div role="tablist" className="mb-3 grid grid-cols-2 gap-2">
                    {(["marathi", "hindi"] as const).map((tab) => (
                      <button
                        key={tab}
                        role="tab"
                        aria-selected={previewTab === tab}
                        onClick={() => setPreviewTab(tab)}
                        className={`min-h-11 rounded-xl text-base font-bold ${previewTab === tab ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}
                      >
                        {tab === "marathi" ? "मराठी" : "हिंदी"}
                      </button>
                    ))}
                  </div>
                  <p className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-base leading-relaxed">{preview[previewTab]}</p>
                  {previewQuestions.length > 0 && (
                    <>
                      <h3 className="mb-2 mt-4 text-base font-bold">{questionsHeading}</h3>
                      <ol className="flex flex-col gap-2">
                        {previewQuestions.map((q, i) => (
                          <li key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-base">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                              {i + 1}
                            </span>
                            <span className="flex-1">{q}</span>
                            {previewVoice && (
                              <button
                                type="button"
                                onClick={() => speak(q, previewVoice)}
                                aria-label={`Listen to question ${i + 1}`}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg"
                              >
                                🔊
                              </button>
                            )}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {previewVoice ? (
                      <button type="button" onClick={() => speak(previewText, previewVoice)} className={secondaryButton}>
                        🔊 Listen to all
                      </button>
                    ) : (
                      <p className="flex items-center justify-center rounded-xl bg-slate-100 px-3 text-center text-sm text-muted">
                        Audio not available on this phone
                      </p>
                    )}
                    <a href={whatsappShareLink(previewText)} target="_blank" rel="noopener noreferrer" className={whatsappButton}>
                      <ChatIcon />
                      Share on WhatsApp
                    </a>
                  </div>
                  <div className="mt-2">
                    <CopyButton text={previewText} label="Copy" />
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ======== Optional: rank replies the owner got on WhatsApp ======== */}
        {job && (
        <details className="rise-in rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(20,43,110,0.08)] ring-1 ring-brand-100">
          <summary className="cursor-pointer text-lg font-bold">Got replies on WhatsApp? Rank them too</summary>
          <p className="mb-3 mt-2 text-base text-muted">
            Paste all replies at once. Put a blank line between people, or paste a copied WhatsApp chat.
          </p>

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
            className="w-full rounded-2xl border-2 border-brand-100 bg-white p-4 text-base leading-relaxed outline-none transition focus:border-brand-500 disabled:bg-slate-50"
          />
          <p className="mb-3 mt-1 text-sm text-muted">
            {replyCount > 0 ? `📋 ${replyCount} ${replyCount === 1 ? "reply" : "replies"} found` : "No replies yet? Load samples to try it."}
            {samplesNote && <span className="ml-2 font-semibold text-marigold-800">· {samplesNote}</span>}
          </p>

          <button onClick={loadSamples} disabled={!job || loadingSamples || ranking} className={`${secondaryButton} w-full`}>
            {loadingSamples && <Spinner />}
            {loadingSamples ? "Loading samples…" : "Load sample applicants"}
          </button>

          {/* Privacy (India's DPDP Act): say where replies go, and get consent for real ones. */}
          <p className="mt-4 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
            🔐 Replies are sent to Google&apos;s Gemini AI to be ranked and are not saved by Kaam Pakka.
          </p>
          {needsConsent && (
            <label className="mt-3 flex min-h-11 items-start gap-3 text-base">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-brand-600"
              />
              <span>These applicants agreed to share their replies with me for this job.</span>
            </label>
          )}

          <button
            onClick={rank}
            disabled={!job || ranking || loadingSamples || (needsConsent && !consent)}
            className={`${primaryButton} mt-4 w-full`}
          >
            {ranking && <Spinner />}
            {ranking ? "Checking each applicant… (up to 20 seconds)" : "Rank applicants"}
          </button>
          <div aria-live="polite" className="mt-3">
            <Notice message={rankMessage} />
          </div>
        </details>
        )}

        {/* ======== Top 3 from the pasted replies ======== */}
        {result && (
          <div ref={resultRef} aria-live="polite" className="flex scroll-mt-4 flex-col gap-4">
            <h2 className="px-1 text-xl font-bold leading-tight">Top 3 from your WhatsApp replies</h2>

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
              <p className="px-1 text-sm text-muted">⚖️ Ranked only on job skills and availability — never on caste, religion or native place.</p>
            )}

            {[...result.notEnoughInfo, ...result.unchecked].length > 0 && (
              <details className="rounded-3xl bg-white/70 p-5 ring-1 ring-slate-200">
                <summary className="cursor-pointer text-base font-bold text-muted">
                  Not enough info ({result.notEnoughInfo.length + result.unchecked.length})
                </summary>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {[...result.notEnoughInfo, ...result.unchecked].map((n) => (
                    <li key={n.id} className="rounded-xl bg-slate-50 px-3 py-2">
                      <span className="block text-ink">{n.preview}</span>
                      <span className="text-muted">Why: {n.why}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </main>

      <footer className="mt-auto bg-brand-900 px-4 py-4 text-center text-sm font-medium text-white">
        Pay only when a worker joins · Free replacement within 30 days · Workers never pay a fee
      </footer>
    </div>
  );
}

function ResultCard({
  card,
  rank,
  hired,
  onHired,
  invite,
  inviteLabel = "Send WhatsApp reminder",
  originalLabel = "Show original reply",
}: {
  card: RankedCard;
  rank: number;
  hired: boolean;
  onHired: () => void;
  invite?: string; // a different interview message (used for matches from the worker list)
  inviteLabel?: string;
  originalLabel?: string;
}) {
  const inviteLink = card.phone && invite ? whatsappLink(card.phone, invite) : card.whatsapp;
  return (
    <article
      className={`rise-in rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(20,43,110,0.08)] ring-1 ${rank === 1 ? "ring-2 ring-marigold-400" : "ring-brand-100"}`}
      style={{ animationDelay: `${(rank - 1) * 80}ms` }}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
          {rank}
        </span>
        <h3 className="min-w-0 flex-1 truncate text-lg font-bold">{card.name}</h3>
        <ScoreRing score={card.score} />
      </div>

      <p className="mt-3 text-base leading-relaxed">{card.reason}</p>

      <ul className="mt-3 flex flex-col gap-2">
        {card.checks.map((c) => (
          <li key={c.label} className="flex gap-3 text-base">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold ${STATUS_STYLE[c.status].chip}`}
              title={STATUS_STYLE[c.status].label}
            >
              {STATUS_STYLE[c.status].icon}
            </span>
            <span className="min-w-0">
              <span className="font-medium">{c.label}</span>
              <span className="block text-sm italic text-muted">{c.proof ? `“${c.proof}”` : "No proof found"}</span>
            </span>
          </li>
        ))}
      </ul>

      {card.strengths.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {card.strengths.map((s) => (
            <li key={s.text} className="text-sm">
              <span className="font-semibold text-go-700">+ {s.text}</span>{" "}
              <span className="italic text-muted">“{s.proof}”</span>
            </li>
          ))}
        </ul>
      )}

      {(card.canJoin || card.stay) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {card.canJoin && (
            <span className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-900 ring-1 ring-brand-100" title={`“${card.canJoin.proof}”`}>
              📅 Can join: {card.canJoin.text}
            </span>
          )}
          {card.stay && (
            <span className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-900 ring-1 ring-brand-100" title={`“${card.stay.proof}”`}>
              🏠 Stay: {card.stay.text}
            </span>
          )}
        </div>
      )}

      <details className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-base">
        <summary className="cursor-pointer font-medium text-brand-700">{originalLabel}</summary>
        <p className="mt-2 whitespace-pre-wrap text-muted">{card.text}</p>
      </details>

      {inviteLink ? (
        <div className="mt-4 flex flex-col gap-2">
          <a href={inviteLink} target="_blank" rel="noopener noreferrer" className={`${whatsappButton} w-full`}>
            <ChatIcon />
            {inviteLabel}
          </a>
          <button type="button" onClick={onHired} className={`${secondaryButton} w-full`}>
            {hired ? "Hide check-in message" : "Mark as hired"}
          </button>
          {hired && card.phone && (
            <div className="rise-in rounded-xl bg-go-50 p-3 text-sm ring-1 ring-go-100">
              <p className="font-semibold">Day-7 check-in message (send it after their first week):</p>
              <p className="mt-1 italic">{checkInMessage(card.name.startsWith("Applicant ") ? "" : card.name)}</p>
              <a
                href={whatsappLink(card.phone, checkInMessage(card.name.startsWith("Applicant ") ? "" : card.name))}
                target="_blank"
                rel="noopener noreferrer"
                className={`${whatsappButton} mt-2 w-full`}
              >
                <ChatIcon />
                Send check-in on WhatsApp
              </a>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-center text-base text-slate-400">No phone number found</p>
      )}
    </article>
  );
}
