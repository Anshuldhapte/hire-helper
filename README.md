# Hire Helper

A one-screen phone app for small business owners in Maharashtra (shops, cafés, garages, workshops, small warehouses) who hire 1–2 semi-skilled workers at a time and have no HR staff.

1. **Describe the job in one line** → get a WhatsApp-ready job post, the must-haves, and 3–5 screening questions, with a Copy button. If the line is missing the role, pay, area or must-haves, the app says what to add instead of making things up.
2. **Paste applicants' replies** (separated by blank lines, or copied straight from a WhatsApp chat) → get a top 3, each with a score out of 100, a one-line reason, a ✓/✗/? per must-have, and a **Send WhatsApp reminder** button that opens WhatsApp with an interview message already typed.

Blank or meaningless replies are marked **Not enough info** and never reach the top 3.

## How it decides

| Step | Done by |
|---|---|
| Is the job description complete? Write the post and questions | AI (Gemini) |
| Does each reply meet each must-have? Any extra strengths? | AI (Gemini) |
| Empty-box check, splitting replies, junk filter, phone numbers | Plain code |
| Score (must-haves up to 90, +5 per strength), reason, top 3, WhatsApp links | Plain code |

The AI only judges text. Plain code does all the counting and ranking, so the same judgements always give the same result. Each AI step finishes within its time limit: every question goes to the two best Gemini models that are working right now, the first good answer is used, and the slower request is cancelled. A model that runs out of free daily quota or keeps failing is skipped until it recovers.

Every ✓ must come with the applicant's own words as proof, and plain code checks those words really appear in the reply; if they don't, the ✓ becomes "? Not clear". The proof is shown on each card.

## Run it locally

1. Install [Node.js](https://nodejs.org) (LTS), then in this folder run `npm install`.
2. Get a free Gemini API key at <https://aistudio.google.com/apikey>.
3. Save the key with `npm run set-key` (it asks for the key and hides it while you paste). This writes `.env.local`, which git ignores, so the key is never committed.
4. Run `npm run dev` and open <http://localhost:3000>.

## Deploy to Vercel

1. Push this repo to GitHub.
2. On <https://vercel.com/new>, import the repo (Next.js is detected automatically).
3. Under **Settings → Environment Variables**, add `GEMINI_API_KEY` with your key, then deploy.

## Project layout

- `app/page.tsx`: the one screen
- `app/api/create-post`, `app/api/rank`, `app/api/samples`: the three AI routes
- `lib/ai.ts`: Gemini calls, time limits and backup model
- `lib/applicants.ts`: splitting replies, phone numbers, junk filter, scoring and top 3
- `lib/whatsapp.ts`: click-to-chat links
