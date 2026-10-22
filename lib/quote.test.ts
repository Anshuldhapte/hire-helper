import { describe, expect, it } from "vitest";
import { digitsOf, quoteIsIn } from "./quote";
import { parseOpenings, suggestedMustHaves } from "./roles";
import { interviewMessage, whatsappLink } from "./whatsapp";

describe("quote check", () => {
  const reply = "Sachin Pawar 9876543210. 2 varsha kirana dukanat counter var kaam kela, cash ani UPI handle karto, roj stock mojto.";

  it("accepts words that really are in the reply, ignoring case, spaces and punctuation", () => {
    expect(quoteIsIn("cash ani UPI handle karto", reply)).toBe(true);
    expect(quoteIsIn("ROJ  STOCK MOJTO.", reply)).toBe(true);
  });

  it("rejects words that aren't there", () => {
    expect(quoteIsIn("uses Google Maps", reply)).toBe(false);
    expect(quoteIsIn("", reply)).toBe(false);
  });

  it("treats ₹, Rs and rs the same, and Marathi digits as 0–9", () => {
    expect(quoteIsIn("Rs 12,000", "Need counter staff, ₹12,000, evening shift")).toBe(true);
    expect(quoteIsIn("१ वर्ष", "पेट्रोल पंपावर 1 वर्ष कॅश सांभाळली")).toBe(true);
  });

  it("reads digits out of an amount", () => {
    expect(digitsOf("₹12,000")).toBe("12000");
    expect(digitsOf("१२,०००")).toBe("12000");
  });
});

describe("role templates", () => {
  it("suggests 3 counter-staff must-haves using the owner's shift", () => {
    expect(suggestedMustHaves("counter", "evening shift")).toEqual([
      "Handles cash and UPI accurately",
      "Can count stock or keep a stock register",
      "Available for the full evening shift",
    ]);
  });

  it("reads the number of openings", () => {
    expect(parseOpenings("two")).toBe(2);
    expect(parseOpenings("3")).toBe(3);
    expect(parseOpenings("")).toBe(1);
  });
});

describe("WhatsApp message", () => {
  it("includes the name, role and interview time", () => {
    expect(interviewMessage("Sachin", "Counter staff", "tomorrow at 11 am")).toBe(
      "Namaste Sachin! Thank you for applying for the Counter staff job. Can you come for a short interview tomorrow at 11 am? Please reply YES to confirm.",
    );
  });

  it("says 'this week' with no time, and leaves out a missing name", () => {
    expect(interviewMessage("", "Helper", "")).toBe(
      "Namaste! Thank you for applying for the Helper job. Can you come for a short interview this week? Please reply YES to confirm.",
    );
  });

  it("builds a click-to-chat link with +91", () => {
    expect(whatsappLink("9876543210", "Hi there")).toBe("https://wa.me/919876543210?text=Hi%20there");
  });
});
