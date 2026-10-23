import { z } from "zod";

// Limits that protect against slow or expensive AI calls.
export const MAX_DESCRIPTION_CHARS = 500;
export const MAX_APPLICANTS = 30;
export const MAX_REPLY_CHARS = 1000;

// The only details a post can't go out without.
export const REQUIRED_DETAILS = ["role", "pay", "area"] as const;
export type RequiredDetail = (typeof REQUIRED_DETAILS)[number];

export const ROLE_KEYS = ["counter", "helper", "delivery", "kitchen", "other"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const CHECK_STATUSES = ["met", "missed", "unclear"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

// The AI uses "" (an empty string) for "not written". Code treats "" like null.

// ---- AI call 1: create post ----
export const PostAiSchema = z.object({
  copied: z.object({
    role: z.string(),
    pay: z.string(),
    area: z.string(),
    shift: z.string(),
    openings: z.string(),
    mustHaves: z.array(z.string()),
  }),
  roleKey: z.enum(ROLE_KEYS),
  roleTitle: z.string(), // neutral job name for the job card, e.g. "Counter staff"
  post: z.string(),
  mustHaves: z.array(
    z.object({ id: z.string(), label: z.string(), source: z.enum(["owner", "suggested"]) }),
  ),
  questions: z.array(z.string()),
});

// ---- AI call 2: rank ----
const Proofed = z.object({ text: z.string(), proof: z.string() });
export const RankAiSchema = z.object({
  applicants: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      enoughInfo: z.boolean(),
      checks: z.array(
        z.object({
          mustHaveId: z.string(),
          status: z.enum(CHECK_STATUSES),
          proof: z.string(), // the applicant's exact words
        }),
      ),
      strengths: z.array(Proofed),
      canJoin: Proofed, // shown, not scored; "" when not said
      stay: Proofed,
    }),
  ),
});

// ---- AI call 3: practice replies ----
export const SamplesAiSchema = z.object({ replies: z.array(z.string()) });

// ---- AI call 4: Marathi and Hindi job preview ----
export const PreviewAiSchema = z.object({
  marathi: z.string(),
  hindi: z.string(),
  questionsMarathi: z.array(z.string()), // the screening questions, same order
  questionsHindi: z.array(z.string()),
});

// ---- What the page sends to the routes ----
const MustHaveIn = z.object({ id: z.string().min(1).max(20), label: z.string().trim().min(1).max(200) });

export const RankRequestSchema = z.object({
  roleTitle: z.string().trim().min(1).max(200),
  mustHaves: z.array(MustHaveIn).max(8),
  applicants: z
    .array(z.object({ id: z.string().min(1).max(10), text: z.string().trim().min(1).max(MAX_REPLY_CHARS) }))
    .min(1)
    .max(MAX_APPLICANTS),
});

const JobFacts = {
  roleTitle: z.string().trim().min(1).max(200),
  pay: z.string().trim().min(1).max(100),
  area: z.string().trim().min(1).max(100),
  shift: z.string().max(100),
  mustHaves: z.array(z.string().max(200)).max(8),
};
export const SamplesRequestSchema = z.object(JobFacts);
export const PreviewRequestSchema = z.object({
  ...JobFacts,
  openings: z.number().int().min(1).max(20),
  accommodation: z.string().max(100),
  questions: z.array(z.string().trim().min(1).max(300)).max(6),
});

// ---- What the routes send back ----
export type ErrorResponse = { status: "error"; message: string };

export type MustHave = { id: string; label: string; source: "owner" | "suggested" };

export type Job = {
  description: string; // the owner's line, as typed
  roleTitle: string;
  roleKey: RoleKey;
  openings: number;
  area: string;
  pay: string;
  shift: string;
  postBody: string; // the AI's post; code adds the extra lines on screen
  mustHaves: MustHave[];
  questions: string[];
};

export type CreatePostResponse =
  | ({ status: "ok" } & Job)
  | { status: "missing"; missing: RequiredDetail[] }
  | ErrorResponse;

export type ProofedText = { text: string; proof: string };

// One per applicant the AI checked. `checks` lines up with the must-haves list.
export type CheckedApplicant = {
  id: string;
  name: string;
  enoughInfo: boolean;
  checks: { status: CheckStatus; proof: string }[];
  strengths: ProofedText[];
  canJoin: ProofedText | null;
  stay: ProofedText | null;
};

export type RankResponse = { status: "ok"; results: CheckedApplicant[] } | ErrorResponse;
export type SamplesResponse = { status: "ok"; text: string } | ErrorResponse;
export type PreviewResponse =
  | { status: "ok"; marathi: string; hindi: string; questionsMarathi: string[]; questionsHindi: string[] }
  | ErrorResponse;
