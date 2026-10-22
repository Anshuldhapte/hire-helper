import {
  BadAiAnswerError,
  aiErrorResponse,
  askForJson,
  errorResponse,
  fixLineBreaks,
} from "@/lib/ai";
import { quoteIsIn } from "@/lib/quote";
import {
  MAX_DESCRIPTION_CHARS,
  MISSING_DETAILS,
  PostAiSchema,
  type CreatePostResponse,
  type MissingDetail,
} from "@/lib/schemas";

const FOUND_KEY: Record<MissingDetail, "role" | "pay" | "area" | "mustHave"> = {
  role: "role",
  pay: "pay",
  area: "area",
  "must-haves": "mustHave",
};

const SYSTEM = `You help owners of small businesses in Maharashtra, India (shops, cafés, garages, workshops, small warehouses) hire permanent semi-skilled staff, such as delivery riders, cooks, mechanic's helpers, packers and store assistants. The owner describes the job in one line.

Step 1: in "found", copy the owner's exact words (same spelling and script, no changes) for each of these, or an empty string if the owner didn't write it:
- role: what the worker will do, e.g. "helper for my two-wheeler garage", "cook", "packers". A general word like "staff" or "worker" alone is not a role: leave it empty.
- pay: the amount they wrote, in any form, e.g. "15k", "₹15,000 a month", "pandhra hazaar". Never fill in words like "as discussed" or "negotiable" that the owner didn't write; if no amount is written, leave it empty.
- area: the city, town or locality, e.g. "Pune", "Bhosari MIDC"
- mustHave: one requirement the applicant must meet, e.g. "must know chinese and tandoor", "basic servicing", "25 kilo box uthana", "own bike", "6 days".

Step 2: only if all four are found, fill in the rest. If any is empty, leave jobTitle, post, mustHaves and questions empty.
- jobTitle: a short job title in English, e.g. "Garage Helper", "Warehouse Packer"
- post: a polished job post ready to paste into WhatsApp groups and free job sites. Rewrite the owner's words properly: don't copy their sentence. Write it entirely in the same language and script the owner used (English, Hinglish in Roman letters, Hindi or Marathi), including the last line. Use this layout, one item per line:
  1. A headline with one fitting emoji, the job title and the area, e.g. "🔧 Garage Helper needed – Pune"
  2. "💰" pay, written clearly (e.g. "₹15,000 per month")
  3. "🕘" working days and/or hours, only if given
  4. "✅" one line per must-have
  5. A closing line asking applicants to reply with their name, phone number and a few lines about their experience
  If the owner wants more than one person, say how many in the headline. Use only facts the owner gave.
- mustHaves: 2 to 6 requirements taken from the description, each a short English noun phrase of 2–6 words that reads well after "Meets:", e.g. "Two-wheeler licence", "Basic two-wheeler servicing", "Can lift 25 kg boxes", "Works 6 days a week". Include required skills, licences or documents, and the working days/hours if stated. Each item must be ONE thing an applicant can have or not have on its own, so split anything joined by "with", "and", or a comma: "smartphone with Google Maps" becomes "Smartphone" and "Can use Google Maps"; "evening shift 4–10pm, 6 days" becomes "Evening shift 4–10pm" and "Works 6 days a week". Don't start them with "Must". Don't add requirements the owner didn't state, and don't include pay or area.
- questions: 3 to 5 short yes/no screening questions, in the owner's language and script, that check the must-haves and the practical basics of this specific job.`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";

  if (!description) return errorResponse("Please describe the job", 400);
  if (description.length > MAX_DESCRIPTION_CHARS)
    return errorResponse(
      `Please keep it to one or two lines (under ${MAX_DESCRIPTION_CHARS} characters).`,
      400,
    );

  try {
    const out = await askForJson({
      system: SYSTEM,
      prompt: description,
      schema: PostAiSchema,
      timeoutMs: 12_000,
    });

    // Code, not the AI, decides what's missing: a detail counts only if the words the
    // AI copied really are in the owner's description.
    const missing = MISSING_DETAILS.filter(
      (detail) => !quoteIsIn(out.found[FOUND_KEY[detail]], description),
    );

    let result: CreatePostResponse;
    if (missing.length > 0) {
      result = { status: "needs_info", missing };
    } else {
      const mustHaves = out.mustHaves.map((m) => m.trim()).filter(Boolean);
      const questions = out.questions.map((q) => q.trim()).filter(Boolean);
      const post = fixLineBreaks(out.post).trim();
      if (!post || mustHaves.length === 0 || questions.length < 3)
        throw new BadAiAnswerError("post, must-haves or questions missing");
      result = {
        status: "ok",
        jobTitle: out.jobTitle.trim() || "Job",
        post,
        mustHaves: mustHaves.slice(0, 6),
        questions: questions.slice(0, 5),
      };
    }
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
