// The tap-by-tap job form. Everything the owner picks is turned into the same one-line
// description they could have typed, so the existing /api/create-post does the rest
// (it still checks every detail against these exact words).
import type { AccommodationKey } from "./roles";

export type PayPer = "month" | "day";

export type JobDraft = {
  roleKey: string; // a ROLES key, or "custom"
  customRole: string;
  shop: string; // a SHOPS label, "custom", or ""
  customShop: string;
  openings: number;
  mustHaves: string[]; // MUST_HAVES ids
  customMustHaves: string[]; // owner's own words, e.g. "know Marathi"
  notes: string;
  payAmount: string; // digits only, e.g. "12000"
  payPer: PayPer;
  shift: string; // a SHIFTS key or ""
  hours: string; // optional exact hours, e.g. "4 pm to 11 pm"
  days: string; // a DAYS option or ""
  area: string;
  accommodation: AccommodationKey | null;
};

export const EMPTY_DRAFT: JobDraft = {
  roleKey: "",
  customRole: "",
  shop: "",
  customShop: "",
  openings: 1,
  mustHaves: [],
  customMustHaves: [],
  notes: "",
  payAmount: "",
  payPer: "month",
  shift: "",
  hours: "",
  days: "",
  area: "",
  accommodation: null,
};

export const ROLES = [
  { key: "counter", label: "Counter staff", hint: "Cash, billing, customers", phrase: "counter staff" },
  { key: "helper", label: "Shop helper", hint: "Stock, shelves, cleaning", phrase: "shop helper" },
  { key: "delivery", label: "Delivery staff", hint: "Home delivery on a bike", phrase: "delivery staff" },
  { key: "packing", label: "Packing staff", hint: "Packing and labelling", phrase: "packing staff" },
  { key: "sales", label: "Sales assistant", hint: "Helping customers buy", phrase: "sales assistant" },
  { key: "kitchen", label: "Kitchen helper", hint: "Cutting, cleaning, prep", phrase: "kitchen helper" },
] as const;

export const SHOPS = ["Kirana store", "Wine shop", "Petrol pump", "Café", "Medical store"];

// Each must-have: what the owner sees, and how it's written in the job line.
export const MUST_HAVES = {
  cash: { label: "Handles cash & UPI", phrase: "handle cash and UPI" },
  stock: { label: "Counts stock, keeps a register", phrase: "count stock and keep a stock register" },
  polite: { label: "Talks politely to customers", phrase: "talk politely to customers" },
  lift: { label: "Can lift heavy stock", phrase: "lift and arrange stock" },
  delivery: { label: "Can do home delivery", phrase: "do home delivery" },
  labels: { label: "Can read English labels", phrase: "read English labels" },
  bike: { label: "Has a bike & licence", phrase: "have a bike and licence" },
  localArea: { label: "Knows the local area", phrase: "know the local area" },
  cutting: { label: "Basic cutting & cleaning", phrase: "know basic cutting and cleaning" },
  experience: { label: "Has worked in a shop before", phrase: "have shop experience" },
} as const;
export type MustHaveId = keyof typeof MUST_HAVES;

// The must-haves worth offering first for each kind of work.
export const MUST_HAVES_FOR: Record<string, MustHaveId[]> = {
  counter: ["cash", "stock", "polite", "experience"],
  helper: ["lift", "delivery", "labels", "experience"],
  delivery: ["bike", "localArea", "delivery"],
  packing: ["lift", "labels", "experience"],
  sales: ["polite", "cash", "experience"],
  kitchen: ["cutting", "experience"],
  custom: ["cash", "lift", "bike", "polite", "experience"],
};

// Common amounts to tap. Nothing is picked until the owner chooses.
export const PAY_PICKS: Record<PayPer, number[]> = {
  month: [10000, 12000, 15000, 18000],
  day: [400, 500, 600, 700],
};

export const SHIFTS = [
  { key: "morning", label: "Morning", phrase: "morning shift" },
  { key: "day", label: "Day", phrase: "day shift" },
  { key: "evening", label: "Evening", phrase: "evening shift" },
  { key: "night", label: "Night", phrase: "night shift" },
  { key: "full", label: "Full day", phrase: "full day" },
];

export const DAYS = ["6 days a week", "7 days a week", "5 days a week"];

export const AREAS = ["Kothrud", "Hadapsar", "Baner", "Aundh", "Karve Nagar", "Wakad"];

// "12000" → "₹12,000" (Indian grouping: ₹1,20,000).
export function formatRupees(digits: string) {
  const n = Number(digits);
  return digits && Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : "";
}

export const roleLabel = (d: JobDraft) =>
  d.roleKey === "custom" ? d.customRole.trim() : (ROLES.find((r) => r.key === d.roleKey)?.label ?? "");

const rolePhrase = (d: JobDraft) =>
  d.roleKey === "custom" ? d.customRole.trim() : (ROLES.find((r) => r.key === d.roleKey)?.phrase ?? "");

export const shopLabel = (d: JobDraft) => (d.shop === "custom" ? d.customShop.trim() : d.shop);

export const payText = (d: JobDraft) =>
  d.payAmount ? `${formatRupees(d.payAmount)} a ${d.payPer}` : "";

export const scheduleText = (d: JobDraft) => {
  const shift = SHIFTS.find((s) => s.key === d.shift)?.phrase ?? "";
  const hours = d.hours.trim();
  const when = shift && hours ? `${shift} (${hours})` : shift || hours;
  return [when, d.days].filter(Boolean).join(", ");
};

export const mustHaveLabels = (d: JobDraft) => [
  ...d.mustHaves.map((id) => MUST_HAVES[id as MustHaveId]?.label).filter(Boolean),
  ...d.customMustHaves,
];

// The one line sent to the AI, e.g. "Need 2 counter staff for my wine shop in Kothrud,
// ₹12,000 a month, evening shift, 6 days a week, must handle cash and UPI".
export function composeDescription(d: JobDraft) {
  let role = rolePhrase(d);
  if (d.openings > 1 && d.roleKey !== "custom" && !/(staff|s)$/i.test(role)) role += "s";
  // "a shop helper", but "1 delivery staff" ("a delivery staff" isn't good English).
  const who = d.openings > 1 || /staff$/i.test(role) ? `${d.openings} ${role}` : `a ${role}`;
  const shop = shopLabel(d).toLowerCase() || "shop";
  const musts = [
    ...d.mustHaves.map((id) => MUST_HAVES[id as MustHaveId]?.phrase).filter(Boolean),
    ...d.customMustHaves.map((m) => m.trim()).filter(Boolean),
  ];
  const parts = [
    `Need ${who} for my ${shop} in ${d.area.trim()}`,
    payText(d),
    scheduleText(d),
    musts.length > 0 ? `must ${musts.join(", ")}` : "",
  ].filter(Boolean);
  const notes = d.notes.trim().replace(/\s+/g, " ");
  return `${parts.join(", ")}${notes ? `. ${notes}` : ""}`;
}

export const STEP_LABELS = ["Work", "Details", "Pay & hours", "Location", "Review"];

// What must be filled before leaving each step (0-based). Everything else is optional.
export function stepError(step: number, d: JobDraft): string | null {
  if (step === 0) {
    if (!d.roleKey) return "Pick the work, or choose “Something else” and type it.";
    if (d.roleKey === "custom" && !d.customRole.trim()) return "Type the work you need, e.g. “cashier”.";
    if (d.shop === "custom" && !d.customShop.trim()) return "Type the kind of shop, or pick one above.";
  }
  if (step === 2) {
    const n = Number(d.payAmount);
    if (!d.payAmount || !Number.isFinite(n) || n <= 0) return "Enter what you will pay, or tap an amount.";
  }
  if (step === 3 && !d.area.trim()) return "Pick the area, or type where the shop is.";
  return null;
}

// The first step that still needs something, or null when the draft is complete.
export function firstIncompleteStep(d: JobDraft) {
  for (const step of [0, 2, 3]) if (stepError(step, d)) return step;
  return null;
}
