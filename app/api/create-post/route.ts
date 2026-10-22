import {
  BadAiAnswerError,
  aiErrorResponse,
  askForJson,
  errorResponse,
  fixLineBreaks,
} from "@/lib/ai";
import {
  MAX_DESCRIPTION_CHARS,
  PostAiSchema,
  type CreatePostResponse,
} from "@/lib/schemas";

const SYSTEM = `You help owners of small businesses in Maharashtra, India (shops, cafés, garages, workshops, small warehouses) hire permanent semi-skilled staff, such as delivery riders, cooks, mechanic's helpers, packers and store assistants. The owner describes the job in one line.

Step 1: check the description has all four of these:
- role: what the worker will do (a general word like "staff" or "worker" alone is not a role)
- pay: an amount, in any form ("15k", "₹15,000 a month", "pandhra hazaar")
- area: a city, town or locality
- must-haves: at least one requirement the applicant must meet (a skill, a licence or document, or required days/hours)

If any are missing, set status "needs_info", list exactly the missing ones in "missing", and leave every other field empty. Never invent details the owner did not give.

Step 2: if all four are present, set status "ok" and fill in:
- jobTitle: a short job title in English, e.g. "Garage Helper", "Warehouse Packer"
- post: a polished job post ready to paste into WhatsApp groups and free job sites. Rewrite the owner's words properly: don't copy their sentence. Write it entirely in the same language and script the owner used (English, Hinglish in Roman letters, Hindi or Marathi), including the last line. Use this layout, one item per line:
  1. A headline with one fitting emoji, the job title and the area, e.g. "🔧 Garage Helper needed – Pune"
  2. "💰" pay, written clearly (e.g. "₹15,000 per month")
  3. "🕘" working days and/or hours, only if given
  4. "✅" one line per must-have
  5. A closing line asking applicants to reply with their name, phone number and a few lines about their experience
  If the owner wants more than one person, say how many in the headline. Use only facts the owner gave.
- mustHaves: 2 to 5 requirements taken from the description, each a short English noun phrase of 2–6 words that reads well after "Meets:", e.g. "Two-wheeler licence", "Basic two-wheeler servicing", "Can lift 25 kg boxes", "Works 6 days a week". Include required skills, licences or documents, and the working days/hours if stated. Each item is one single requirement: split "evening shift 4–10pm, 6 days" into "Evening shift 4–10pm" and "Works 6 days a week". Don't start them with "Must". Don't add requirements the owner didn't state, and don't include pay or area.
- questions: 3 to 5 short yes/no screening questions, in the owner's language and script, that check the must-haves and the practical basics of this specific job.
Leave "missing" empty.`;

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

    let result: CreatePostResponse;
    if (out.status === "needs_info") {
      result = { status: "needs_info", missing: out.missing };
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
        mustHaves: mustHaves.slice(0, 5),
        questions: questions.slice(0, 5),
      };
    }
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
