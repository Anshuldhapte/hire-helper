import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, composeDescription, firstIncompleteStep, formatRupees, scheduleText, stepError, type JobDraft } from "./draft";

const draft = (changes: Partial<JobDraft>): JobDraft => ({ ...EMPTY_DRAFT, ...changes });

describe("rupees", () => {
  it("uses Indian grouping", () => {
    expect(formatRupees("12000")).toBe("₹12,000");
    expect(formatRupees("120000")).toBe("₹1,20,000");
    expect(formatRupees("")).toBe("");
  });
});

describe("job line built from taps", () => {
  it("writes the full line for a typical counter job", () => {
    const line = composeDescription(
      draft({
        roleKey: "counter",
        shop: "Wine shop",
        openings: 2,
        mustHaves: ["cash", "stock"],
        payAmount: "12000",
        shift: "evening",
        days: "6 days a week",
        area: "Kothrud",
      }),
    );
    expect(line).toBe(
      "Need 2 counter staff for my wine shop in Kothrud, ₹12,000 a month, evening shift, 6 days a week, must handle cash and UPI, count stock and keep a stock register",
    );
  });

  it("keeps the owner's own words, any language, and adds notes", () => {
    const line = composeDescription(
      draft({
        roleKey: "custom",
        customRole: "दुकान सहायक",
        customMustHaves: ["Marathi bolta aana chahiye"],
        notes: "Sunday off milega",
        payAmount: "500",
        payPer: "day",
        hours: "9 am to 9 pm",
        area: "कोथरूड",
      }),
    );
    expect(line).toBe(
      "Need a दुकान सहायक for my shop in कोथरूड, ₹500 a day, 9 am to 9 pm, must Marathi bolta aana chahiye. Sunday off milega",
    );
  });

  it("makes plain role names plural for more than one person", () => {
    expect(composeDescription(draft({ roleKey: "helper", openings: 3, payAmount: "11000", area: "Baner" }))).toBe(
      "Need 3 shop helpers for my shop in Baner, ₹11,000 a month",
    );
  });

  it("writes '1 delivery staff', not 'a delivery staff'", () => {
    expect(composeDescription(draft({ roleKey: "delivery", mustHaves: ["bike"], payAmount: "500", payPer: "day", area: "Aundh, Pune" }))).toBe(
      "Need 1 delivery staff for my shop in Aundh, Pune, ₹500 a day, must have a bike and licence",
    );
  });

  it("joins shift and exact hours", () => {
    expect(scheduleText(draft({ shift: "evening", hours: "4 pm to 11 pm", days: "6 days a week" }))).toBe(
      "evening shift (4 pm to 11 pm), 6 days a week",
    );
  });
});

describe("what each step needs", () => {
  it("asks only for work, pay and area", () => {
    expect(stepError(0, EMPTY_DRAFT)).toMatch(/Pick the work/);
    expect(stepError(1, EMPTY_DRAFT)).toBeNull(); // details are optional
    expect(stepError(2, draft({ payAmount: "0" }))).toMatch(/what you will pay/);
    expect(stepError(3, draft({ area: "  " }))).toMatch(/Pick the area/);
  });

  it("finds the first step still to fill in", () => {
    expect(firstIncompleteStep(draft({ roleKey: "counter" }))).toBe(2);
    expect(firstIncompleteStep(draft({ roleKey: "counter", payAmount: "12000", area: "Kothrud" }))).toBeNull();
  });
});
