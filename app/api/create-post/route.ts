import {
  BadAiAnswerError,
  aiErrorResponse,
  askForJson,
  errorResponse,
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
- jobTitle: a short job title, e.g. "Garage Helper"
- post: a short, friendly job post ready to share on WhatsApp and free job sites, in the same language the owner wrote in. Include the role, type of business, pay, working days/hours if given, area, the must-haves, and end with "Reply with your name, phone number and a few lines about your experience." Use only the facts the owner gave.
- mustHaves: 2 to 5 short requirements taken from the description: required skills, licences or documents, and the working days/hours if stated. Do not add requirements the owner didn't state, and do not include pay or area.
- questions: 3 to 5 short yes/no screening questions, in the owner's language, that check the must-haves and the practical basics of this specific job.
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
      timeoutMs: 14_000,
    });

    let result: CreatePostResponse;
    if (out.status === "needs_info") {
      result = { status: "needs_info", missing: out.missing };
    } else {
      const mustHaves = out.mustHaves.map((m) => m.trim()).filter(Boolean);
      const questions = out.questions.map((q) => q.trim()).filter(Boolean);
      if (!out.post.trim() || mustHaves.length === 0 || questions.length < 3)
        throw new BadAiAnswerError("post, must-haves or questions missing");
      result = {
        status: "ok",
        jobTitle: out.jobTitle.trim() || "Job",
        post: out.post.trim(),
        mustHaves: mustHaves.slice(0, 5),
        questions: questions.slice(0, 5),
      };
    }
    return Response.json(result);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
