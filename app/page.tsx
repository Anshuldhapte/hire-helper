"use client";

import { useState } from "react";
import { buildRanking, splitApplicants, type Ranking } from "@/lib/applicants";
import {
  MAX_DESCRIPTION_CHARS,
  type CreatePostResponse,
  type Job,
  type RankResponse,
  type SamplesResponse,
  type Verdict,
} from "@/lib/schemas";

type Message = { tone: "yellow" | "red"; text: string } | null;

const NETWORK_ERROR = "Couldn't reach the AI. Please try again.";

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

// Modern clipboard API. Some browsers never answer, so give up after 1 second.
async function copyModern(text: string) {
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000));
  const write = navigator.clipboard
    .writeText(text)
    .then(() => true)
    .catch(() => false);
  return Promise.race([write, timeout]);
}

// Older copy method. Tried first because it works inside the tap itself, in nearly every browser.
function copyFallback(text: string) {
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

const VERDICT_MARK: Record<Verdict, { icon: string; className: string }> = {
  met: { icon: "✓", className: "text-green-700" },
  missed: { icon: "✗", className: "text-red-700" },
  unclear: { icon: "?", className: "text-zinc-500" },
};

function Notice({ message }: { message: Message }) {
  if (!message) return null;
  const colours =
    message.tone === "yellow"
      ? "border-yellow-300 bg-yellow-50 text-yellow-900"
      : "border-red-300 bg-red-50 text-red-900";
  return (
    <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${colours}`}>
      {message.text}
    </p>
  );
}

const button =
  "rounded-lg px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50";

export default function Home() {
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [postMessage, setPostMessage] = useState<Message>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const [replies, setReplies] = useState("");
  const [ranking, setRanking] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [rankMessage, setRankMessage] = useState<Message>(null);
  const [result, setResult] = useState<Ranking | null>(null);

  async function createPost() {
    const text = description.trim();
    if (!text) {
      setPostMessage({ tone: "yellow", text: "Please describe the job" });
      return;
    }
    if (text.length > MAX_DESCRIPTION_CHARS) {
      setPostMessage({
        tone: "yellow",
        text: `Please keep it to one or two lines (under ${MAX_DESCRIPTION_CHARS} characters).`,
      });
      return;
    }

    setCreating(true);
    setPostMessage(null);
    const data = await postJson<CreatePostResponse>(
      "/api/create-post",
      { description: text },
      14_000,
    );
    setCreating(false);

    if (data.status === "error") {
      // Keep the old post on screen: the owner can simply try again.
      setPostMessage({ tone: "red", text: data.message });
      return;
    }
    // A new description replaces the old job, so the old ranking no longer applies.
    setResult(null);
    setRankMessage(null);
    setCopyState("idle");
    if (data.status === "needs_info") {
      setJob(null);
      setPostMessage({
        tone: "yellow",
        text:
          data.missing.length > 0
            ? `Please add: ${data.missing.join(", ")}`
            : "Please add more details: role, pay, area and must-haves.",
      });
      return;
    }
    setJob({
      jobTitle: data.jobTitle,
      post: data.post,
      mustHaves: data.mustHaves,
      questions: data.questions,
    });
  }

  async function copyPost() {
    if (!job) return;
    const text = `${job.post}\n\nScreening questions:\n${job.questions
      .map((q, i) => `${i + 1}. ${q}`)
      .join("\n")}`;
    if (copyFallback(text) || (await copyModern(text))) {
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } else {
      setCopyState("failed");
    }
  }

  // Practice replies written for the job on screen (plus 2 junk replies added by the server).
  async function loadSamples() {
    if (!job) return;
    setLoadingSamples(true);
    setRankMessage(null);
    setResult(null);
    const data = await postJson<SamplesResponse>(
      "/api/samples",
      { jobTitle: job.jobTitle, mustHaves: job.mustHaves },
      14_000,
    );
    setLoadingSamples(false);
    if (data.status === "error") {
      setRankMessage({ tone: "red", text: data.message });
      return;
    }
    setReplies(data.text);
  }

  async function rank() {
    if (!job) return;
    const { applicants, truncated } = splitApplicants(replies);
    if (applicants.length === 0) {
      setRankMessage({
        tone: "yellow",
        text: "Please paste replies or tap Load sample applicants",
      });
      setResult(null);
      return;
    }

    const usable = applicants.filter((a) => !a.junk);
    setRankMessage(null);
    setResult(null); // never leave old results next to new replies or an error
    let checked: Extract<RankResponse, { status: "ok" }>["results"] = [];

    // Only call the AI when at least one reply is worth checking.
    if (usable.length > 0) {
      setRanking(true);
      const data = await postJson<RankResponse>(
        "/api/rank",
        {
          jobTitle: job.jobTitle,
          mustHaves: job.mustHaves,
          applicants: usable.map(({ id, text }) => ({ id, text })),
        },
        19_000,
      );
      setRanking(false);
      if (data.status === "error") {
        setRankMessage({ tone: "red", text: data.message });
        return;
      }
      checked = data.results;
    }

    setResult(buildRanking(applicants, checked, job.mustHaves, job.jobTitle, truncated));
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 bg-white px-4 py-6 text-zinc-900">
      <header>
        <h1 className="text-2xl font-bold">Hire Helper</h1>
        <p className="text-sm text-zinc-600">
          Describe the job, share the post, then rank your applicants.
        </p>
      </header>

      {/* ---- Section 1: Describe the job ---- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">1. Describe the job</h2>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="e.g. Need a helper for my two-wheeler garage in Pune, ₹15,000 a month, 6 days a week, must know basic servicing and have a two-wheeler licence"
          className="rounded-lg border border-zinc-300 p-3 text-base"
        />
        <button
          onClick={createPost}
          disabled={creating}
          className={`${button} bg-zinc-900 text-white`}
        >
          {creating ? "Creating…" : "Create post"}
        </button>
        <Notice message={postMessage} />

        {job && (
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3">
            <p className="whitespace-pre-wrap text-sm">{job.post}</p>

            <div>
              <h3 className="text-sm font-semibold">Must-haves (used for ranking)</h3>
              <ul className="list-disc pl-5 text-sm">
                {job.mustHaves.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Screening questions</h3>
              <ol className="list-decimal pl-5 text-sm">
                {job.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </div>

            <button onClick={copyPost} className={`${button} bg-zinc-100 text-zinc-900`}>
              {copyState === "copied" ? "Copied!" : "Copy"}
            </button>
            {copyState === "failed" && (
              <Notice
                message={{
                  tone: "yellow",
                  text: "Couldn't copy. Press and hold the text to copy it.",
                }}
              />
            )}
          </div>
        )}
      </section>

      {/* ---- Section 2: Applicants ---- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">2. Rank applicants</h2>
        <textarea
          value={replies}
          onChange={(e) => setReplies(e.target.value)}
          rows={8}
          placeholder="Paste replies here. Leave a blank line between each applicant."
          className="rounded-lg border border-zinc-300 p-3 text-base"
        />
        <div className="flex gap-2">
          <button
            onClick={loadSamples}
            disabled={!job || loadingSamples || ranking}
            className={`${button} flex-1 bg-zinc-100 text-zinc-900`}
          >
            {loadingSamples ? "Loading samples…" : "Load sample applicants"}
          </button>
          <button
            onClick={rank}
            disabled={!job || ranking || loadingSamples}
            className={`${button} flex-1 bg-zinc-900 text-white`}
          >
            {ranking ? "Ranking…" : "Rank"}
          </button>
        </div>
        {!job && <p className="text-sm text-zinc-500">Create a job post first.</p>}
        <Notice message={rankMessage} />

        {result && (
          <div className="flex flex-col gap-3">
            {result.notes.map((note) => (
              <Notice key={note} message={{ tone: "yellow", text: note }} />
            ))}

            {result.top.map((card, i) => (
              <article
                key={card.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">
                    #{i + 1} {card.name}
                  </h3>
                  <span className="text-lg font-bold">{card.score}/100</span>
                </div>
                <p className="text-sm">{card.reason}</p>
                <ul className="text-sm">
                  {card.verdicts.map((v) => (
                    <li key={v.mustHave}>
                      <span className={`font-bold ${VERDICT_MARK[v.result].className}`}>
                        {VERDICT_MARK[v.result].icon}
                      </span>{" "}
                      {v.mustHave}
                    </li>
                  ))}
                </ul>
                <details className="text-sm text-zinc-600">
                  <summary>Their reply</summary>
                  <p className="mt-1 whitespace-pre-wrap">{card.text}</p>
                </details>
                {card.whatsapp ? (
                  <a
                    href={card.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${button} bg-green-600 text-center text-white`}
                  >
                    Send WhatsApp reminder
                  </a>
                ) : (
                  <p className="text-sm text-zinc-500">No phone number found</p>
                )}
              </article>
            ))}

            {result.notEnoughInfo.length > 0 && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-zinc-500">
                <h3 className="text-sm font-semibold">Not enough info</h3>
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {result.notEnoughInfo.map((a) => (
                    <li key={a.id} className="whitespace-pre-wrap">
                      {a.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.unchecked.length > 0 && (
              <div className="rounded-lg border border-zinc-200 p-3 text-zinc-500">
                <h3 className="text-sm font-semibold">Couldn&apos;t check</h3>
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {result.unchecked.map((a) => (
                    <li key={a.id} className="whitespace-pre-wrap">
                      {a.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
