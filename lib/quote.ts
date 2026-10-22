// Checks that words the AI says it copied really are in the original text, so the AI
// can't tick a must-have or "find" a salary that nobody wrote.

// Marathi and Hindi keyboards type digits as ०१२३४५६७८९; turn them into 0–9.
export const toLatinDigits = (text: string) =>
  text.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));

// Lower case, ₹ / Rs / rs treated the same, punctuation ignored, spaces collapsed,
// so "Rs. 12,000" matches "₹12,000" and "Licence hai." matches "licence hai".
export function normalize(text: string) {
  return toLatinDigits(text)
    .normalize("NFC")
    .toLowerCase()
    .replace(/₹|\brs\b\.?/g, " rs ")
    .replace(/[.,!?;:'"“”‘’()[\]{}\-–—।॥…*_/\\|@#&+=<>~`^%$]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteIsIn(quote: string, text: string) {
  const q = normalize(quote);
  return q.length >= 2 && normalize(text).includes(q);
}

// For short answers like "2": the same words must appear as whole words, so "2" matches
// "Need 2 counter staff" but not "₹12,000".
export function wordsAreIn(words: string, text: string) {
  const w = normalize(words);
  return w.length > 0 && ` ${normalize(text)} `.includes(` ${w} `);
}

// Just the digits of an amount, e.g. "₹12,000" → "12000", "१२,०००" → "12000".
export const digitsOf = (text: string) => toLatinDigits(text).replace(/[^\d]/g, "");
