"use client";
// "I want work": a short questionnaire for job seekers (often from villages), in Marathi,
// Hindi or English, mostly taps. It records what they can and can't do, past jobs and when
// they can work, so employers can be matched with them.
import Link from "next/link";
import { useState } from "react";
import { findPhone } from "@/lib/applicants";
import {
  DURATIONS,
  LEFT_BECAUSE,
  SHIFTS,
  SKILLS,
  WANTED_ROLES,
  WorkerProfileSchema,
  type Duration,
  type Lang,
  type LeftBecause,
  type Shift,
  type SkillAnswer,
  type SkillId,
  type WantedRole,
  type WorkerProfile,
} from "@/lib/workers";
import { speak, useVoices, voiceFor } from "../speech";
import { Card, Logo, Notice, primaryButton, secondaryButton } from "../ui";
import { saveLocalWorker } from "../workerStore";

// Every word on this page, in the 3 languages.
const T = {
  title: { en: "Find work near Pune", hi: "पुणे के पास काम पाएं", mr: "पुण्याजवळ काम मिळवा" },
  intro: {
    en: "Answer a few questions. Shops that need someone like you will message you on WhatsApp. No fee, ever.",
    hi: "कुछ सवालों के जवाब दें। जिन दुकानों को आप जैसे व्यक्ति की ज़रूरत है, वे WhatsApp पर संदेश भेजेंगी। कोई फ़ीस नहीं।",
    mr: "काही प्रश्नांची उत्तरे द्या. ज्या दुकानांना तुमच्यासारखी व्यक्ती हवी आहे, ते WhatsApp वर मेसेज करतील. कोणतीही फी नाही.",
  },
  step: { en: "Step", hi: "चरण", mr: "पायरी" },
  of: { en: "of", hi: "में से", mr: "पैकी" },
  next: { en: "Next", hi: "आगे", mr: "पुढे" },
  back: { en: "Back", hi: "पीछे", mr: "मागे" },
  about: { en: "About you", hi: "आपके बारे में", mr: "तुमच्याबद्दल" },
  name: { en: "Your name", hi: "आपका नाम", mr: "तुमचे नाव" },
  phone: { en: "WhatsApp number", hi: "WhatsApp नंबर", mr: "WhatsApp नंबर" },
  livesIn: { en: "Where do you live now? (village / town)", hi: "अभी कहाँ रहते हैं? (गाँव / शहर)", mr: "आता कुठे राहता? (गाव / शहर)" },
  inPune: { en: "Do you live in Pune?", hi: "क्या आप पुणे में रहते हैं?", mr: "तुम्ही पुण्यात राहता का?" },
  inPuneYes: { en: "Yes, in Pune", hi: "हाँ, पुणे में", mr: "हो, पुण्यात" },
  inPuneMove: { en: "No, but I can move", hi: "नहीं, पर आ सकता/सकती हूँ", mr: "नाही, पण येऊ शकतो/शकते" },
  inPuneNo: { en: "No, I can't move", hi: "नहीं, नहीं आ सकता/सकती", mr: "नाही, येऊ शकत नाही" },
  stay: { en: "Where will you stay?", hi: "कहाँ रहेंगे?", mr: "कुठे राहाल?" },
  stayOwn: { en: "I have a place", hi: "मेरे पास जगह है", mr: "माझ्याकडे जागा आहे" },
  stayRelative: { en: "With a relative", hi: "रिश्तेदार के पास", mr: "नातेवाईकांकडे" },
  stayRoom: { en: "I need a room", hi: "मुझे कमरा चाहिए", mr: "मला खोली हवी" },
  languages: { en: "Languages you speak", hi: "आप कौन सी भाषा बोलते हैं", mr: "तुम्ही कोणत्या भाषा बोलता" },
  roles: { en: "What work do you want?", hi: "आपको कौन सा काम चाहिए?", mr: "तुम्हाला कोणते काम हवे?" },
  rolesHint: { en: "Pick one or more.", hi: "एक या ज़्यादा चुनें।", mr: "एक किंवा जास्त निवडा." },
  skills: { en: "What can you do?", hi: "आप क्या कर सकते हैं?", mr: "तुम्ही काय करू शकता?" },
  skillsHint: { en: "Be honest: shops trust Kaam Pakka because of this.", hi: "सच बताएं: इसी से दुकानें काम पक्का पर भरोसा करती हैं।", mr: "खरे सांगा: यामुळेच दुकाने काम पक्कावर विश्वास ठेवतात." },
  yes: { en: "Yes", hi: "हाँ", mr: "हो" },
  no: { en: "No", hi: "नहीं", mr: "नाही" },
  learning: { en: "Learning", hi: "सीख रहा हूँ", mr: "शिकतोय" },
  past: { en: "Past work", hi: "पहले का काम", mr: "आधीचे काम" },
  workedBefore: { en: "Have you worked before?", hi: "क्या आपने पहले काम किया है?", mr: "तुम्ही आधी काम केले आहे का?" },
  jobRole: { en: "What was your work?", hi: "आपका काम क्या था?", mr: "तुमचे काम काय होते?" },
  jobRolePh: { en: "e.g. counter staff, helper", hi: "जैसे काउंटर, हेल्पर", mr: "उदा. काउंटर, मदतनीस" },
  jobPlace: { en: "Where?", hi: "कहाँ?", mr: "कुठे?" },
  jobPlacePh: { en: "e.g. kirana shop in Satara", hi: "जैसे सातारा की किराना दुकान", mr: "उदा. साताऱ्यातील किराणा दुकान" },
  howLong: { en: "How long?", hi: "कितने समय?", mr: "किती काळ?" },
  whyLeft: { en: "Why did you leave?", hi: "क्यों छोड़ा?", mr: "का सोडले?" },
  addJob: { en: "+ Add another job", hi: "+ एक और काम जोड़ें", mr: "+ आणखी काम जोडा" },
  removeJob: { en: "Remove", hi: "हटाएं", mr: "काढा" },
  when: { en: "When can you work?", hi: "कब काम कर सकते हैं?", mr: "कधी काम करू शकता?" },
  shifts: { en: "Which shifts?", hi: "कौन सी शिफ़्ट?", mr: "कोणती शिफ्ट?" },
  days: { en: "Days a week", hi: "हफ़्ते में दिन", mr: "आठवड्यात दिवस" },
  join: { en: "When can you start?", hi: "कब से शुरू कर सकते हैं?", mr: "कधीपासून सुरू करू शकता?" },
  joinNow: { en: "Right away", hi: "तुरंत", mr: "लगेच" },
  joinWeek: { en: "Within a week", hi: "एक हफ़्ते में", mr: "एका आठवड्यात" },
  joinMonth: { en: "Within a month", hi: "एक महीने में", mr: "एका महिन्यात" },
  pay: { en: "Pay you expect per month (optional)", hi: "महीने का अपेक्षित पगार (ज़रूरी नहीं)", mr: "महिन्याचा अपेक्षित पगार (ऐच्छिक)" },
  check: { en: "Check and agree", hi: "जाँचें और सहमति दें", mr: "तपासा आणि संमती द्या" },
  consent: {
    en: "I agree that Kaam Pakka can share these answers and my WhatsApp number with shops that have a matching job.",
    hi: "मैं सहमत हूँ कि काम पक्का ये जवाब और मेरा WhatsApp नंबर मिलते-जुलते काम वाली दुकानों से साझा कर सकता है।",
    mr: "मी सहमत आहे की काम पक्का ही उत्तरे आणि माझा WhatsApp नंबर जुळणाऱ्या कामाच्या दुकानांना देऊ शकते.",
  },
  submit: { en: "Join Kaam Pakka", hi: "काम पक्का से जुड़ें", mr: "काम पक्कामध्ये सामील व्हा" },
  doneTitle: { en: "You're on the Kaam Pakka worker list!", hi: "आप काम पक्का की सूची में हैं!", mr: "तुम्ही काम पक्काच्या यादीत आहात!" },
  doneText: {
    en: "When a shop needs someone like you, they'll message you on WhatsApp for an interview. You never pay any fee.",
    hi: "जब किसी दुकान को आप जैसे व्यक्ति की ज़रूरत होगी, वे इंटरव्यू के लिए WhatsApp पर संदेश भेजेंगे। आपको कभी कोई फ़ीस नहीं देनी।",
    mr: "एखाद्या दुकानाला तुमच्यासारखी व्यक्ती हवी असेल, तेव्हा ते मुलाखतीसाठी WhatsApp वर मेसेज करतील. तुम्हाला कधीही फी द्यावी लागत नाही.",
  },
  demoNote: {
    en: "Demo: your answers are saved on this phone only, and shops using Kaam Pakka on this phone can find you.",
    hi: "डेमो: आपके जवाब सिर्फ़ इसी फ़ोन में सेव हैं; इसी फ़ोन पर काम पक्का इस्तेमाल करने वाली दुकानें आपको देख सकती हैं।",
    mr: "डेमो: तुमची उत्तरे फक्त याच फोनवर सेव्ह आहेत; याच फोनवर काम पक्का वापरणारी दुकाने तुम्हाला पाहू शकतात.",
  },
  another: { en: "Add another person", hi: "दूसरे व्यक्ति को जोड़ें", mr: "दुसरी व्यक्ती जोडा" },
  hiring: { en: "Hiring? Go to the shop page →", hi: "स्टाफ चाहिए? दुकान पेज पर जाएं →", mr: "कामगार हवा? दुकान पेजवर जा →" },
  needName: { en: "Please write your name.", hi: "कृपया नाम लिखें।", mr: "कृपया नाव लिहा." },
  needPhone: { en: "Please write a 10-digit mobile number.", hi: "कृपया 10 अंकों का मोबाइल नंबर लिखें।", mr: "कृपया 10 अंकी मोबाईल नंबर लिहा." },
  needPlace: { en: "Please write where you live.", hi: "कृपया लिखें कि आप कहाँ रहते हैं।", mr: "कृपया तुम्ही कुठे राहता ते लिहा." },
  needPune: { en: "Please answer about Pune and where you'll stay.", hi: "कृपया पुणे और रहने की जगह के बारे में बताएं।", mr: "कृपया पुणे आणि राहण्याबद्दल सांगा." },
  needRole: { en: "Please pick at least one kind of work.", hi: "कृपया कम से कम एक काम चुनें।", mr: "कृपया किमान एक काम निवडा." },
  needWorked: { en: "Please tell us about your past work (or choose No).", hi: "कृपया पहले के काम के बारे में बताएं (या नहीं चुनें)।", mr: "कृपया आधीच्या कामाबद्दल सांगा (किंवा नाही निवडा)." },
  needShift: { en: "Please pick a shift and when you can start.", hi: "कृपया शिफ़्ट और शुरू करने का समय चुनें।", mr: "कृपया शिफ्ट आणि सुरू करण्याची वेळ निवडा." },
  needConsent: { en: "Please tick the box to agree.", hi: "कृपया सहमति के लिए बॉक्स पर टिक करें।", mr: "कृपया संमतीसाठी बॉक्सवर टिक करा." },
  notSaved: { en: "This phone blocked saving. Please try another browser.", hi: "यह फ़ोन सेव नहीं कर पाया। दूसरा ब्राउज़र आज़माएं।", mr: "हा फोन सेव्ह करू शकला नाही. दुसरा ब्राउझर वापरा." },
  listenMode: { en: "Listen mode", hi: "सुनने वाला मोड", mr: "ऐकण्याचा मोड" },
  listenOn: { en: "On: tap 🔊 to hear any question", hi: "चालू: कोई भी सवाल सुनने के लिए 🔊 दबाएं", mr: "चालू: कोणताही प्रश्न ऐकण्यासाठी 🔊 दाबा" },
  listenOff: { en: "Off: turn on to hear the questions", hi: "बंद: सवाल सुनने के लिए चालू करें", mr: "बंद: प्रश्न ऐकण्यासाठी चालू करा" },
  noAudio: { en: "This phone has no voice for this language.", hi: "इस फ़ोन में इस भाषा की आवाज़ नहीं है।", mr: "या फोनवर या भाषेचा आवाज नाही." },
  listen: { en: "Listen", hi: "सुनें", mr: "ऐका" },
  choices: { en: "Choices", hi: "विकल्प", mr: "पर्याय" },
} satisfies Record<string, Record<Lang, string>>;

const LANG_OPTIONS: { id: Lang; label: string }[] = [
  { id: "mr", label: "मराठी" },
  { id: "hi", label: "हिंदी" },
  { id: "en", label: "English" },
];
const SPOKEN = ["Marathi", "Hindi", "English", "Kannada", "Telugu", "Urdu"];
const STEPS = ["about", "roles", "skills", "past", "when", "check"] as const;

type Job = { role: string; place: string; duration: Duration | ""; leftBecause: LeftBecause | "" };
const EMPTY_JOB: Job = { role: "", place: "", duration: "", leftBecause: "" };

// A big tap button that shows when it's picked.
function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-12 rounded-xl px-4 py-2 text-base font-semibold ring-1 transition ${
        on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-brand-700 ring-brand-200 hover:bg-brand-50"
      }`}
    >
      {children}
    </button>
  );
}

// A question's words, with a 🔊 button (in Listen mode) that reads the question and its choices.
function Q({ text, choices = [], listen, onSay }: { text: string; choices?: string[]; listen: boolean; onSay: (words: string) => void }) {
  return (
    <span className="flex items-start justify-between gap-2">
      <span>{text}</span>
      {listen && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault(); // don't jump into the text box when inside a label
            // A pause between the question and each choice, without doubling "?." or "।."
            onSay([text, ...choices].map((s) => (/[.?!।]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`)).join(" "));
          }}
          aria-label={`🔊 ${text}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl ring-1 ring-brand-200 hover:bg-brand-100"
        >
          🔊
        </button>
      )}
    </span>
  );
}

const input =
  "h-12 w-full rounded-xl border-2 border-brand-100 bg-white px-4 text-base outline-none focus:border-brand-500";

export default function WorkPage() {
  const [lang, setLang] = useState<Lang>("en");
  const t = (k: keyof typeof T) => T[k][lang];
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<WorkerProfile | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [livesIn, setLivesIn] = useState("");
  const [inPune, setInPune] = useState<WorkerProfile["inPune"] | "">("");
  const [stay, setStay] = useState<WorkerProfile["stay"] | "">("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [roles, setRoles] = useState<WantedRole[]>([]);
  const [skills, setSkills] = useState<Partial<Record<SkillId, SkillAnswer>>>({});
  const [worked, setWorked] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<Job[]>([{ ...EMPTY_JOB }]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [days, setDays] = useState<number | null>(null);
  const [canJoin, setCanJoin] = useState<WorkerProfile["canJoin"] | "">("");
  const [pay, setPay] = useState("");
  const [consent, setConsent] = useState(false);

  const toggle = <V,>(list: V[], v: V) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const tenDigits = findPhone(phone);

  // ---- Listen mode: questions read aloud in the chosen language ----
  const [listen, setListen] = useState(false);
  const voices = useVoices();
  const voice = voiceFor(voices, lang);
  const say = (words: string) => {
    if (voice) speak(words, voice);
  };
  // Each step's title, read out when the step opens in Listen mode.
  const stepTitle = (s: number) =>
    [t("about"), t("roles"), t("skills"), t("past"), t("when"), t("check")][s] ?? "";
  const yesNoLearning = [t("yes"), t("no"), t("learning")];

  function goTo(s: number) {
    setError(null);
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (listen) say(stepTitle(s));
  }

  // Only what's needed to match fairly is required; everything else can be skipped.
  function problem(s: number): string | null {
    if (s === 0) {
      if (!name.trim()) return t("needName");
      if (!tenDigits) return t("needPhone");
      if (!livesIn.trim()) return t("needPlace");
      if (!inPune || !stay) return t("needPune");
    }
    if (s === 1 && roles.length === 0) return t("needRole");
    if (s === 3 && (worked === null || (worked && jobs.some((j) => !j.role.trim() || !j.place.trim() || !j.duration))))
      return t("needWorked");
    if (s === 4 && (shifts.length === 0 || !canJoin)) return t("needShift");
    if (s === 5 && !consent) return t("needConsent");
    return null;
  }

  function next() {
    const p = problem(step);
    if (p) {
      setError(p);
      if (listen) say(p);
      return;
    }
    goTo(step + 1);
  }

  function submit() {
    const p = problem(5);
    if (p) return setError(p);
    const parsed = WorkerProfileSchema.safeParse({
      id: `phone-${tenDigits}`,
      name: name.trim(),
      phone: tenDigits,
      livesIn: livesIn.trim(),
      inPune,
      stay,
      languages,
      roles,
      skills,
      pastJobs: worked
        ? jobs.map((j) => ({ role: j.role.trim(), place: j.place.trim(), duration: j.duration, leftBecause: j.leftBecause || undefined }))
        : [],
      shifts,
      daysPerWeek: days ?? undefined,
      canJoin,
      expectedPay: pay ? Number(pay) : undefined,
      consent: true,
      source: "this_phone",
    });
    if (!parsed.success) return setError(t("needWorked"));
    if (!saveLocalWorker(parsed.data)) return setError(t("notSaved"));
    setError(null);
    setSaved(parsed.data);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (listen) say(`${t("doneTitle")} ${t("doneText")}`);
  }

  function startOver() {
    setSaved(null);
    setStep(0);
    setName("");
    setPhone("");
    setLivesIn("");
    setInPune("");
    setStay("");
    setLanguages([]);
    setRoles([]);
    setSkills({});
    setWorked(null);
    setJobs([{ ...EMPTY_JOB }]);
    setShifts([]);
    setDays(null);
    setCanJoin("");
    setPay("");
    setConsent(false);
  }

  // Built on the latest list, so two quick taps never undo each other.
  const setJob = (i: number, changes: Partial<Job>) =>
    setJobs((list) => list.map((j, k) => (k === i ? { ...j, ...changes } : j)));

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-brand-100 bg-white/70 px-4 pb-4 pt-6">
        <div className="mx-auto max-w-[480px]">
          <div className="flex items-start justify-between gap-3">
            <Link href="/" aria-label="Kaam Pakka home">
              <Logo />
            </Link>
            <div className="mt-1 flex gap-1 rounded-full bg-white p-1 ring-1 ring-brand-100" role="group" aria-label="Language">
              {LANG_OPTIONS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLang(l.id)}
                  aria-pressed={lang === l.id}
                  className={`min-h-10 rounded-full px-3 text-sm font-bold ${lang === l.id ? "bg-brand-600 text-white" : "text-brand-700"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <h1 className="mt-4 text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-base text-muted">{t("intro")}</p>

          {/* Listen mode: for people who find reading hard. Reads the questions aloud. */}
          <button
            type="button"
            onClick={() => {
              const on = !listen;
              setListen(on);
              if (on) say(`${t("title")}. ${t("intro")} ${stepTitle(step)}`);
              else window.speechSynthesis?.cancel();
            }}
            aria-pressed={listen}
            className={`mt-4 flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 ${
              listen ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-ink ring-brand-200"
            }`}
          >
            <span className="text-2xl" aria-hidden>
              🔊
            </span>
            <span>
              <span className="block text-base font-bold">{t("listenMode")}</span>
              <span className={`block text-sm ${listen ? "text-white/90" : "text-muted"}`}>{listen ? t("listenOn") : t("listenOff")}</span>
            </span>
          </button>
          {listen && !voice && <p className="mt-2 text-sm font-semibold text-danger">{t("noAudio")}</p>}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-4 py-5">
        {saved ? (
          <Card>
            <p className="text-4xl" aria-hidden>
              ✅
            </p>
            <h2 className="mt-2 text-xl font-bold"><Q text={t("doneTitle")} choices={[t("doneText")]} listen={listen} onSay={say} /></h2>
            <p className="mt-2 text-base">{t("doneText")}</p>
            <p className="mt-3 rounded-xl bg-marigold-100 px-3 py-2 text-sm text-marigold-800">{t("demoNote")}</p>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-muted">
              {saved.name} · {saved.phone} · {saved.livesIn}
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <button type="button" onClick={startOver} className={primaryButton}>
                {t("another")}
              </button>
              <Link href="/hire" className={secondaryButton}>
                {t("hiring")}
              </Link>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-sm font-semibold text-muted">
              {t("step")} {step + 1} {t("of")} {STEPS.length}
            </p>
            <div className="mb-4 mt-2 h-1.5 overflow-hidden rounded-full bg-brand-100">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>

            {step === 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("about")}</h2>
                <label className="flex flex-col gap-1 text-base font-semibold">
                  <Q text={t("name")} listen={listen} onSay={say} />
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={input} autoComplete="name" />
                </label>
                <label className="flex flex-col gap-1 text-base font-semibold">
                  <Q text={t("phone")} listen={listen} onSay={say} />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    maxLength={16}
                    placeholder="98xxxxxxxx"
                    className={input}
                    autoComplete="tel"
                  />
                </label>
                <label className="flex flex-col gap-1 text-base font-semibold">
                  <Q text={t("livesIn")} listen={listen} onSay={say} />
                  <input value={livesIn} onChange={(e) => setLivesIn(e.target.value)} maxLength={60} className={input} />
                </label>
                <fieldset>
                  <legend className="mb-2 w-full text-base font-semibold"><Q text={t("inPune")} choices={[t("inPuneYes"), t("inPuneMove"), t("inPuneNo")]} listen={listen} onSay={say} /></legend>
                  <div className="flex flex-wrap gap-2">
                    <Choice on={inPune === "yes"} onClick={() => setInPune("yes")}>{t("inPuneYes")}</Choice>
                    <Choice on={inPune === "can_move"} onClick={() => setInPune("can_move")}>{t("inPuneMove")}</Choice>
                    <Choice on={inPune === "no"} onClick={() => setInPune("no")}>{t("inPuneNo")}</Choice>
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 w-full text-base font-semibold"><Q text={t("stay")} choices={[t("stayOwn"), t("stayRelative"), t("stayRoom")]} listen={listen} onSay={say} /></legend>
                  <div className="flex flex-wrap gap-2">
                    <Choice on={stay === "own"} onClick={() => setStay("own")}>{t("stayOwn")}</Choice>
                    <Choice on={stay === "relative"} onClick={() => setStay("relative")}>{t("stayRelative")}</Choice>
                    <Choice on={stay === "needs_room"} onClick={() => setStay("needs_room")}>{t("stayRoom")}</Choice>
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 w-full text-base font-semibold"><Q text={t("languages")} choices={SPOKEN} listen={listen} onSay={say} /></legend>
                  <div className="flex flex-wrap gap-2">
                    {SPOKEN.map((l) => (
                      <Choice key={l} on={languages.includes(l)} onClick={() => setLanguages((list) => toggle(list, l))}>
                        {l}
                      </Choice>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            {step === 1 && (
              <fieldset>
                <legend className="w-full text-xl font-bold"><Q text={t("roles")} choices={WANTED_ROLES.map((r) => r.words[lang])} listen={listen} onSay={say} /></legend>
                <p className="mb-3 mt-1 text-base text-muted">{t("rolesHint")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {WANTED_ROLES.map((r) => (
                    <Choice key={r.id} on={roles.includes(r.id)} onClick={() => setRoles((list) => toggle(list, r.id))}>
                      {r.words[lang]}
                    </Choice>
                  ))}
                </div>
              </fieldset>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-xl font-bold"><Q text={t("skills")} listen={listen} onSay={say} /></h2>
                <p className="mb-3 mt-1 text-base text-muted">{t("skillsHint")}</p>
                <ul className="flex flex-col divide-y divide-brand-100">
                  {SKILLS.map((s) => (
                    <li key={s.id} className="py-3">
                      <p className="mb-2 text-base font-semibold"><Q text={s.words[lang]} choices={yesNoLearning} listen={listen} onSay={say} /></p>
                      <div className="grid grid-cols-3 gap-2" role="group" aria-label={s.words[lang]}>
                        {(["yes", "no", "learning"] as const).map((a) => (
                          <Choice key={a} on={skills[s.id] === a} onClick={() => setSkills((now) => ({ ...now, [s.id]: now[s.id] === a ? undefined : a }))}>
                            {t(a)}
                          </Choice>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("past")}</h2>
                <fieldset>
                  <legend className="mb-2 w-full text-base font-semibold"><Q text={t("workedBefore")} choices={[t("yes"), t("no")]} listen={listen} onSay={say} /></legend>
                  <div className="flex gap-2">
                    <Choice on={worked === true} onClick={() => setWorked(true)}>{t("yes")}</Choice>
                    <Choice on={worked === false} onClick={() => setWorked(false)}>{t("no")}</Choice>
                  </div>
                </fieldset>
                {worked &&
                  jobs.map((j, i) => (
                    <div key={i} className="rise-in flex flex-col gap-3 rounded-2xl bg-slate-50 p-4">
                      <label className="flex flex-col gap-1 text-base font-semibold">
                        <Q text={t("jobRole")} listen={listen} onSay={say} />
                        <input value={j.role} onChange={(e) => setJob(i, { role: e.target.value })} placeholder={t("jobRolePh")} maxLength={60} className={input} />
                      </label>
                      <label className="flex flex-col gap-1 text-base font-semibold">
                        <Q text={t("jobPlace")} listen={listen} onSay={say} />
                        <input value={j.place} onChange={(e) => setJob(i, { place: e.target.value })} placeholder={t("jobPlacePh")} maxLength={80} className={input} />
                      </label>
                      <fieldset>
                        <legend className="mb-2 w-full text-base font-semibold"><Q text={t("howLong")} choices={Object.values(DURATIONS).map((d) => d[lang])} listen={listen} onSay={say} /></legend>
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(DURATIONS) as Duration[]).map((d) => (
                            <Choice key={d} on={j.duration === d} onClick={() => setJob(i, { duration: d })}>
                              {DURATIONS[d][lang]}
                            </Choice>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset>
                        <legend className="mb-2 w-full text-base font-semibold"><Q text={t("whyLeft")} choices={Object.values(LEFT_BECAUSE).map((r) => r[lang])} listen={listen} onSay={say} /></legend>
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(LEFT_BECAUSE) as LeftBecause[]).map((r) => (
                            <Choice key={r} on={j.leftBecause === r} onClick={() => setJob(i, { leftBecause: j.leftBecause === r ? "" : r })}>
                              {LEFT_BECAUSE[r][lang]}
                            </Choice>
                          ))}
                        </div>
                      </fieldset>
                      {jobs.length > 1 && (
                        <button type="button" onClick={() => setJobs(jobs.filter((_, k) => k !== i))} className="self-start text-sm font-semibold text-danger">
                          {t("removeJob")}
                        </button>
                      )}
                    </div>
                  ))}
                {worked && jobs.length < 3 && (
                  <button type="button" onClick={() => setJobs([...jobs, { ...EMPTY_JOB }])} className={secondaryButton}>
                    {t("addJob")}
                  </button>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("when")}</h2>
                <fieldset>
                  <legend className="mb-2 w-full text-base font-semibold"><Q text={t("shifts")} choices={SHIFTS.map((s) => s.words[lang])} listen={listen} onSay={say} /></legend>
                  <div className="grid grid-cols-2 gap-2">
                    {SHIFTS.map((s) => (
                      <Choice key={s.id} on={shifts.includes(s.id)} onClick={() => setShifts((list) => toggle(list, s.id))}>
                        {s.words[lang]}
                      </Choice>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 w-full text-base font-semibold"><Q text={t("days")} choices={["5", "6", "7"]} listen={listen} onSay={say} /></legend>
                  <div className="flex gap-2">
                    {[5, 6, 7].map((d) => (
                      <Choice key={d} on={days === d} onClick={() => setDays(days === d ? null : d)}>
                        {d}
                      </Choice>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 w-full text-base font-semibold"><Q text={t("join")} choices={[t("joinNow"), t("joinWeek"), t("joinMonth")]} listen={listen} onSay={say} /></legend>
                  <div className="flex flex-wrap gap-2">
                    <Choice on={canJoin === "now"} onClick={() => setCanJoin("now")}>{t("joinNow")}</Choice>
                    <Choice on={canJoin === "week"} onClick={() => setCanJoin("week")}>{t("joinWeek")}</Choice>
                    <Choice on={canJoin === "month"} onClick={() => setCanJoin("month")}>{t("joinMonth")}</Choice>
                  </div>
                </fieldset>
                <label className="flex flex-col gap-1 text-base font-semibold">
                  <Q text={t("pay")} listen={listen} onSay={say} />
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted">₹</span>
                    <input
                      value={pay ? Number(pay).toLocaleString("en-IN") : ""}
                      onChange={(e) => setPay(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                      inputMode="numeric"
                      placeholder="12,000"
                      className={`${input} pl-8`}
                    />
                  </div>
                </label>
              </div>
            )}

            {step === 5 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold">{t("check")}</h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-2xl bg-slate-50 p-4 text-base">
                  <dt className="text-muted">{t("name")}</dt>
                  <dd className="font-semibold">{name}</dd>
                  <dt className="text-muted">{t("phone")}</dt>
                  <dd className="font-semibold">{tenDigits}</dd>
                  <dt className="text-muted">{t("roles")}</dt>
                  <dd className="font-semibold">{roles.map((r) => WANTED_ROLES.find((x) => x.id === r)!.words[lang]).join(", ")}</dd>
                  <dt className="text-muted">{t("skills")}</dt>
                  <dd className="font-semibold">
                    {SKILLS.filter((s) => skills[s.id] === "yes")
                      .map((s) => s.words[lang])
                      .join(", ") || "—"}
                  </dd>
                  <dt className="text-muted">{t("past")}</dt>
                  <dd className="font-semibold">{worked ? jobs.map((j) => `${j.role} · ${j.place}`).join("; ") : t("no")}</dd>
                </dl>
                <label className="flex min-h-11 items-start gap-3 text-base">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
                  <span className="flex-1"><Q text={t("consent")} listen={listen} onSay={say} /></span>
                </label>
              </div>
            )}

            {error && (
              <div className="mt-4">
                <Notice message={{ tone: "yellow", text: error }} />
              </div>
            )}

            <div className="mt-6 flex gap-3">
              {step > 0 && (
                <button type="button" onClick={() => { setError(null); setStep(step - 1); }} className={`${secondaryButton} flex-1`}>
                  {t("back")}
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={next} className={`${primaryButton} flex-1`}>
                  {t("next")}
                </button>
              ) : (
                <button type="button" onClick={submit} className={`${primaryButton} flex-1`}>
                  {t("submit")}
                </button>
              )}
            </div>
          </Card>
        )}

        <Link href="/hire" className="text-center text-base font-semibold text-brand-700 underline underline-offset-4">
          {t("hiring")}
        </Link>
      </main>

      <footer className="mt-auto bg-brand-900 px-4 py-4 text-center text-sm font-medium text-white">
        एक रुपया फीस नहीं · Workers never pay a fee
      </footer>
    </div>
  );
}
