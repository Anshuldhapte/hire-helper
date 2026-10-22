import {
  BadAiAnswerError,
  aiErrorResponse,
  askForJson,
  errorResponse,
  fixLineBreaks,
} from "@/lib/ai";
import {
  SamplesAiSchema,
  SamplesRequestSchema,
  type SamplesResponse,
} from "@/lib/schemas";

const SYSTEM = `You write practice data for a hiring app used by small business owners in Maharashtra, India. Given a job title and its must-haves, write exactly 6 short, realistic WhatsApp replies from people applying for that job.

- Each reply is 1–3 lines. The first line is the applicant's name (a common Maharashtrian or Indian name); the rest is what they wrote.
- Mix the language: mostly simple English and Hinglish (Roman letters), and exactly one reply in Marathi (Devanagari).
- Make 2 applicants who clearly meet every must-have and mention one extra plus point (years of experience, living nearby, or can join soon); 2 who meet some must-haves but clearly miss at least one; 2 who meet few or none.
- One of the two strong applicants gives no phone number. Every other reply ends with a different 10-digit Indian mobile number starting with 7, 8 or 9.
- Put them in a mixed order, not best first.`;

// Always added, so every practice set checks the "Not enough info" rule.
const JUNK_REPLIES = ["Kiran\n9890011223", "hello hello ok ok 😀 9922334455"];

export async function POST(request: Request) {
  const parsed = SamplesRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return errorResponse("Create a job post first.", 400);
  const { jobTitle, mustHaves } = parsed.data;

  const prompt = [
    `Job: ${jobTitle}`,
    "Must-haves:",
    ...mustHaves.map((m, i) => `${i + 1}. ${m}`),
  ].join("\n");

  try {
    const out = await askForJson({
      system: SYSTEM,
      prompt,
      schema: SamplesAiSchema,
      timeoutMs: 12_000,
    });
    const replies = out.replies
      .map((r) => fixLineBreaks(r).trim())
      .filter(Boolean)
      .slice(0, 6);
    if (replies.length < 4) throw new BadAiAnswerError("too few sample replies");

    // Junk goes in the middle and at the end, the way real replies arrive.
    const all = [...replies.slice(0, 3), JUNK_REPLIES[0], ...replies.slice(3), JUNK_REPLIES[1]];
    return Response.json({
      status: "ok",
      text: all.join("\n\n"),
    } satisfies SamplesResponse);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
