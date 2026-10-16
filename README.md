# StudyOS AI

A personal software-engineering study app for the 30-day plan that runs from **17 October 2026** to **15 November 2026**. It is a Next.js web app. Progress, notes, quizzes, sessions, and chats are stored in MongoDB. The phone-style layout works in a mobile browser.

The Gemini API key stays on the server. The browser never receives it.

## What you can do

- See today's topic, planned time, checklist, streak, and roadmap progress from saved records.
- Open any of the 30 days, check off topics, and write notes. Opening a day does not complete it.
- Run a study timer that pauses and resumes from timestamps, so leaving the page does not invent extra time.
- Take a topic quiz, review wrong answers, and keep the attempt.
- Ask the AI tutor, save an answer as a note, and generate a quiz or revision notes after you confirm.
- Schedule revision, export a backup, and import it after a confirmation when ids already exist.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Name | Purpose |
| --- | --- |
| `MONGO_URI` | Mongo connection. Use `mongodb://127.0.0.1:27017/studyos` so this app does not write into the Flow database. |
| `GEMINI_API_KEY` | Gemini key from [Google AI Studio](https://aistudio.google.com/apikey). Server only. |
| `GEMINI_MODEL` | Model id. Default `gemini-3.5-flash`. |
| `GEMINI_MAX_OUTPUT_TOKENS` | Cap on a single answer. Default 2048. |
| `STUDYOS_API_TOKEN` | Bearer token for `/api/v1/*` routes. |
| `APP_TIMEZONE` | Calendar timezone. Default `Asia/Kolkata`. |

Start MongoDB 7:

```bash
docker compose up -d
```

This uses the same Mongo major version as the Flow project. The database name is `studyos`, not `flow`.

```bash
npm run dev
```

Open http://localhost:3000.

## Scripts

```bash
npm run dev
npm run test
npm run typecheck
npm run lint
npm run build
npm start
```

## API

All AI routes require `Authorization: Bearer $STUDYOS_API_TOKEN`.

- `GET /api/v1/health`
- `POST /api/v1/ai/chat`
- `POST /api/v1/ai/explain`
- `POST /api/v1/ai/quiz`
- `POST /api/v1/ai/notes`
- `POST /api/v1/sync`

Requests are limited to 32 KB and about 20 AI calls per 10 minutes per key. A Gemini 429 is not retried. If the configured model returns 404, the server tries `gemini-3.5-flash` and then `gemini-3.6-flash` once.

## Gemini cost

Gemini bills by tokens, and the free tier has daily quotas that change. See the current limits at https://ai.google.dev/gemini-api/docs/rate-limits. This app counts each upstream request on the Profile page. It does not stream, and it caps output tokens. Do not commit a real key.

## Data

MongoDB collections: roadmap days, completions, day state, notes, conversations, messages, sessions, quiz questions, quiz attempts, revision items, preferences, and AI usage. Roadmap content is seeded from `src/data/roadmap.json`, transcribed from the supplied plan.

A streak counts a local calendar date once when that day's checklist is complete or a finished session exists for that date. The current streak includes today, or yesterday if today is not finished yet.

Revision gaps default to 1, then 3, then 7 days. Completed on 17 October, the reviews fall on 18 October, 21 October, and 28 October.

Backup files use `{ "format": "studyos-backup", "version": 1, ... }`. Import skips the write when note ids already exist unless you confirm replace. Newer `updatedAt` wins when a sync payload is posted to `/api/v1/sync`.

## Reminders

Reminders use the browser Notification API. Allow them from Profile. They are scheduled while the site is open, and the browser or OS can delay them. Turning notifications off clears the list that would be scheduled. Tapping a study reminder opens that day. Tapping a revision reminder opens the note or day. This is not a push service, and delivery is not exact.

## Tests

`npm test` covers the roadmap dates, progress, streaks, the study timer, revision dates, quiz scoring, backup validation, sync conflicts, and Gemini error mapping. Gemini is not called. The suite does not need an API key.

## Limits

- This build is a Next.js website, not an Android APK.
- Offline reading needs a connection to this app and MongoDB. There is no on-device database.
- AI features need network access and a valid Gemini key.
- Browser reminders do not fire after the tab has been closed.
