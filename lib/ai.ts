import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import type { ErrorResponse } from "./schemas";

// Lite is fast (a few seconds) and steady on the free plan, which keeps us inside the 15s/20s limits.
export const MODEL = "gemini-flash-lite-latest";
// Used when the main model is busy (free-plan "high demand" errors).
const BACKUP_MODEL = "gemini-3.5-flash";

class MissingKeyError extends Error {}

// Thrown when the AI answers but the answer isn't usable (wrong shape, too few questions).
export class BadAiAnswerError extends Error {}

// Asks Gemini for JSON in the shape of `schema`, then checks the answer with zod.
// The key is read from .env.local (or Vercel's settings). It never leaves the server.
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
  const call = (model: string) =>
    new GoogleGenAI({ apiKey }).models.generateContent({
      model,
      contents: options.prompt,
      config: {
        systemInstruction: options.system,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        // Short thinking keeps answers fast; these are simple checks.
        thinkingConfig: model === MODEL ? { thinkingLevel: ThinkingLevel.LOW } : undefined,
        httpOptions: { timeout: options.timeoutMs },
      },
    });

  // If the main model is busy (5xx), ask the backup model straight away.
  let response;
  try {
    response = await call(MODEL);
  } catch (err) {
    if (!(err instanceof ApiError && err.status >= 500)) throw err;
    console.warn(`${MODEL} busy (${err.status}), using ${BACKUP_MODEL}`);
    response = await call(BACKUP_MODEL);
  }

  let data: unknown;
  try {
    data = JSON.parse(response.text ?? "");
  } catch {
    throw new BadAiAnswerError("answer was not JSON");
  }
  const parsed = options.schema.safeParse(data);
  if (!parsed.success) throw new BadAiAnswerError(parsed.error.message);
  return parsed.data;
}

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
  return errorResponse("Couldn't reach the AI. Please try again.", 502);
}
