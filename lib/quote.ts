// Checks that words the AI says it copied really are in the original text, so the AI
// can't tick a must-have or "find" a salary that nobody wrote.

// Compares text loosely: ignores case, punctuation and extra spaces, so "Licence hai." matches "licence hai".
const loose = (text: string) =>
  text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,!?;:'"()[\]\-–—।…₹]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function quoteIsIn(quote: string, text: string) {
  const q = loose(quote);
  return q.length >= 2 && loose(text).includes(q);
}
