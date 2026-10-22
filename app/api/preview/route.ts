import { BadAiAnswerError, aiErrorResponse, askForJson, errorResponse, fixLineBreaks } from "@/lib/ai";
import { digitsOf, normalize, toLatinDigits } from "@/lib/quote";
import { PreviewAiSchema, PreviewRequestSchema, type PreviewResponse } from "@/lib/schemas";

const SYSTEM = `You write short job previews for young people in villages and small towns of Maharashtra, who are more comfortable in Marathi or Hindi than English. Given a job, write one preview in Marathi and one in Hindi (Devanagari), each under 80 words, in simple everyday spoken words, not formal ones.

Each preview must say: the pay, the working hours or shift, the daily work, where they will stay (from the accommodation details), how to apply (reply on WhatsApp with name and phone number), and that there is no fee to apply or join.
Write the pay amount with digits, e.g. "₹12,000" or "12,000 रुपये". Write the area name exactly as given, in English letters, in both previews, e.g. "Kothrud मध्ये काउंटर स्टाफ पाहिजे" (not "कोथरूड"), so the candidate can find it on a map. Both rules are checked; a preview without them is thrown away.`;

const MISMATCH = "Preview didn't match the job. Please try again.";

export async function POST(request: Request) {
  const parsed = PreviewRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Create a job post first.", 400);
  const job = parsed.data;

  const prompt = [
    `Job: ${job.roleTitle}${job.openings > 1 ? ` (${job.openings} people)` : ""}`,
    `Area: ${job.area}`,
    `Pay: ${job.pay}`,
    `Shift/hours: ${job.shift || "not given"}`,
    `Accommodation: ${job.accommodation || "not given"}`,
    "Must-haves:",
    ...job.mustHaves.map((m) => `- ${m}`),
  ].join("\n");

  // Code check: each preview must contain the real pay amount and area name.
  const pay = digitsOf(job.pay);
  const area = normalize(job.area.split(",")[0]);
  const matches = (text: string) =>
    (!pay || toLatinDigits(text).replace(/(\d)[\s,]+(?=\d)/g, "$1").includes(pay)) &&
    normalize(text).includes(area);

  try {
    const out = await askForJson({
      system: SYSTEM,
      prompt,
      schema: PreviewAiSchema,
      timeoutMs: 15_000,
      check: (a) => {
        if (!matches(a.marathi) || !matches(a.hindi)) throw new BadAiAnswerError("preview doesn't match the job");
      },
    });
    return Response.json({
      status: "ok",
      marathi: fixLineBreaks(out.marathi).trim(),
      hindi: fixLineBreaks(out.hindi).trim(),
    } satisfies PreviewResponse);
  } catch (err) {
    return aiErrorResponse(err, MISMATCH);
  }
}
