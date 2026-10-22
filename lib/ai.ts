// Server-only: the only file that talks to Gemini. The API key is read here and never
// sent to the browser.
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import type { ErrorResponse } from "./schemas";

// Two current, stable Flash-Lite models from Google's official model list
// (https://ai.google.dev/gemini-api/docs/models). Each has its own free-plan quota.
export const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

// A model that errors (including "too many requests") is skipped for 60 seconds.
const SKIP_MS = 60_000;
const skipUntil = new Map<string, number>();

class MissingKeyError extends Error {}
// The AI answered, but the answer had the wrong shape or failed a code check.
export class BadAiAnswerError extends Error {}

const isKeyError = (err: unknown) =>
  err instanceof ApiError &&
  (err.status === 401 || err.status === 403 || (err.status === 400 && /api key/i.test(err.message)));
const isRateLimit = (err: unknown) => err instanceof ApiError && err.status === 429;

// Asks both models at once for JSON in the shape of `schema`, checks the answer with zod
// (and `check`, if given), and returns the first good one. Always finishes within `timeoutMs`.
export async function askForJson<T extends z.ZodType>(options: {
  system: string;
  prompt: string;
  schema: T;
  timeoutMs: number;
  check?: (data: z.infer<T>) => void; // throw BadAiAnswerError to reject an answer
}): Promise<z.infer<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new MissingKeyError();

  const jsonSchema = z.toJSONSchema(options.schema);
  delete jsonSchema.$schema; // Gemini only needs the shape itself

  // One controller stops everything: at the time limit, or once one model has answered.
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), options.timeoutMs);

  const ask = async (model: string): Promise<z.infer<T>> => {
    try {
      const response = await new GoogleGenAI({ apiKey }).models.generateContent({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.system,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, // short thinking = fast answers
          abortSignal: stop.signal,
        },
      });
      let data: unknown;
      try {
        data = JSON.parse(response.text ?? "");
      } catch {
        throw new BadAiAnswerError(`${model}: answer was not JSON`);
      }
      const parsed = options.schema.safeParse(data);
      if (!parsed.success) throw new BadAiAnswerError(`${model}: ${parsed.error.message}`);
      options.check?.(parsed.data);
      console.info(`Answered by ${model}`);
      return parsed.data;
    } catch (err) {
      // Don't skip a model we cancelled ourselves because the other one answered first.
      const cancelledByUs = stop.signal.aborted && !(err instanceof ApiError);
      if (!cancelledByUs && !(err instanceof BadAiAnswerError)) skipUntil.set(model, Date.now() + SKIP_MS);
      throw err;
    }
  };

  const now = Date.now();
  const ready = MODELS.filter((m) => (skipUntil.get(m) ?? 0) <= now);
  try {
    return await Promise.any((ready.length > 0 ? ready : MODELS).map(ask));
  } catch (err) {
    const errors: unknown[] = err instanceof AggregateError ? err.errors : [err];
    console.warn("All models failed:", errors.map((e) => (e instanceof Error ? e.message.slice(0, 200) : e)));
    // Report the most useful reason: wrong key, then rate limit, then a failed check.
    throw (
      errors.find(isKeyError) ??
      errors.find(isRateLimit) ??
      errors.find((e) => e instanceof BadAiAnswerError) ??
      errors[0]
    );
  } finally {
    clearTimeout(timer);
    stop.abort(); // cancel the slower request
  }
}

// Models sometimes send line breaks as the two characters "\n"; turn them into real ones.
export const fixLineBreaks = (text: string) => text.replace(/\\n/g, "\n");

export function errorResponse(message: string, status: number) {
  return Response.json({ status: "error", message } satisfies ErrorResponse, { status });
}

// Turns any failure into one of the friendly messages, and logs the detail on the server.
// `badAnswerMessage` lets a route explain a failed code check in its own words.
export function aiErrorResponse(err: unknown, badAnswerMessage?: string) {
  if (err instanceof MissingKeyError || isKeyError(err)) {
    console.error("GEMINI_API_KEY is missing or was rejected. Check .env.local.");
    return errorResponse("The app isn't set up yet (API key missing or wrong).", 500);
  }
  if (isRateLimit(err)) {
    return errorResponse("Too many requests on the free AI plan. Wait a minute and try again.", 429);
  }
  if (err instanceof BadAiAnswerError && badAnswerMessage) {
    return errorResponse(badAnswerMessage, 502);
  }
  console.error("AI call failed:", err instanceof Error ? err.message.slice(0, 300) : err);
  return errorResponse("The AI is busy right now. Please try again.", 502);
}
