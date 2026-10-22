# Hire Helper

A one-screen phone app that helps a small business owner in Maharashtra write a job post and find the 3 applicants most worth interviewing.

## The job to be done

> When I need to fill one or two permanent semi-skilled jobs at my small business and the applications pile up, most of them missing my basic requirements, I want to describe the job in one line and get back a clear job post with must-have questions, then a ranked top 3 of my applicants with a reason for each, so I can spend my time interviewing only the people most likely to turn up and do the work, instead of sifting every application and chasing no-shows.

**User:** the owner of a small business in Maharashtra with no HR staff (a shop, café, garage, workshop or small warehouse). They hire 1–2 permanent semi-skilled workers at a time, such as a delivery rider, cook, mechanic's helper, packer or store assistant, at around ₹15,000 a month. They post jobs on WhatsApp and free job sites, and use the app on their phone between customers.

## The 3 tests the MVP must pass

1. **Create a post.** Type *"Need a helper for my two-wheeler garage in Pune, ₹15,000 a month, 6 days a week, must know basic servicing and have a two-wheeler licence"* and tap **Create post**. Within 15 seconds, a ready-to-share job post and 3–5 must-have screening questions appear on the same screen, with a **Copy** button. A different business, such as *"cook for my small café"*, gets a post and questions that fit that job.
2. **Rank applicants.** Tap **Load sample applicants** (8 short replies with names and phone numbers) or paste your own, then tap **Rank**. Within 20 seconds, the top 3 appear. Each has a score out of 100, a one-line reason naming which must-haves they meet or miss, and a **Send WhatsApp reminder** button (when the reply has a phone number) that opens WhatsApp with an interview message already typed.
3. **Handle bad input.** With the box empty, **Create post** shows *"Please describe the job"* and makes no AI call. Something vague like *"need staff"* shows which details are missing (role, pay, area or must-haves) within 15 seconds, instead of a made-up post. A blank or meaningless reply is marked **Not enough info** and is never placed in the top 3.

## Current workflow → future workflow

| Step | Today (without the app) | With Hire Helper |
|---|---|---|
| Write the job post | Types a rushed one-liner into WhatsApp; key details (pay, days, licence) often left out | Types one line; gets a clean post with pay, hours and must-haves, or is told exactly what's missing |
| Screen applicants | Reads every reply one by one between customers, often in 3 languages | Pastes all replies (or a copied WhatsApp chat) at once |
| Decide who to call | Goes by gut feel; misses that someone has no licence or only works weekends | Sees a top 3 with a score, ✓/✗/? per must-have, and the applicant's own words as proof |
| Invite to interview | Finds the number, opens WhatsApp, types the same message again and again | Taps **Send WhatsApp reminder**; the message is already typed, they just press Send |
| Result | Hours of sifting, interviews with people who don't meet the basics, no-shows | A few minutes of work, interviews only with people who meet the must-haves |

## Architecture: Input → AI → Logic → Action → Output

### Flow A: create a post
| Stage | What happens |
|---|---|
| **Input** | One line typed by the owner, e.g. the garage line above |
| **Logic (before AI)** | Empty or over 500 characters → message shown, no AI call |
| **AI** | Gemini copies the owner's exact words for role, pay, area and a must-have, and writes the post, the must-haves (one checkable item each) and 3–5 questions in the owner's language |
| **Logic (after AI)** | Code checks each copied detail really appears in what the owner typed; anything not found is listed as missing. The answer's shape is checked with zod |
| **Action** | Owner reads the post and taps **Copy**, then shares it on WhatsApp or job sites |
| **Output** | The post, its must-haves and questions, or *"Please add: pay"* (for example) |

### Flow B: rank applicants
| Stage | What happens |
|---|---|
| **Input** | Pasted replies (blank-line separated, or copied straight from a WhatsApp chat), or **Load sample applicants** |
| **Logic (before AI)** | Code splits the replies (one applicant per WhatsApp sender), finds Indian mobile numbers (including Marathi digits), and marks obvious junk as *Not enough info*. If nothing usable is left, no AI call |
| **AI** | For each applicant: name, and for each must-have *met / missed / unclear* with the applicant's exact words as proof; up to 2 extra strengths; whether the reply has enough info |
| **Logic (after AI)** | Code checks every quoted proof is really in the reply (else the ✓ becomes ?), drops "strengths" that repeat a must-have, scores (must-haves up to 90 points, +5 per strength), keeps *Not enough info* out, sorts and takes the top 3, and builds the WhatsApp links |
| **Action** | Owner checks each card and taps **Send WhatsApp reminder**, then presses Send in WhatsApp |
| **Output** | 3 cards (name, score/100, reason, ✓/✗/? with proof, original reply, WhatsApp button) and a *Not enough info* list |

## Where AI is used, and what stays plain code

| Step | Done by | Why |
|---|---|---|
| Is the job description complete? Writing the post and questions | **AI** | Owners write pay as "15k", "₹15,000 pm" or "pandhra hazaar", and jobs vary from cooks to packers; no template fits all |
| Does a reply meet each must-have? | **AI** | "Did oil change and brake work at a Hero service centre" means *basic servicing: met*, even though the word never appears; replies mix English, Hinglish and Marathi |
| Writing practice replies for the job on screen | **AI** | Sample data has to fit whatever job was typed |
| Empty-box check, length limits | Code | A simple yes/no rule |
| Splitting replies, reading WhatsApp chats, finding phone numbers | Code | Fixed patterns; the AI can't invent a phone number |
| Checking the AI's quotes against the real text | Code | Stops the AI from ticking a must-have or "finding" a salary nobody wrote |
| Score, reason, top 3, keeping *Not enough info* out | Code | Same judgements always give the same result |
| WhatsApp link and message, Copy button | Code | A fixed template and the browser clipboard |

## What stays human

- Writing the one-line job description, and adding details when asked.
- Reading the post before sharing it, and sharing it (the app posts nowhere).
- Collecting replies and pasting them in.
- Checking each top-3 card; the original reply and the proof words are shown so a wrong tick is easy to spot.
- Choosing whom to contact. The button only opens WhatsApp with the text typed; the owner presses Send and can change the words.
- Setting the interview time, interviewing and deciding whom to hire.

## Why these tools

| Tool | Why |
|---|---|
| **Next.js** | One project holds both the phone screen and the small server routes that call the AI, so the API key stays on the server. Deploys to Vercel in one click |
| **Google Gemini API** (`@google/genai`) | Has a free API key, which matters for a hackathon. JSON mode returns answers in a fixed shape. The app asks 2 Gemini models at once and uses the first good answer, because free-plan speed and quotas vary a lot |
| **zod** | Checks every AI answer has exactly the right fields before the screen uses it |
| **WhatsApp click-to-chat links** (`wa.me`) | Opens WhatsApp with the message typed, with no WhatsApp Business account, approval or cost |
| **Tailwind CSS** | Quick, phone-first styling without writing separate CSS files |

## Failure cases and how the app handles them

| What can go wrong | What the owner sees |
|---|---|
| Empty job box, or over 500 characters | *"Please describe the job"* / *"Please keep it to one or two lines"*; no AI call |
| Vague or incomplete description | *"Please add: role, pay, area, must-haves"* (only the missing ones); no made-up post |
| AI ticks a must-have without proof | Code can't find the quoted words in the reply, so it shows **?** instead of ✓ |
| AI invents a detail such as "As discussed" for pay | Code can't find those words in the description, so pay is listed as missing |
| Blank, junk or off-topic replies, or a reply trying to trick the AI | Listed under **Not enough info**, never in the top 3 |
| Replies copied from WhatsApp without blank lines | Split by sender automatically |
| No phone number in a reply | *"No phone number found"*; no WhatsApp button |
| A Gemini model is slow, busy or out of free quota | The other model's answer is used; a failing model is skipped until it recovers |
| Every model fails or times out | *"The AI is busy right now. Please try again."* within the time limit; old results are cleared, typed text is kept |
| Too many requests on the free plan | *"Too many requests on the free AI plan. Wait a minute and try again."* |
| API key missing or wrong | *"The app isn't set up yet (API key missing / is wrong)"* |
| Browser blocks the clipboard | Falls back to an older copy method; if that fails too, *"Press and hold the text to copy it"* |

**Known limits:** nothing is saved (refreshing clears everything); the free Gemini plan allows only about 15 requests a minute per model, and some models only 20 a day; the AI can still be cautious and mark a real skill as **?**, which the owner can see and judge from the original reply.

## How to run it locally

1. Install [Node.js](https://nodejs.org) (LTS) and [git](https://git-scm.com).
2. Get the code and install the packages:
   ```bash
   git clone https://github.com/Anshuldhapte/hire-helper.git
   cd hire-helper
   npm install
   ```
3. Get a free Gemini API key at <https://aistudio.google.com/apikey>.
4. Save the key (Windows): `npm run set-key`, then paste the key when asked; it's hidden while you paste. On Mac or Linux, create a file named `.env.local` containing `GEMINI_API_KEY=your-key`. Git ignores `.env.local`, so the key is never committed.
5. Start the app with `npm run dev` and open <http://localhost:3000> (on a phone-sized window for the real feel).

### Deploy to Vercel

Import the GitHub repo at <https://vercel.com/new>, add `GEMINI_API_KEY` under **Settings → Environment Variables**, and deploy.

## Project layout

- `app/page.tsx`: the one screen
- `app/api/create-post`, `app/api/rank`, `app/api/samples`: the three AI routes
- `lib/ai.ts`: Gemini calls, time limits and the model pool
- `lib/quote.ts`: checks the AI's quoted words really appear in the original text
- `lib/applicants.ts`: splitting replies, WhatsApp chats, phone numbers, junk filter, scoring and top 3
- `lib/whatsapp.ts`: click-to-chat links
- `scripts/set-gemini-key.ps1`: saves your key into `.env.local` without showing it
