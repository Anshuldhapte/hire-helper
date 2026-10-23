import { describe, expect, it } from "vitest";
import { findPhone } from "./applicants";
import { matchInviteMessage } from "./whatsapp";
import { SAMPLE_WORKERS, WorkerProfileSchema, pickCandidates, profileToText, workersAsApplicants } from "./workers";

describe("sample worker list", () => {
  it("every sample passes the profile rules, with a unique phone number", () => {
    for (const w of SAMPLE_WORKERS) expect(WorkerProfileSchema.safeParse(w).success).toBe(true);
    expect(new Set(SAMPLE_WORKERS.map((w) => w.phone)).size).toBe(SAMPLE_WORKERS.length);
  });

  it("rejects a profile without consent or with a bad phone number", () => {
    const base = SAMPLE_WORKERS[0];
    expect(WorkerProfileSchema.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(WorkerProfileSchema.safeParse({ ...base, phone: "12345" }).success).toBe(false);
  });
});

describe("profile as text (what the AI reads)", () => {
  const sachin = SAMPLE_WORKERS.find((w) => w.name === "Sachin Pawar")!;
  const text = profileToText(sachin);

  it("writes every can / cannot / learning answer as a full sentence", () => {
    expect(text).toContain("Can handle cash and UPI payments.");
    expect(text).toContain("Can count stock and keep a stock register.");
    expect(text).toContain("Cannot ride a two-wheeler with a driving licence.");
  });

  it("includes past jobs, availability and stay, and keeps the phone readable", () => {
    expect(text).toContain("Past work: Counter staff at a kirana shop in Satara for 1–2 years (left because: moved to a new place).");
    expect(text).toContain("Available for evening shift.");
    expect(text).toContain("willing to move to Pune; can stay with a relative in Pune.");
    expect(findPhone(text)).toBe(sachin.phone);
  });

  it("says so when someone has no past work", () => {
    expect(profileToText(SAMPLE_WORKERS.find((w) => w.name === "Kiran Sonawane")!)).toContain("No past work experience yet.");
  });
});

describe("picking candidates before the AI", () => {
  it("puts people who want this kind of work first", () => {
    const picked = pickCandidates(SAMPLE_WORKERS, "delivery", 4);
    expect(picked).toHaveLength(4);
    for (const w of picked) expect(w.roles).toContain("delivery");
  });

  it("puts people who can't come to Pune after those who can", () => {
    const picked = pickCandidates(SAMPLE_WORKERS, "delivery", 12).map((w) => w.name);
    expect(picked.indexOf("Rohan Mane")).toBeGreaterThan(picked.indexOf("Imran Shaikh"));
  });

  it("turns profiles into applicants the ranking understands", () => {
    const applicants = workersAsApplicants(SAMPLE_WORKERS.slice(0, 3));
    expect(applicants.map((a) => a.id)).toEqual(["W1", "W2", "W3"]);
    expect(applicants[0]).toMatchObject({ phone: "9000010001", senderName: "Sachin Pawar", junkReason: null });
    for (const a of workersAsApplicants(SAMPLE_WORKERS)) expect(a.text.length).toBeLessThanOrEqual(1000);
  });
});

describe("interview invite for a matched worker", () => {
  it("says why we're writing, the time, and that there's no fee", () => {
    expect(matchInviteMessage("Sachin Pawar", { roleTitle: "Counter staff", area: "Kothrud", pay: "₹12,000" }, "tomorrow at 11 am")).toBe(
      "Namaste Sachin Pawar! A shop in Kothrud has a Counter staff job (₹12,000) that matches your Kaam Pakka profile. Can you come for a short interview tomorrow at 11 am? Please reply YES to confirm. You never pay any fee.",
    );
  });
});
