// The worker pool: people who want work, with what they can and can't do, past jobs and
// availability. For now this is sample data in code, plus anyone who fills the /work
// questionnaire on this phone (saved in the browser; see app/workerStore.ts).
// A real database can replace this later without changing the matching.
import { z } from "zod";
import type { Applicant } from "./applicants";
import type { RoleKey } from "./schemas";

export type Lang = "en" | "hi" | "mr";
type Words = Record<Lang, string>;

// ---- Questionnaire options (shown in 3 languages; `phrase` is the English used for matching) ----

export const WANTED_ROLES = [
  { id: "counter", words: { en: "Counter staff / cashier", hi: "काउंटर / कैशियर", mr: "काउंटर / कॅशियर" } },
  { id: "helper", words: { en: "Shop helper / stock", hi: "दुकान हेल्पर / स्टॉक", mr: "दुकान मदतनीस / स्टॉक" } },
  { id: "delivery", words: { en: "Delivery staff", hi: "डिलीवरी", mr: "डिलिव्हरी" } },
  { id: "kitchen", words: { en: "Kitchen helper / cook", hi: "किचन हेल्पर / कुक", mr: "किचन मदतनीस / स्वयंपाकी" } },
  { id: "cleaner", words: { en: "Cleaning / house help", hi: "सफ़ाई / घरेलू काम", mr: "साफसफाई / घरकाम" } },
  { id: "packer", words: { en: "Packing / warehouse", hi: "पैकिंग / गोदाम", mr: "पॅकिंग / गोदाम" } },
  { id: "petrol", words: { en: "Petrol pump attendant", hi: "पेट्रोल पंप", mr: "पेट्रोल पंप" } },
  { id: "sales", words: { en: "Sales assistant", hi: "सेल्स", mr: "विक्री सहाय्यक" } },
] as const;
export type WantedRole = (typeof WANTED_ROLES)[number]["id"];

export const SKILLS = [
  { id: "cash", phrase: "handle cash and UPI payments", words: { en: "Handle cash & UPI", hi: "नकद और UPI संभालना", mr: "रोख व UPI व्यवहार" } },
  { id: "stock", phrase: "count stock and keep a stock register", words: { en: "Count stock / keep a register", hi: "स्टॉक गिनना / रजिस्टर", mr: "स्टॉक मोजणे / रजिस्टर" } },
  { id: "lift", phrase: "lift and arrange heavy stock", words: { en: "Lift heavy stock", hi: "भारी सामान उठाना", mr: "जड माल उचलणे" } },
  { id: "bike", phrase: "ride a two-wheeler with a driving licence", words: { en: "Ride a bike (have licence)", hi: "बाइक चलाना (लाइसेंस है)", mr: "दुचाकी चालवणे (लायसन्स आहे)" } },
  { id: "ownBike", phrase: "use my own bike for work", words: { en: "Have my own bike", hi: "अपनी बाइक है", mr: "स्वतःची दुचाकी आहे" } },
  { id: "maps", phrase: "use a smartphone and Google Maps", words: { en: "Smartphone & Google Maps", hi: "स्मार्टफोन और गूगल मैप", mr: "स्मार्टफोन व गूगल मॅप" } },
  { id: "customers", phrase: "talk politely to customers", words: { en: "Talk to customers", hi: "ग्राहकों से बात करना", mr: "ग्राहकांशी बोलणे" } },
  { id: "cooking", phrase: "cook meals and snacks", words: { en: "Cooking", hi: "खाना बनाना", mr: "स्वयंपाक" } },
  { id: "cutting", phrase: "do vegetable cutting and kitchen cleaning", words: { en: "Cutting & kitchen cleaning", hi: "कटिंग और किचन सफ़ाई", mr: "चिरणे व किचन स्वच्छता" } },
  { id: "cleaning", phrase: "do cleaning: sweeping, mopping and washing utensils", words: { en: "Jhadu, pocha, bartan", hi: "झाड़ू, पोछा, बर्तन", mr: "झाडू, पोछा, भांडी" } },
  { id: "english", phrase: "read English labels", words: { en: "Read English labels", hi: "अंग्रेज़ी लेबल पढ़ना", mr: "इंग्रजी लेबल वाचणे" } },
  { id: "computer", phrase: "do basic billing on a computer", words: { en: "Billing on computer", hi: "कंप्यूटर पर बिलिंग", mr: "कॉम्प्युटरवर बिलिंग" } },
] as const;
export type SkillId = (typeof SKILLS)[number]["id"];
export type SkillAnswer = "yes" | "no" | "learning";

export const SHIFTS = [
  { id: "morning", words: { en: "Morning", hi: "सुबह", mr: "सकाळ" } },
  { id: "day", words: { en: "Day", hi: "दिन", mr: "दिवस" } },
  { id: "evening", words: { en: "Evening", hi: "शाम", mr: "संध्याकाळ" } },
  { id: "night", words: { en: "Night", hi: "रात", mr: "रात्र" } },
] as const;
export type Shift = (typeof SHIFTS)[number]["id"];

export const DURATIONS = {
  under6m: { en: "less than 6 months", hi: "6 महीने से कम", mr: "6 महिन्यांपेक्षा कमी" },
  "6to12m": { en: "6–12 months", hi: "6–12 महीने", mr: "6–12 महिने" },
  "1to2y": { en: "1–2 years", hi: "1–2 साल", mr: "1–2 वर्षे" },
  over2y: { en: "more than 2 years", hi: "2 साल से ज़्यादा", mr: "2 वर्षांपेक्षा जास्त" },
} satisfies Record<string, Words>;
export type Duration = keyof typeof DURATIONS;

export const LEFT_BECAUSE = {
  moved: { en: "moved to a new place", hi: "जगह बदली", mr: "जागा बदलली" },
  pay: { en: "pay was too low", hi: "पगार कम था", mr: "पगार कमी होता" },
  closed: { en: "the shop closed", hi: "दुकान बंद हुई", mr: "दुकान बंद झाले" },
  studies: { en: "studies", hi: "पढ़ाई", mr: "शिक्षण" },
  family: { en: "family reasons", hi: "घर के कारण", mr: "घरगुती कारण" },
  still: { en: "still working there", hi: "अभी भी वहीं हूँ", mr: "अजून तिथेच आहे" },
} satisfies Record<string, Words>;
export type LeftBecause = keyof typeof LEFT_BECAUSE;

// ---- A worker profile ----

const PastJob = z.object({
  role: z.string().trim().min(1).max(60),
  place: z.string().trim().min(1).max(80),
  duration: z.enum(Object.keys(DURATIONS) as [Duration, ...Duration[]]),
  leftBecause: z.enum(Object.keys(LEFT_BECAUSE) as [LeftBecause, ...LeftBecause[]]).optional(),
});

export const WorkerProfileSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(60),
  phone: z.string().regex(/^[6-9]\d{9}$/), // 10-digit Indian mobile
  livesIn: z.string().trim().min(1).max(60), // village / town / Pune area
  inPune: z.enum(["yes", "can_move", "no"]),
  stay: z.enum(["own", "needs_room", "relative"]),
  languages: z.array(z.string().max(20)).max(6),
  roles: z.array(z.enum(WANTED_ROLES.map((r) => r.id) as [WantedRole, ...WantedRole[]])).min(1),
  skills: z.partialRecord(z.enum(SKILLS.map((s) => s.id) as [SkillId, ...SkillId[]]), z.enum(["yes", "no", "learning"])),
  pastJobs: z.array(PastJob).max(3),
  shifts: z.array(z.enum(SHIFTS.map((s) => s.id) as [Shift, ...Shift[]])),
  daysPerWeek: z.number().int().min(1).max(7).optional(),
  canJoin: z.enum(["now", "week", "month"]),
  expectedPay: z.number().int().min(0).max(100000).optional(),
  consent: z.literal(true),
  source: z.enum(["sample", "this_phone"]),
});
export type WorkerProfile = z.infer<typeof WorkerProfileSchema>;

const JOIN_TEXT = { now: "immediately", week: "within a week", month: "within a month" };
const STAY_TEXT = {
  own: "has own place to stay",
  needs_room: "needs a room to stay",
  relative: "can stay with a relative in Pune",
};
const PUNE_TEXT = { yes: "lives in Pune now", can_move: "willing to move to Pune", no: "cannot move to Pune" };

// The profile as plain sentences. This is what the AI reads and quotes as proof, so every
// "can" / "cannot" is written out in full ("Cannot ride a two-wheeler…").
export function profileToText(p: WorkerProfile) {
  const roleWords = p.roles.map((r) => WANTED_ROLES.find((x) => x.id === r)!.words.en.toLowerCase());
  const said = (answer: SkillAnswer) => SKILLS.filter((s) => p.skills[s.id] === answer).map((s) => s.phrase);
  const lines = [
    `${p.name}. Phone ${p.phone}.`,
    `Lives in ${p.livesIn}; ${PUNE_TEXT[p.inPune]}; ${STAY_TEXT[p.stay]}.`,
    p.languages.length ? `Speaks ${p.languages.join(", ")}.` : "",
    `Wants work as: ${roleWords.join(", ")}.`,
    ...said("yes").map((s) => `Can ${s}.`),
    ...said("no").map((s) => `Cannot ${s}.`),
    ...said("learning").map((s) => `Learning to ${s}.`),
    p.pastJobs.length === 0
      ? "No past work experience yet."
      : `Past work: ${p.pastJobs
          .map((j) => `${j.role} at ${j.place} for ${DURATIONS[j.duration].en}${j.leftBecause ? ` (left because: ${LEFT_BECAUSE[j.leftBecause].en})` : ""}`)
          .join("; ")}.`,
    p.shifts.length ? `Available for ${p.shifts.join(", ")} shift${p.shifts.length > 1 ? "s" : ""}.` : "",
    p.daysPerWeek ? `Can work ${p.daysPerWeek} days a week.` : "",
    `Can join ${JOIN_TEXT[p.canJoin]}.`,
    p.expectedPay ? `Expected pay ₹${p.expectedPay.toLocaleString("en-IN")} a month.` : "",
  ];
  return lines.filter(Boolean).join(" ");
}

// Which wanted roles fit each kind of job the owner describes.
const ROLES_FOR_JOB: Record<RoleKey, WantedRole[]> = {
  counter: ["counter", "petrol", "sales"],
  helper: ["helper", "packer"],
  delivery: ["delivery"],
  kitchen: ["kitchen"],
  other: ["cleaner", "helper", "sales"],
};

export const MAX_MATCH_POOL = 12;

// Plain code narrows the pool before the AI reads it: people who want this kind of work
// first, then those with more "yes" skills; people who can't come to Pune go last.
// Keeps the AI call small and fast.
export function pickCandidates(workers: WorkerProfile[], roleKey: RoleKey, limit = MAX_MATCH_POOL) {
  const fits = ROLES_FOR_JOB[roleKey];
  const rank = (w: WorkerProfile) =>
    (w.roles.some((r) => fits.includes(r)) ? 100 : 0) +
    (w.inPune === "no" ? -50 : 0) +
    Object.values(w.skills).filter((a) => a === "yes").length;
  return [...workers].sort((a, b) => rank(b) - rank(a)).slice(0, limit);
}

// Turns profiles into the same shape as pasted replies, so the existing ranking runs on them.
export function workersAsApplicants(workers: WorkerProfile[]): Applicant[] {
  return workers.map((w, i) => ({
    id: `W${i + 1}`,
    index: i + 1,
    text: profileToText(w).slice(0, 1000),
    phone: w.phone,
    senderName: w.name,
    junkReason: null,
  }));
}

// ---- Sample workers (all names and phone numbers are made up) ----
const s = (p: Omit<WorkerProfile, "consent" | "source">): WorkerProfile => ({ ...p, consent: true, source: "sample" });

export const SAMPLE_WORKERS: WorkerProfile[] = [
  s({ id: "s01", name: "Sachin Pawar", phone: "9000010001", livesIn: "Satara (village)", inPune: "can_move", stay: "relative", languages: ["Marathi", "Hindi"], roles: ["counter", "helper"], skills: { cash: "yes", stock: "yes", customers: "yes", bike: "no" }, pastJobs: [{ role: "Counter staff", place: "a kirana shop in Satara", duration: "1to2y", leftBecause: "moved" }], shifts: ["evening"], daysPerWeek: 6, canJoin: "week", expectedPay: 12000 }),
  s({ id: "s02", name: "Nikhil Jadhav", phone: "9000010002", livesIn: "Kothrud, Pune", inPune: "yes", stay: "own", languages: ["Marathi", "Hindi"], roles: ["counter"], skills: { cash: "yes", stock: "yes", customers: "yes" }, pastJobs: [{ role: "Helper", place: "a wine shop in Kothrud", duration: "6to12m", leftBecause: "closed" }], shifts: ["evening", "night"], daysPerWeek: 7, canJoin: "now", expectedPay: 12000 }),
  s({ id: "s03", name: "Deepak Shinde", phone: "9000010003", livesIn: "Ahmednagar (town)", inPune: "can_move", stay: "needs_room", languages: ["Marathi"], roles: ["counter", "petrol"], skills: { cash: "yes", stock: "learning" }, pastJobs: [{ role: "Cashier", place: "a petrol pump in Ahmednagar", duration: "6to12m", leftBecause: "pay" }], shifts: ["evening"], daysPerWeek: 6, canJoin: "now", expectedPay: 13000 }),
  s({ id: "s04", name: "Akash More", phone: "9000010004", livesIn: "Kothrud, Pune", inPune: "yes", stay: "own", languages: ["Marathi", "Hindi", "English"], roles: ["counter", "sales"], skills: { cash: "yes", stock: "yes", computer: "yes", customers: "yes" }, pastJobs: [{ role: "Cashier", place: "a supermarket in Kothrud", duration: "over2y", leftBecause: "studies" }], shifts: ["morning"], daysPerWeek: 6, canJoin: "week", expectedPay: 15000 }),
  s({ id: "s05", name: "Ravi Kumar", phone: "9000010005", livesIn: "Latur (village)", inPune: "can_move", stay: "needs_room", languages: ["Hindi", "Marathi"], roles: ["helper", "kitchen"], skills: { cash: "no", lift: "yes", cutting: "yes" }, pastJobs: [{ role: "Waiter", place: "a hotel in Latur", duration: "6to12m", leftBecause: "pay" }], shifts: ["evening"], daysPerWeek: 6, canJoin: "month", expectedPay: 11000 }),
  s({ id: "s06", name: "Ganesh Patil", phone: "9000010006", livesIn: "Hadapsar, Pune", inPune: "yes", stay: "own", languages: ["Marathi"], roles: ["petrol", "counter"], skills: { cash: "yes", customers: "yes" }, pastJobs: [{ role: "Petrol pump attendant", place: "a petrol pump in Hadapsar", duration: "1to2y", leftBecause: "still" }], shifts: ["day"], daysPerWeek: 6, canJoin: "week", expectedPay: 13000 }),
  s({ id: "s07", name: "Vaibhav Kale", phone: "9000010007", livesIn: "Beed (village)", inPune: "can_move", stay: "relative", languages: ["Marathi", "Hindi"], roles: ["delivery", "helper"], skills: { bike: "yes", ownBike: "yes", maps: "yes", lift: "yes" }, pastJobs: [{ role: "Delivery boy", place: "a medical store in Beed", duration: "1to2y", leftBecause: "moved" }], shifts: ["day", "evening"], daysPerWeek: 7, canJoin: "now", expectedPay: 14000 }),
  s({ id: "s08", name: "Imran Shaikh", phone: "9000010008", livesIn: "Aundh, Pune", inPune: "yes", stay: "own", languages: ["Hindi", "Marathi"], roles: ["delivery"], skills: { bike: "yes", ownBike: "yes", maps: "yes", customers: "yes" }, pastJobs: [{ role: "Delivery rider", place: "a food delivery app in Pune", duration: "1to2y", leftBecause: "pay" }], shifts: ["evening"], daysPerWeek: 6, canJoin: "now", expectedPay: 14000 }),
  s({ id: "s09", name: "Pooja Gaikwad", phone: "9000010009", livesIn: "Karve Nagar, Pune", inPune: "yes", stay: "own", languages: ["Marathi", "Hindi"], roles: ["counter", "sales"], skills: { cash: "yes", customers: "yes", computer: "learning" }, pastJobs: [{ role: "Counter staff", place: "a medical store in Karve Nagar", duration: "6to12m", leftBecause: "family" }], shifts: ["day"], daysPerWeek: 6, canJoin: "week", expectedPay: 11000 }),
  s({ id: "s10", name: "Sunita Waghmare", phone: "9000010010", livesIn: "Solapur (village)", inPune: "can_move", stay: "needs_room", languages: ["Marathi"], roles: ["cleaner", "kitchen"], skills: { cleaning: "yes", cutting: "yes", cooking: "yes" }, pastJobs: [{ role: "House help", place: "homes in Solapur", duration: "over2y", leftBecause: "moved" }], shifts: ["morning", "day"], daysPerWeek: 7, canJoin: "week", expectedPay: 9000 }),
  s({ id: "s11", name: "Rahul Deshmukh", phone: "9000010011", livesIn: "Baner, Pune", inPune: "yes", stay: "own", languages: ["Marathi", "Hindi"], roles: ["kitchen"], skills: { cutting: "yes", cooking: "learning", cleaning: "yes" }, pastJobs: [{ role: "Kitchen helper", place: "a café in Baner", duration: "6to12m", leftBecause: "closed" }], shifts: ["day"], daysPerWeek: 6, canJoin: "now", expectedPay: 12000 }),
  s({ id: "s12", name: "Mahesh Bhosale", phone: "9000010012", livesIn: "Kolhapur (town)", inPune: "no", stay: "own", languages: ["Marathi"], roles: ["helper"], skills: { lift: "yes" }, pastJobs: [{ role: "Loader", place: "a godown in Kolhapur", duration: "1to2y", leftBecause: "still" }], shifts: ["day"], daysPerWeek: 6, canJoin: "month", expectedPay: 12000 }),
  s({ id: "s13", name: "Ajay Kamble", phone: "9000010013", livesIn: "Nanded (village)", inPune: "can_move", stay: "needs_room", languages: ["Marathi", "Hindi"], roles: ["helper", "packer"], skills: { lift: "yes", english: "yes", stock: "yes" }, pastJobs: [{ role: "Packer", place: "a warehouse in Bhosari MIDC, Pune", duration: "6to12m", leftBecause: "family" }], shifts: ["day", "night"], daysPerWeek: 6, canJoin: "now", expectedPay: 12000 }),
  s({ id: "s14", name: "Santosh Jagtap", phone: "9000010014", livesIn: "Karve Nagar, Pune", inPune: "yes", stay: "own", languages: ["Marathi"], roles: ["helper", "delivery"], skills: { lift: "yes", bike: "yes", ownBike: "no", customers: "yes" }, pastJobs: [{ role: "Helper", place: "a kirana store in Karve Nagar", duration: "1to2y", leftBecause: "pay" }], shifts: ["day", "evening"], daysPerWeek: 7, canJoin: "now", expectedPay: 11000 }),
  s({ id: "s15", name: "Kiran Sonawane", phone: "9000010015", livesIn: "Satara (village)", inPune: "can_move", stay: "relative", languages: ["Marathi"], roles: ["counter", "helper"], skills: { cash: "learning", stock: "no", lift: "yes" }, pastJobs: [], shifts: ["evening"], daysPerWeek: 6, canJoin: "now", expectedPay: 10000 }),
  s({ id: "s16", name: "Priya Salunkhe", phone: "9000010016", livesIn: "Hadapsar, Pune", inPune: "yes", stay: "own", languages: ["Marathi", "Hindi", "English"], roles: ["sales", "counter"], skills: { customers: "yes", cash: "yes", english: "yes", computer: "yes" }, pastJobs: [{ role: "Sales assistant", place: "a mobile shop in Hadapsar", duration: "6to12m", leftBecause: "pay" }], shifts: ["day"], daysPerWeek: 6, canJoin: "week", expectedPay: 13000 }),
  s({ id: "s17", name: "Amol Thorat", phone: "9000010017", livesIn: "Ahmednagar (village)", inPune: "can_move", stay: "needs_room", languages: ["Marathi"], roles: ["petrol", "helper"], skills: { cash: "yes", lift: "yes" }, pastJobs: [{ role: "Petrol pump attendant", place: "a petrol pump near Ahmednagar", duration: "6to12m", leftBecause: "moved" }], shifts: ["night"], daysPerWeek: 7, canJoin: "now", expectedPay: 12000 }),
  s({ id: "s18", name: "Firoz Pathan", phone: "9000010018", livesIn: "Kondhwa, Pune", inPune: "yes", stay: "own", languages: ["Hindi", "Marathi"], roles: ["delivery"], skills: { bike: "yes", ownBike: "no", maps: "yes" }, pastJobs: [{ role: "Courier boy", place: "a courier company in Pune", duration: "6to12m", leftBecause: "closed" }], shifts: ["day"], daysPerWeek: 6, canJoin: "week", expectedPay: 13000 }),
  s({ id: "s19", name: "Lata Pawar", phone: "9000010019", livesIn: "Kothrud, Pune", inPune: "yes", stay: "own", languages: ["Marathi"], roles: ["cleaner"], skills: { cleaning: "yes", cooking: "yes" }, pastJobs: [{ role: "Office cleaner", place: "an office in Kothrud", duration: "1to2y", leftBecause: "pay" }], shifts: ["morning"], daysPerWeek: 6, canJoin: "now", expectedPay: 9000 }),
  s({ id: "s20", name: "Sagar Kshirsagar", phone: "9000010020", livesIn: "Latur (town)", inPune: "can_move", stay: "relative", languages: ["Marathi", "Hindi"], roles: ["kitchen"], skills: { cooking: "yes", cutting: "yes", cleaning: "yes" }, pastJobs: [{ role: "Cook", place: "a dhaba near Latur", duration: "over2y", leftBecause: "pay" }], shifts: ["evening"], daysPerWeek: 7, canJoin: "month", expectedPay: 15000 }),
  s({ id: "s21", name: "Vishal Gawade", phone: "9000010021", livesIn: "Wakad, Pune", inPune: "yes", stay: "own", languages: ["Marathi", "Hindi"], roles: ["counter", "helper"], skills: { cash: "yes", stock: "yes", customers: "yes", lift: "yes" }, pastJobs: [{ role: "Counter staff", place: "a wine shop in Wakad", duration: "1to2y", leftBecause: "pay" }], shifts: ["evening", "night"], daysPerWeek: 6, canJoin: "week", expectedPay: 14000 }),
  s({ id: "s22", name: "Rohan Mane", phone: "9000010022", livesIn: "Sangli (village)", inPune: "no", stay: "own", languages: ["Marathi"], roles: ["delivery"], skills: { bike: "yes", ownBike: "yes" }, pastJobs: [{ role: "Delivery boy", place: "a dairy in Sangli", duration: "under6m", leftBecause: "still" }], shifts: ["morning"], daysPerWeek: 6, canJoin: "month", expectedPay: 12000 }),
  s({ id: "s23", name: "Dnyaneshwar Shinde", phone: "9000010023", livesIn: "Beed (village)", inPune: "can_move", stay: "needs_room", languages: ["Marathi"], roles: ["helper", "packer"], skills: { lift: "yes", english: "no" }, pastJobs: [{ role: "Loader", place: "a sugar factory near Beed", duration: "6to12m", leftBecause: "moved" }], shifts: ["day"], daysPerWeek: 6, canJoin: "now", expectedPay: 11000 }),
  s({ id: "s24", name: "Neha Kulkarni", phone: "9000010024", livesIn: "Aundh, Pune", inPune: "yes", stay: "own", languages: ["Marathi", "Hindi", "English"], roles: ["sales", "counter"], skills: { customers: "yes", cash: "yes", english: "yes", stock: "learning" }, pastJobs: [{ role: "Sales assistant", place: "a clothes shop in Aundh", duration: "6to12m", leftBecause: "studies" }], shifts: ["evening"], daysPerWeek: 5, canJoin: "now", expectedPay: 12000 }),
];
