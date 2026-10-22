import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import type { ErrorResponse } from "./schemas";

// On the free plan each model has its own daily quota, and speed jumps around (2s one
// minute, 20s the next). So each question goes to the 2 best models that are working
// right now, and the first good answer wins. Listed in order of preference. Use real model
// names, not "-latest" aliases: an alias shares its quota with the model it points to.
const MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
];
const MODELS_PER_QUESTION = 2;

// Models to skip for now: out of daily quota (until it resets) or overloaded (1 minute).
const restingUntil = new Map<string, number>();

function rest(model: string, err: unknown, cancelledByUs: boolean) {
  if (cancelledByUs) return; // another model answered first; this one is fine
  if (!(err instanceof ApiError)) {
    restingUntil.set(model, Date.now() + 60_000); // too slow: hit our time limit
    return;
  }
  if (err.status === 429) {
    const seconds = Number(err.message.match(/"retryDelay":"(\d+)s"/)?.[1] ?? 3600);
    restingUntil.set(model, Date.now() + seconds * 1000);
  } else if (err.status >= 500) {
    restingUntil.set(model, Date.now() + 60_000);
  }
}

function pickModels() {
  const now = Date.now();
  const ready = MODELS.filter((m) => (restingUntil.get(m) ?? 0) <= now);
  // If every model is resting, try the ones that will be back soonest.
  const pool = ready.length > 0 ? ready : [...MODELS].sort(
    (a, b) => (restingUntil.get(a) ?? 0) - (restingUntil.get(b) ?? 0),
  );
  return pool.slice(0, MODELS_PER_QUESTION);
}

class MissingKeyError extends Error {}

// Thrown when the AI answers but the answer isn't usable (wrong shape, too few questions).
export class BadAiAnswerError extends Error {}

// Asks Gemini for JSON in the shape of `schema`, checks the answer with zod, and
// always finishes within `timeoutMs`. The key is read from .env.local (or Vercel's
// settings) and never leaves the server.
export async function askForJson<T extends z.ZodType>(options: {
  system: string;
  prompt: string;
  schema: T;
  timeoutMs: number;
}): Promise<z.infer<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new MissingKeyError();

  const jsonSchema = z.toJSONSchema(options.schema);
  delete jsonSchema.$schema; // Gemini only needs the shape itself
  const stopOthers = new AbortController();

  const ask = async (model: string): Promise<z.infer<T>> => {
    const response = await new GoogleGenAI({ apiKey }).models
      .generateContent({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.system,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          // Short thinking keeps answers fast; these are simple checks.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: stopOthers.signal,
          httpOptions: { timeout: options.timeoutMs },
        },
      })
      .catch((err) => {
        rest(model, err, stopOthers.signal.aborted);
        throw err;
      });
    let data: unknown;
    try {
      data = JSON.parse(response.text ?? "");
    } catch {
      throw new BadAiAnswerError(`${model}: answer was not JSON`);
    }
    const parsed = options.schema.safeParse(data);
    if (!parsed.success) throw new BadAiAnswerError(`${model}: ${parsed.error.message}`);
    console.info(`Answered by ${model}`);
    return parsed.data;
  };

  try {
    return await Promise.any(pickModels().map(ask));
  } catch (err) {
    // Every model failed: report the first one's error, which explains the most.
    const first = err instanceof AggregateError ? err.errors[0] : err;
    console.warn("All models failed:", err instanceof AggregateError ? err.errors : err);
    throw first;
  } finally {
    stopOthers.abort(); // cancel the slower request once we have an answer
  }
}

// Models sometimes send line breaks as the two characters "\n"; turn them into real ones.
export const fixLineBreaks = (text: string) => text.replace(/\\n/g, "\n");

export function errorResponse(message: string, status: number) {
  return Response.json({ status: "error", message } satisfies ErrorResponse, {
    status,
  });
}

// Turns any failure into a friendly message for the screen, and logs the detail on the server.
export function aiErrorResponse(err: unknown) {
  if (err instanceof MissingKeyError) {
    console.error("GEMINI_API_KEY is missing. Add it to .env.local.");
    return errorResponse("The app isn't set up yet (API key missing).", 500);
  }
  if (
    err instanceof ApiError &&
    (err.status === 401 ||
      err.status === 403 ||
      (err.status === 400 && /api key/i.test(err.message)))
  ) {
    console.error("GEMINI_API_KEY was rejected. Check the key in .env.local.");
    return errorResponse("The app isn't set up yet (API key is wrong).", 500);
  }
  if (err instanceof ApiError && err.status === 429) {
    console.error("Gemini rate limit hit:", err.message);
    return errorResponse(
      "Too many requests on the free AI plan. Wait a minute and try again.",
      429,
    );
  }
  if (err instanceof BadAiAnswerError) {
    console.error("Unusable AI answer:", err.message);
    return errorResponse(
      "The AI gave an answer we couldn't use. Please try again.",
      502,
    );
  }
  console.error("AI call failed:", err);
  return errorResponse("The AI is busy right now. Please try again.", 502);
}
