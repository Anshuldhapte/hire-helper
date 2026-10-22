// Ready-made must-haves for common roles, used only when the owner didn't write any.
// They are shown as "Suggested", and the owner can remove them.
// No legal rules here (e.g. age limits for liquor counters): those still need checking
// against Maharashtra excise rules, so the owner checks ID and legal needs at interview.
import type { RoleKey } from "./schemas";

const fullShift = (shift: string) => {
  const s = shift.replace(/\bshift\b/i, "").trim();
  return s ? `Available for the full ${s} shift` : "Available for the full shift asked";
};

export function suggestedMustHaves(roleKey: RoleKey, shift: string): string[] {
  switch (roleKey) {
    case "counter":
      return ["Handles cash and UPI accurately", "Can count stock or keep a stock register", fullShift(shift)];
    case "delivery":
      return ["Has a two-wheeler and licence", "Knows the local area"];
    case "kitchen":
      return ["Basic cutting and cleaning", "Follows kitchen hygiene"];
    case "helper":
    case "other":
      return ["Can lift and arrange stock", fullShift(shift)];
  }
}

// Shown at the end of every must-haves list. Not scored.
export const LEGAL_NOTE = "Owner checks ID and legal requirements at interview.";

// Always asked, because joining date and moving to the city decide who actually turns up.
export const FIXED_QUESTIONS = ["When can you join?", "Do you live in Pune now? If not, can you move here?"];

// The one follow-up question. The answer fills the job card and adds one line to the post.
export const ACCOMMODATION_OPTIONS = [
  { key: "free", label: "Yes, free", card: "Yes, free", postLine: "🏠 Free accommodation provided" },
  { key: "rent", label: "Yes, with rent cut from pay", card: "Yes, rent cut from pay", postLine: "🏠 Accommodation provided (rent cut from pay)" },
  { key: "help", label: "No, but I can help find a room", card: "No, owner helps find a room", postLine: "🏠 No accommodation, but we help you find a room" },
  { key: "no", label: "No", card: "Not provided", postLine: "🏠 Accommodation not provided" },
] as const;
export type AccommodationKey = (typeof ACCOMMODATION_OPTIONS)[number]["key"];

export const FEE_LINE = "We never ask for any fee or deposit.";

// "two", "2", "do", "don" → 2. Anything unclear → 1.
const NUMBER_WORDS: Record<string, number> = {
  one: 1, ek: 1, two: 2, do: 2, don: 2, three: 3, teen: 3, tin: 3, four: 4, char: 4, chaar: 4, five: 5, panch: 5, paach: 5,
};
export function parseOpenings(words: string): number {
  const digits = words.match(/\d+/);
  if (digits) return Math.min(Math.max(Number(digits[0]), 1), 20);
  for (const w of words.toLowerCase().split(/\W+/)) if (NUMBER_WORDS[w]) return NUMBER_WORDS[w];
  return 1;
}
