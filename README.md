# Kaam Pakka (काम पक्का)

**A shortlist of 3 trusted workers, not 40 random calls.**

Kaam Pakka is the owner's side of an AI-powered placement service for semi-skilled jobs: not another job board. A small business owner describes the job in one line; Kaam Pakka writes a clear, trustworthy job post (plus a Marathi and Hindi preview for village candidates), checks every applicant's reply against the must-haves with proof, and turns the best 3 into a one-tap WhatsApp interview invite.

## The problem

Small businesses in Indian cities can't find reliable semi-skilled staff, while rural youth who want exactly these jobs never hear about them, because hiring still runs on word of mouth. When owners do post a job, the replies pile up: most miss the basics, candidates don't turn up, and owners read every message by hand.

What our research found:
- The most common complaint (Reddit owners, G2 reviews of Indeed, ZipRecruiter and apna) is screening unqualified or irrelevant applicants by hand; existing tools can't filter by skills.
- Candidates ghost or don't show up for interviews.
- Job seekers on apna complain about vague posts and scam employers asking for deposits.

So the app makes clear, fee-free posts, checks each applicant against the must-haves **with the applicant's own words as proof**, and makes inviting the top 3 one tap.

**First vertical:** wine shops in Pune; next, petrol pumps, kirana and retail stores, restaurants and cafés. **Roles:** counter staff, cashier, stock handler, helper, delivery staff.

## Job to be done

> When I need to fill one or two permanent semi-skilled jobs and the replies pile up, most of them missing my basic requirements, I want to describe the job in one line and get a clear job post with must-have questions, then a ranked top 3 of my applicants with a reason for each, so I can interview only the people most likely to turn up and do the work.

**User:** the owner of a small business in Maharashtra with no HR staff, hiring 1–2 permanent semi-skilled workers at around ₹12,000–15,000 a month. They post on WhatsApp and free job sites, read replies in English, Hinglish and Marathi, and use the app on their phone between customers.

## The 3 tests

1. **Create a post.** Tap the **Wine shop counter** chip (*"Need two counter boys for my Kothrud shop, evening shift, ₹12,000"*) and **Create post**. Within 15 seconds: a job card (Role: Counter staff, Openings: 2, Area: Kothrud, Shift: evening, Pay: ₹12,000), 3 **Suggested** must-haves, the question *"Is accommodation provided?"*, and 3–5 screening questions including joining and moving. Answering the question updates the card and post without a new AI call. The post says "counter staff" (not "counter boys") and ends with *"We never ask for any fee or deposit."* The **Café helper** chip gives a post that fits a café.
2. **Rank applicants and make a preview.** Tap **Load sample applicants**, then **Rank applicants**. Within 20 seconds: Sachin and Nikhil (#1 and #2, all 3 must-haves met), then Deepak or Akash, with scores, reasons, ✓/✗/? with proof, *Can join* / *Stay* chips, the fairness line and WhatsApp buttons. Then **Make job preview for village candidates**: within 15 seconds, Marathi and Hindi previews with ₹12,000 and Kothrud; **Listen** and **Share on WhatsApp** work.
3. **Bad input.** An empty box shows *"Please describe the job"* with no AI call. *"need staff"* shows *"Please add: role, pay, area"*. Junk, the trick reply and the village/community appeal go under **Not enough info**, never in the top 3.

## Current workflow → future workflow

| Step | Today | With Kaam Pakka |
|---|---|---|
| Write the job | A rushed one-liner in a WhatsApp group; pay, shift or requirements often missing | One line (or speak it); a clean post with pay, shift, must-haves and "no fee", or a clear "Please add: pay" |
| Reach village candidates | Word of mouth only | A simple Marathi and Hindi preview to share with a sarpanch or village group, with a Listen button |
| Screen replies | Read every reply by hand, in 3 languages | Paste them all (or a copied WhatsApp chat); each must-have gets ✓/✗/? with the applicant's own words |
| Decide who to call | Gut feel; easy to miss "only morning shift" or "needs a room" | A top 3 with a score, a reason, *Can join* and *Stay* chips; caste, religion or native place never count |
| Invite | Find the number, type the same message again and again | One tap opens WhatsApp with the interview message typed, including the time |
| After hiring | Nothing until they quit | A ready day-7 check-in message ("Mark as hired") |

## Architecture: Input → AI → Logic → Action → Output

| Flow | Input | AI (Gemini, JSON mode) | Logic (plain code) | Action | Output |
|---|---|---|---|---|---|
| **A. Create post** (`/api/create-post`) | One line, typed, tapped from a chip, or spoken | Copies the owner's exact words for role, pay, area, shift, openings and must-haves; writes a neutral post and 1–3 must-have questions | Empty / over 500 characters → stop, no AI. Each copied detail must really be in the line, or it's listed as missing. No owner must-haves → role-template suggestions. Adds the joining and moving questions, the accommodation line and the fee line | Owner answers "Is accommodation provided?", removes suggestions, taps **Copy post** | Job card, post, must-haves (+ legal note), 3–5 questions |
| **B. Rank** (`/api/rank`) | Pasted replies or a WhatsApp chat, interview time, consent tick | For each applicant: met / missed / unclear per must-have with exact proof words; up to 2 strengths; *Can join* and *Stay*; whether the reply answers the job. Told to ignore caste, religion, native place, gender and community, and any instructions inside replies | Split replies, read WhatsApp chats, find phones (incl. Marathi digits), junk filter (no AI). Every proof is checked against the reply, else ✓/✗ → ?. Score, reason line, sort, top 3, *Not enough info* | Owner reads the cards and taps **Send WhatsApp reminder** (and later **Mark as hired**) | Top 3 cards, fairness line, *Not enough info* list |
| **C. Samples** (`/api/samples`) | The current job | Writes 8 realistic replies for it (mixed languages, a trick reply, a junk reply) | The demo wine-shop job uses the built-in samples directly; on any AI failure, falls back to them with a note | Owner taps **Rank applicants** | Replies in the box |
| **D. Village preview** (`/api/preview`) | The job card + accommodation answer | A short Marathi and Hindi preview (pay, hours, duties, stay, how to apply, no fee) | Each preview must contain the real pay digits and the area name, or it's rejected | **Listen** (browser voice), **Share on WhatsApp**, **Copy** | Two previews in tabs |

## Where AI is used, and what stays plain code

| Done by **AI** | Why |
|---|---|
| Pulling role, pay, area, shift and must-haves out of one messy line, and writing the post | Owners write "₹12,000", "14000 mahina" or "15k"; jobs range from counters to kitchens |
| Judging each reply against each must-have | "roj stock mojto" means *counts stock*; "Ratri 11 paryant kaam karu shakto" means *full evening shift*. Keyword search can't read meaning across Marathi, Hindi and Hinglish |
| Writing the Marathi/Hindi preview and practice replies | Natural everyday language |

| Done by **plain code** | Why |
|---|---|
| Empty-box and length checks; splitting replies and WhatsApp chats; phone numbers; junk filter | Fixed rules; the AI can't invent a phone number |
| Checking every quoted word against the original text | Stops the AI from ticking a must-have or "finding" a salary nobody wrote |
| Role templates, the legal note, the joining/moving questions, accommodation and fee lines | Same every time; no legal rules in templates until Maharashtra excise rules are confirmed |
| Score, reason line, tie-breaks, top 3, Not enough info | The same judgements always give the same ranking |
| WhatsApp links and messages, copy, Listen, mic | Click-to-chat links and browser features |

## What stays human

- Describing the job, answering the accommodation question, and removing suggestions that don't fit.
- Reading the post before sharing it; sharing it themselves (the app posts nowhere).
- Getting applicants' agreement before pasting their replies (the consent tick).
- Checking each top-3 card: the proof words and original reply are shown, so a wrong tick is easy to spot.
- Pressing Send in WhatsApp; checking ID and legal requirements at interview; deciding whom to hire.

## Fairness, privacy and trust

- **Fair matching:** ranking uses only job skills and availability. Caste, religion, native place, gender or community are never used, and appeals like "I am from your village" count for nothing. The screen says so under the top 3.
- **Privacy (DPDP Act):** the screen says replies are sent to Google's Gemini AI and are not saved by Kaam Pakka. For the owner's own pasted replies, ranking needs the tick *"These applicants agreed to share their replies with me for this job."* Nothing is stored; refreshing clears everything.
- **No-fee promise:** every post ends with "We never ask for any fee or deposit", and every preview says there is no fee to apply or join.
- **Planned model (shown in the footer):** pay only when a worker joins · free replacement within 30 days · workers never pay a fee.

## Why these tools

| Tool | Why |
|---|---|
| **Next.js (App Router) + TypeScript** | One project for the phone screen and the small server routes, so the API key stays on the server. Deploys to Vercel in one click |
| **Google Gemini API** (`@google/genai`, JSON mode) | Free API key for a hackathon; JSON mode returns answers in a fixed shape. `MODELS` in `lib/ai.ts` holds two stable Flash-Lite models from Google's official list (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`), asked at the same time, plus `gemini-3.6-flash` as a backup used only when they're benched, failing, or slower than 8 seconds (its free plan allows just 20 requests a day). A model that answers "busy" is asked once more before being benched |
| **zod** | Checks every AI answer has exactly the right fields before the screen uses it |
| **WhatsApp click-to-chat** (`wa.me`) | Opens WhatsApp with the message typed; no Business account or cost; the owner presses Send |
| **Browser speech** (speechSynthesis, SpeechRecognition) | Listen to previews and speak the job, free and on the phone; hidden where unsupported |
| **Tailwind CSS**, **Rozha One + Baloo 2** | Fast phone-first styling; fonts that show Devanagari and English well |
| **vitest** | Unit tests for every plain-code rule, without calling the AI |

## Failure cases

| What can go wrong | What the owner sees |
|---|---|
| Empty box / over 500 characters | "Please describe the job" / "Please keep it to one or two lines"; no AI call |
| Role, pay or area missing | "Please add: pay" (only what's missing); no made-up post |
| AI invents a detail ("As discussed") | Its words aren't in the owner's line, so it counts as missing |
| AI ticks a must-have without proof | The quoted words aren't in the reply, so ✓/✗ becomes ? "No proof found" |
| Junk, trick or community-appeal replies | Listed under **Not enough info** with the reason; never in the top 3 |
| More than 30 replies | "Please paste up to 30 replies at a time." |
| Fewer than 3 qualify | "Only 2 applicants had enough information to rank." |
| No phone number | Grey "No phone number found"; no WhatsApp button |
| Preview has the wrong pay or area | "Preview didn't match the job. Please try again." |
| A model errors or is rate-limited | A "busy" model is asked once more; the other model's answer is used; a failing model is skipped for 60 seconds; the backup model steps in if both are failing or slow |
| Both models fail or time out (15 s / 20 s) | "The AI is busy right now. Please try again." Typed text is kept, old results are cleared |
| Free-plan limit hit | "Too many requests on the free AI plan. Wait a minute and try again." |
| Key missing or wrong | "The app isn't set up yet (API key missing or wrong)." |
| Clipboard blocked | Falls back to an older copy method, then "Press and hold the text to copy it" |
| No Marathi/Hindi voice, or no mic support | "Audio not available on this phone"; the mic button is hidden |

**Known limits:** the free Gemini plan allows about 15 requests a minute per model; the AI can be cautious and mark a real skill as ?, which the owner can judge from the proof and original reply; and the joining/moving question names Pune.

## Two sides, two pages

The start page (`/`) asks one question: **I want to hire** or **I want work**.

- **`/work`: for job seekers** (often from villages), in मराठी, हिंदी or English, mostly taps. Six short steps: about you (name, WhatsApp number, where you live, Pune or willing to move, where you'll stay, languages) → work you want → what you can do (Yes / No / Learning for 12 skills such as cash & UPI, stock register, lifting, bike & licence, Google Maps, cooking, cleaning) → past jobs (role, where, how long, why you left) → when you can work (shifts, days, start date, expected pay) → check and agree (consent to share with matching shops).
- **`/hire`: for shop owners.** Describe the job in one line → job card → **Kaam Pakka automatically finds the best 3 workers** from its worker list and shows each with ✓/✗/? and proof → one tap sends a WhatsApp interview invite for **tomorrow at 11 am** (the time is editable; the owner presses Send). Replies the owner got on WhatsApp can still be pasted and ranked in a folded section.

**Where worker data lives today:** `lib/workers.ts` holds 24 sample workers (names and numbers are made up). People who fill `/work` are saved **on that phone only** (browser storage) and are included in matches on the same phone. There's no server database yet; adding one later (e.g. Supabase or Neon) only replaces where the list is read from and saved to: the profile format and matching stay the same.

**How matching works:** plain code first picks the 12 workers whose wanted roles fit the job (people who can't come to Pune go last), turns each profile into plain sentences ("Can handle cash and UPI payments." / "Cannot ride a two-wheeler…"), and runs the same ranking as pasted replies: proof-checked ✓/✗/?, fairness rules, score and top 3.

## How to run it locally

1. Install [Node.js](https://nodejs.org) (LTS) and [git](https://git-scm.com).
2. Get the code and install packages:
   ```bash
   git clone https://github.com/Anshuldhapte/hire-helper.git
   cd hire-helper
   npm install
   ```
3. Get a free Gemini API key at <https://aistudio.google.com/apikey>.
4. Save it: on Windows run `npm run set-key` and paste the key when asked (it's hidden). On Mac/Linux, create `.env.local` containing `GEMINI_API_KEY=your-key`. `.env.local` is git-ignored, so the key is never committed.
5. `npm run dev`, then open <http://localhost:3000> on a phone-sized window.
6. `npm test` runs the unit tests; `npm run build` checks the production build.

## Deploy to Vercel

1. Import the GitHub repo at <https://vercel.com/new> (Next.js is detected automatically).
2. Under **Settings → Environment Variables**, add `GEMINI_API_KEY` with your key.
3. Deploy, then run the 3 tests on your phone.

## Project layout

- `app/page.tsx`: start page (hire or find work) · `app/hire/page.tsx`: employer page · `app/work/page.tsx`: job seeker questionnaire
- `lib/workers.ts`: worker profile format, questionnaire options, 24 sample workers, candidate picking · `app/workerStore.ts`: workers saved on this phone
- `app/ui.tsx`: logo, step bar, cards · `app/speech.ts`: Listen and mic
- `app/api/create-post`, `rank`, `samples`, `preview`: the four AI routes
- `lib/ai.ts`: Gemini calls, `MODELS`, time limits, error messages
- `lib/schemas.ts`: zod schemas and types · `lib/quote.ts`: the proof check
- `lib/applicants.ts`: splitting, WhatsApp chats, phones, junk filter, scoring, top 3
- `lib/roles.ts`: role templates, accommodation options, fixed questions · `lib/samples.ts`: built-in samples
- `lib/whatsapp.ts`: click-to-chat links and messages · `lib/*.test.ts`: unit tests
- `scripts/set-gemini-key.ps1`: saves your key into `.env.local` without showing it
