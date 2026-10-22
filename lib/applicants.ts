import {
  MAX_APPLICANTS,
  MAX_REPLY_CHARS,
  type CheckedApplicant,
  type Verdict,
} from "./schemas";
import { interviewMessage, whatsappLink } from "./whatsapp";

export type Applicant = {
  id: string;
  text: string;
  phone: string | null; // 91XXXXXXXXXX
  junk: boolean; // obviously empty or meaningless, so never sent to the AI
};

// Indian mobile: optional +91 / 91 / 0, then 10 digits starting 6–9, spaces or dashes allowed.
const PHONE_PATTERN = /(?:^|\D)(?:\+?91[\s-]*|0)?([6-9](?:[\s-]*\d){9})(?!\d)/;

// A "word" counts only if it has a letter (English or Devanagari), so numbers and emoji don't.
const HAS_LETTER = /[a-zA-Zऀ-ॿ]/;
const MIN_WORDS = 3;

// Marathi/Hindi keyboards type digits as ०१२३४५६७८९; read them as 0–9.
const toLatinDigits = (text: string) =>
  text.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));

export function findPhone(text: string): string | null {
  const match = toLatinDigits(text).match(PHONE_PATTERN);
  return match ? "91" + match[1].replace(/\D/g, "") : null;
}

function wordsWithLetters(text: string) {
  return text.split(/\s+/).filter((word) => HAS_LETTER.test(word));
}

// A message line copied from WhatsApp, on iPhone or Android:
//   [22/10/26, 4:12 pm] +91 98901 23456: Hi sir...
//   22/10/26, 4:12 pm - Rohit: Hi sir...
const WHATSAPP_LINE =
  /^\[?\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?\]?\s*(?:-\s*)?([^:]{1,60}):\s*(.*)$/i;

// Copied WhatsApp chats have no blank lines, so group the messages by who sent them.
function splitWhatsAppChat(lines: string[]) {
  const bySender = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of lines) {
    const match = line.match(WHATSAPP_LINE);
    if (match) {
      const sender = match[1].trim();
      if (!bySender.has(sender)) bySender.set(sender, []);
      current = bySender.get(sender)!;
      if (match[2].trim()) current.push(match[2].trim());
    } else if (current && line.trim()) {
      current.push(line.trim()); // a message that runs over several lines
    }
  }
  return [...bySender].map(([sender, messages]) => `${sender}\n${messages.join("\n")}`);
}

export function splitApplicants(raw: string) {
  // Copying from WhatsApp can add invisible direction marks; remove them first.
  const lines = raw.replace(/[‎‏]/g, "").split(/\r?\n/);
  const isWhatsAppChat = lines.some((line) => WHATSAPP_LINE.test(line));

  const blocks = isWhatsAppChat
    ? splitWhatsAppChat(lines)
    : raw
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter((block) => block.length > 0);

  const applicants: Applicant[] = blocks
    .slice(0, MAX_APPLICANTS)
    .map((block, i) => {
      const text = block.slice(0, MAX_REPLY_CHARS);
      return {
        id: `A${i + 1}`,
        text,
        phone: findPhone(text),
        junk: wordsWithLetters(text).length < MIN_WORDS,
      };
    });

  return { applicants, truncated: blocks.length > MAX_APPLICANTS };
}

// Used when the AI couldn't find a name: the first two words of the reply.
function fallbackName(text: string) {
  return wordsWithLetters(text.split("\n")[0]).slice(0, 2).join(" ") || "Applicant";
}

// Must-haves are worth up to 90 points, shared equally: met = full, unclear = half, missed = 0.
// Each extra strength adds 5 (at most 2), so equally qualified applicants rarely tie.
export function scoreOf(verdicts: Verdict[], strengths: string[]) {
  if (verdicts.length === 0) return 0;
  const points = verdicts.reduce(
    (sum, v) => sum + (v === "met" ? 1 : v === "unclear" ? 0.5 : 0),
    0,
  );
  return Math.round((90 * points) / verdicts.length) + 5 * Math.min(strengths.length, 2);
}

export function reasonOf(mustHaves: string[], verdicts: Verdict[], strengths: string[]) {
  const pick = (want: Verdict) =>
    mustHaves.filter((_, i) => verdicts[i] === want).join(", ");
  const allMet = verdicts.length > 0 && verdicts.every((v) => v === "met");
  const parts = [
    allMet ? `Meets all ${verdicts.length} must-haves.` : pick("met") && `Meets: ${pick("met")}.`,
    pick("missed") && `Missing: ${pick("missed")}.`,
    pick("unclear") && `Not clear: ${pick("unclear")}.`,
    strengths.length > 0 && `Plus: ${strengths.join(", ")}.`,
  ];
  return parts.filter(Boolean).join(" ");
}

export type RankedCard = {
  id: string;
  name: string;
  score: number;
  reason: string;
  verdicts: { mustHave: string; result: Verdict }[];
  text: string;
  phone: string | null;
  whatsapp: string | null;
};

export type Ranking = {
  top: RankedCard[];
  notEnoughInfo: Applicant[];
  unchecked: Applicant[];
  notes: string[];
};

export function buildRanking(
  applicants: Applicant[],
  checked: CheckedApplicant[],
  mustHaves: string[],
  jobTitle: string,
  truncated: boolean,
): Ranking {
  const byId = new Map(checked.map((c) => [c.id, c]));
  const notEnoughInfo: Applicant[] = [];
  const unchecked: Applicant[] = [];
  const scored: RankedCard[] = [];

  for (const applicant of applicants) {
    if (applicant.junk) {
      notEnoughInfo.push(applicant);
      continue;
    }
    const result = byId.get(applicant.id);
    if (!result) {
      unchecked.push(applicant);
      continue;
    }
    if (!result.enoughInfo) {
      notEnoughInfo.push(applicant);
      continue;
    }
    const name = result.name.trim() || fallbackName(applicant.text);
    scored.push({
      id: applicant.id,
      name,
      score: scoreOf(result.verdicts, result.strengths),
      reason: reasonOf(mustHaves, result.verdicts, result.strengths),
      verdicts: mustHaves.map((mustHave, i) => ({
        mustHave,
        result: result.verdicts[i],
      })),
      text: applicant.text,
      phone: applicant.phone,
      whatsapp: applicant.phone
        ? whatsappLink(applicant.phone, interviewMessage(name, jobTitle))
        : null,
    });
  }

  // Array sort is stable, so equal scores keep the order they were pasted in.
  const top = scored.sort((a, b) => b.score - a.score).slice(0, 3);

  const notes: string[] = [];
  if (truncated) notes.push(`Only the first ${MAX_APPLICANTS} replies were checked.`);
  if (top.length === 0) notes.push("No replies had enough info to rank.");
  else if (top.length < 3)
    notes.push(
      `Only ${top.length} applicant${top.length === 1 ? "" : "s"} had enough info.`,
    );
  if (unchecked.length > 0)
    notes.push(`Couldn't check ${unchecked.length} replies. Tap Rank again.`);

  return { top, notEnoughInfo, unchecked, notes };
}
