import { z } from "zod";

// Limits that protect against slow or expensive AI calls.
export const MAX_DESCRIPTION_CHARS = 500;
export const MAX_APPLICANTS = 30;
export const MAX_REPLY_CHARS = 1000;

export const MISSING_DETAILS = ["role", "pay", "area", "must-haves"] as const;
export type MissingDetail = (typeof MISSING_DETAILS)[number];

export const VERDICTS = ["met", "missed", "unclear"] as const;
export type Verdict = (typeof VERDICTS)[number];

// ---- What we ask the AI to return (JSON mode) ----

// AI call 1: `found` holds the owner's exact words for each required detail ("" if not
// written); code checks them. The post fields come back empty when something is missing.
export const PostAiSchema = z.object({
  found: z.object({
    role: z.string(),
    pay: z.string(),
    area: z.string(),
    mustHave: z.string(),
  }),
  jobTitle: z.string(),
  post: z.string(),
  mustHaves: z.array(z.string()),
  questions: z.array(z.string()),
});

// AI call 2: a verdict for each must-have, referenced by its number in the list.
export const RankAiSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      enoughInfo: z.boolean(),
      strengths: z.array(z.string()),
      verdicts: z.array(
        z.object({
          mustHave: z.number().int(),
          result: z.enum(VERDICTS),
          evidence: z.string(), // the applicant's exact words that prove a "met"
        }),
      ),
    }),
  ),
});

// AI call 3: realistic practice replies for the job on screen.
export const SamplesAiSchema = z.object({ replies: z.array(z.string()) });

// ---- What the page sends to the rank and samples routes ----

export const SamplesRequestSchema = z.object({
  jobTitle: z.string().trim().min(1).max(200),
  mustHaves: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
});

export const RankRequestSchema = z.object({
  jobTitle: z.string().trim().min(1).max(200),
  mustHaves: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
  applicants: z
    .array(
      z.object({
        id: z.string().min(1).max(10),
        text: z.string().trim().min(1).max(MAX_REPLY_CHARS),
      }),
    )
    .min(1)
    .max(MAX_APPLICANTS),
});
export type RankRequest = z.infer<typeof RankRequestSchema>;

// ---- What the routes send back to the page ----

export type ErrorResponse = { status: "error"; message: string };

export type Job = {
  jobTitle: string;
  post: string;
  mustHaves: string[];
  questions: string[];
};

export type CreatePostResponse =
  | ({ status: "ok" } & Job)
  | { status: "needs_info"; missing: MissingDetail[] }
  | ErrorResponse;

// `verdicts` lines up with the job's must-haves list, one entry each.
// `evidence` lines up too: the applicant's own words behind each ✓ ("" otherwise).
// `strengths` are up to 2 extra plus points, used to break ties.
export type CheckedApplicant = {
  id: string;
  name: string;
  enoughInfo: boolean;
  strengths: string[];
  verdicts: Verdict[];
  evidence: string[];
};

export type SamplesResponse = { status: "ok"; text: string } | ErrorResponse;

export type RankResponse =
  | { status: "ok"; results: CheckedApplicant[] }
  | ErrorResponse;
