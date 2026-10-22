import { describe, expect, it } from "vitest";
import { BUILT_IN_SAMPLES } from "./samples";
import { buildRanking, findPhone, junkReason, reasonOf, scoreOf, splitApplicants } from "./applicants";
import type { CheckedApplicant } from "./schemas";

describe("splitting replies", () => {
  it("splits on blank lines, one applicant per block", () => {
    const { applicants } = splitApplicants("Ravi 9876543210 has a licence\n\n\nSameer 9822011223 can work evenings\n\nAmit");
    expect(applicants.map((a) => a.text)).toEqual([
      "Ravi 9876543210 has a licence",
      "Sameer 9822011223 can work evenings",
      "Amit",
    ]);
  });

  it("finds all 8 built-in samples", () => {
    expect(splitApplicants(BUILT_IN_SAMPLES).applicants).toHaveLength(8);
  });

  it("refuses more than 30 replies", () => {
    const many = Array.from({ length: 31 }, (_, i) => `Applicant number ${i} has a licence`).join("\n\n");
    expect(splitApplicants(many).tooMany).toBe(true);
  });
});

describe("splitting a copied WhatsApp chat", () => {
  const chat = [
    "[22/10/26, 3:29:47 PM] Rahul Patil: Hi sir, I have a licence",
    "and I can work the evening shift",
    "22/10/26, 3:31 pm - +91 98901 23456: Kunal here, no bike but licence yes",
    "[3:35 pm, 22/10/2026] Rahul Patil: Also 2 years counter experience",
  ].join("\n");
  const { applicants } = splitApplicants(chat);

  it("groups messages by sender, in all three formats", () => {
    expect(applicants).toHaveLength(2);
    expect(applicants[0].text).toBe(
      "Rahul Patil\nHi sir, I have a licence\nand I can work the evening shift\nAlso 2 years counter experience",
    );
  });

  it("uses a sender's number as their phone, and a contact name as their name", () => {
    expect(applicants[0].senderName).toBe("Rahul Patil");
    expect(applicants[1].phone).toBe("9890123456");
    expect(applicants[1].senderName).toBeNull();
  });
});

describe("phone numbers", () => {
  it.each([
    ["Call 9876543210", "9876543210"],
    ["+91 91234 56780", "9123456780"],
    ["+91-90280-44556", "9028044556"],
    ["0 98220 11223", "9822011223"],
    ["मोबाईल ९८५०१२३४५६", "9850123456"],
  ])("finds the number in %s", (text, phone) => {
    expect(findPhone(text)).toBe(phone);
  });

  it("ignores numbers that aren't Indian mobiles", () => {
    expect(findPhone("Pin 411038, landline 020 2543 1234")).toBeNull();
  });
});

describe("junk filter", () => {
  it.each([
    ["", "Blank reply"],
    ["😀😀😀 ???", "Only emoji or punctuation"],
    ["Hi sir job chahiye", "Too short"],
    ["Interested 9876543210", "Too short"],
  ])("marks %j as junk", (text, why) => {
    expect(junkReason(text)).toBe(why);
  });

  it("keeps a real reply, in any language", () => {
    expect(junkReason("Me 2 varsha counter var kaam kela, cash handle karto")).toBeNull();
    expect(junkReason("मी पेट्रोल पंपावर एक वर्ष कॅश सांभाळली आहे")).toBeNull();
  });
});

describe("score", () => {
  it("shares 90 points across must-haves: met full, unclear half, missed zero", () => {
    expect(scoreOf(["met", "met", "met"], 0)).toBe(90);
    expect(scoreOf(["met", "unclear", "missed"], 0)).toBe(45);
    expect(scoreOf(["missed", "missed"], 0)).toBe(0);
  });

  it("adds 5 per strength, at most 2", () => {
    expect(scoreOf(["met", "met", "met"], 2)).toBe(100);
    expect(scoreOf(["met", "met", "met"], 5)).toBe(100);
  });
});

describe("reason line", () => {
  it("lists met, missed and unclear must-haves, leaving out empty parts", () => {
    expect(reasonOf(["Licence", "Servicing", "6 days a week"], ["met", "met", "missed"])).toBe(
      "Meets: Licence, Servicing. Missing: 6 days a week.",
    );
    expect(reasonOf(["Licence", "Cash"], ["unclear", "met"])).toBe("Meets: Cash. Unclear: Licence.");
  });
});

describe("ranking", () => {
  const mustHaves = [{ label: "Handles cash" }, { label: "Evening shift" }];
  const result = (id: string, statuses: ("met" | "missed" | "unclear")[], enoughInfo = true): CheckedApplicant => ({
    id,
    name: "",
    enoughInfo,
    checks: statuses.map((status) => ({ status, proof: status === "unclear" ? "" : "words" })),
    strengths: [],
    canJoin: null,
    stay: null,
  });

  it("keeps junk, 'not enough info' and no-proof replies out of the top 3", () => {
    const { applicants } = splitApplicants(
      "A handles cash 9876543210 and evenings ok\n\nHi sir job chahiye\n\nB tumchya gavacha ahe saheb kaam dya\n\nC wrote something unrelated to the job here",
    );
    const ranking = buildRanking(
      applicants,
      [result("A1", ["met", "met"]), result("A3", ["met", "met"], false), result("A4", ["unclear", "unclear"])],
      mustHaves,
      "Counter staff",
      "",
    );
    expect(ranking.top.map((c) => c.id)).toEqual(["A1"]);
    expect(ranking.notEnoughInfo.map((n) => n.why)).toEqual([
      "Too short",
      "Doesn't really answer the job",
      "No proof for any must-have",
    ]);
    expect(ranking.notes).toEqual(["Only 1 applicant had enough information to rank."]);
  });

  it("breaks ties by more ✓, then by who replied first, and names unnamed applicants", () => {
    const { applicants } = splitApplicants(
      "first reply has enough words here\n\nsecond reply has enough words here\n\nthird reply has enough words here",
    );
    const four = [{ label: "Cash" }, { label: "Stock" }, { label: "Evening" }, { label: "Licence" }];
    const ranking = buildRanking(
      applicants,
      [
        result("A1", ["unclear", "unclear", "missed", "missed"]),
        result("A2", ["met", "missed", "missed", "missed"]),
        result("A3", ["met", "missed", "missed", "missed"]),
      ],
      four,
      "Counter staff",
      "tomorrow at 11 am",
    );
    // All three score 23. A2 and A3 have one ✓ each, so they beat A1; A2 replied before A3.
    expect(ranking.top.map((c) => c.score)).toEqual([23, 23, 23]);
    expect(ranking.top.map((c) => c.name)).toEqual(["Applicant 2", "Applicant 3", "Applicant 1"]);
  });
});
