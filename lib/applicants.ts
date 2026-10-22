// Plain code for the ranking step: no AI here, so the same input always gives the same result.
import { MAX_APPLICANTS, MAX_REPLY_CHARS, type CheckStatus, type CheckedApplicant, type MustHave, type ProofedText } from "./schemas";
import { toLatinDigits } from "./quote";
import { interviewMessage, whatsappLink } from "./whatsapp";

export type Applicant = {
  id: string;
  index: number; // 1 = first reply pasted
  text: string; // what the AI sees (sender name first, for WhatsApp chats)
  phone: string | null; // 10 digits
  senderName: string | null; // WhatsApp contact name, if it isn't a number
  junkReason: string | null; // set → "Not enough info" without asking the AI
};

// Indian mobile: optional +91 / 91 / 0, then 10 digits starting 6–9, spaces or hyphens allowed.
const PHONE_PATTERN = /(?:^|\D)(?:\+?91[\s-]*|0)?([6-9](?:[\s-]*\d){9})(?!\d)/;

export function findPhone(text: string): string | null {
  const match = toLatinDigits(text).match(PHONE_PATTERN);
  return match ? match[1].replace(/\D/g, "") : null;
}

// A WhatsApp message line, in the formats phones use when you copy a chat:
//   [22/10/26, 3:29:47 PM] Rahul Patil: message
//   22/10/26, 3:29 pm - Rahul Patil: message
//   [3:29 pm, 22/10/2026] Rahul Patil: message
const DATE = String.raw`\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}`;
const TIME = String.raw`\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?`;
const WHATSAPP_LINE = new RegExp(
  String.raw`^\[?(?:${DATE},?\s+${TIME}|${TIME},?\s+${DATE})\]?\s*(?:-\s*)?([^:]{1,60}):\s*(.*)$`,
  "i",
);

type Block = { body: string; sender: string | null };

// Copied chats have no blank lines, so group messages by who sent them.
function splitWhatsAppChat(lines: string[]): Block[] {
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
  return [...bySender].map(([sender, messages]) => ({ sender, body: messages.join("\n") }));
}

const HAS_LETTER = /[a-zA-Zऀ-ॿ]/;
const MIN_WORDS = 5;

export function junkReason(body: string): string | null {
  const text = body.trim();
  if (!text) return "Blank reply";
  if (!HAS_LETTER.test(text)) return "Only emoji or punctuation";
  const withoutPhone = toLatinDigits(text).replace(PHONE_PATTERN, " ");
  const words = withoutPhone.split(/\s+/).filter((w) => HAS_LETTER.test(w));
  if (words.length < MIN_WORDS) return "Too short";
  return null;
}

export function splitApplicants(raw: string) {
  // Copying from WhatsApp can add invisible direction marks; remove them first.
  const lines = toLatinDigits(raw.replace(/[‎‏]/g, "")).split(/\r?\n/);
  const isChat = lines.some((line) => WHATSAPP_LINE.test(line));

  const blocks: Block[] = isChat
    ? splitWhatsAppChat(lines)
    : lines
        .join("\n")
        .split(/\n\s*\n/)
        .map((b) => ({ body: b.trim(), sender: null }))
        .filter((b) => b.body);

  const applicants: Applicant[] = blocks.slice(0, MAX_APPLICANTS).map((b, i) => {
    const senderPhone = b.sender ? findPhone(b.sender) : null;
    const senderName = b.sender && !senderPhone ? b.sender : null;
    const text = (b.sender ? `${b.sender}\n${b.body}` : b.body).slice(0, MAX_REPLY_CHARS);
    return {
      id: `A${i + 1}`,
      index: i + 1,
      text,
      phone: findPhone(b.body) ?? senderPhone,
      senderName,
      junkReason: junkReason(b.body),
    };
  });

  return { applicants, tooMany: blocks.length > MAX_APPLICANTS };
}

// Must-haves share 90 points equally: met = full, unclear = half, missed = 0.
// Each kept strength adds 5 (at most 2).
export function scoreOf(statuses: CheckStatus[], strengthCount: number) {
  const bonus = 5 * Math.min(strengthCount, 2);
  if (statuses.length === 0) return bonus;
  const each = 90 / statuses.length;
  const points = statuses.reduce((sum, s) => sum + (s === "met" ? each : s === "unclear" ? each / 2 : 0), 0);
  return Math.round(points + bonus);
}

export function reasonOf(labels: string[], statuses: CheckStatus[]) {
  const pick = (want: CheckStatus) => labels.filter((_, i) => statuses[i] === want).join(", ");
  return [
    pick("met") && `Meets: ${pick("met")}.`,
    pick("missed") && `Missing: ${pick("missed")}.`,
    pick("unclear") && `Unclear: ${pick("unclear")}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export type RankedCard = {
  id: string;
  name: string;
  score: number;
  reason: string;
  checks: { label: string; status: CheckStatus; proof: string }[];
  strengths: ProofedText[];
  canJoin: ProofedText | null;
  stay: ProofedText | null;
  text: string;
  phone: string | null;
  whatsapp: string | null;
};

export type NotEnoughInfo = { id: string; preview: string; why: string };

export type Ranking = {
  top: RankedCard[];
  notEnoughInfo: NotEnoughInfo[];
  unchecked: NotEnoughInfo[];
  notes: string[];
};

const previewOf = (text: string) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 60 ? `${flat.slice(0, 60)}…` : flat;
};

export function buildRanking(
  applicants: Applicant[],
  checked: CheckedApplicant[],
  mustHaves: Pick<MustHave, "label">[],
  roleTitle: string,
  interviewTime: string,
): Ranking {
  const byId = new Map(checked.map((c) => [c.id, c]));
  const notEnoughInfo: NotEnoughInfo[] = [];
  const unchecked: NotEnoughInfo[] = [];
  const scored: (RankedCard & { metCount: number; index: number })[] = [];

  for (const a of applicants) {
    const note = (why: string) => ({ id: a.id, preview: previewOf(a.text), why });
    if (a.junkReason) {
      notEnoughInfo.push(note(a.junkReason));
      continue;
    }
    const r = byId.get(a.id);
    if (!r) {
      unchecked.push(note("Couldn't check this one. Tap Rank applicants again."));
      continue;
    }
    if (!r.enoughInfo) {
      notEnoughInfo.push(note("Doesn't really answer the job"));
      continue;
    }
    if (mustHaves.length > 0 && !r.checks.some((c) => c.proof)) {
      notEnoughInfo.push(note("No proof for any must-have"));
      continue;
    }
    const statuses = r.checks.map((c) => c.status);
    const name = r.name.trim() || a.senderName || `Applicant ${a.index}`;
    scored.push({
      id: a.id,
      index: a.index,
      name,
      score: scoreOf(statuses, r.strengths.length),
      metCount: statuses.filter((s) => s === "met").length,
      reason: reasonOf(mustHaves.map((m) => m.label), statuses),
      checks: mustHaves.map((m, i) => ({ label: m.label, ...r.checks[i] })),
      strengths: r.strengths,
      canJoin: r.canJoin,
      stay: r.stay,
      text: a.text,
      phone: a.phone,
      whatsapp: a.phone
        ? whatsappLink(a.phone, interviewMessage(r.name.trim() || a.senderName || "", roleTitle, interviewTime))
        : null,
    });
  }

  // Best score first; ties go to more ✓, then to whoever replied first.
  scored.sort((x, y) => y.score - x.score || y.metCount - x.metCount || x.index - y.index);
  const top = scored.slice(0, 3);

  const notes: string[] = [];
  if (top.length === 0) notes.push("No replies had enough information to rank.");
  else if (top.length < 3)
    notes.push(`Only ${top.length} applicant${top.length === 1 ? "" : "s"} had enough information to rank.`);

  return { top, notEnoughInfo, unchecked, notes };
}
