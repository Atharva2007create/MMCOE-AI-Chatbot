# MMCOE AI Chatbot

MMCOE Vector AI is a browser-based educational chatbot for MMCOE admissions, fees, courses, and campus information. It keeps the MMCOE identity and existing user-facing features while routing Gemini requests through secure server-side API functions.

## What is included

- Responsive vanilla HTML/CSS/JavaScript interface with light/dark themes.
- Gemini chat with Google Search grounding, server-side authentication, moderation, translation, and text-to-speech routes.
- English, Hindi, and Marathi translation/audio controls.
- Browser-local chat history; no user accounts or application database.
- Safe Markdown rendering with sanitization, bounded conversation context, request cancellation, retries, and accessible controls.
- Vercel-compatible `/api` serverless functions and security headers.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Set `GEMINI_API_KEY` in `.env.local` for real Gemini responses. Never commit that value or put it in frontend code. Without a key, the UI and mocked/static checks still run, but AI routes return a configuration error.

The local development server is available at `http://localhost:3000`.

## Verify changes

```bash
npm run check
npm audit --audit-level=high
```

The check command builds local assets and runs API validation, safe-rendering, and static security tests.

## Deploy to Vercel

Import this repository into Vercel, keep the default Node.js runtime, and configure `GEMINI_API_KEY` as a Vercel Environment Variable for the environments you deploy. Chat, moderation, and translation default to the stable `gemini-3.5-flash` model. TTS remains on the dedicated `gemini-2.5-flash-preview-tts` model because Gemini 3.5 Flash does not generate audio. Optional server-side overrides are `GEMINI_CHAT_MODEL` and `GEMINI_TTS_MODEL`. Redeploy after changing environment variables.

## Project layout

```text
index.html              Frontend shell and MMCOE-branded styles
src/app.js              Browser behavior and same-origin API client
api/chat.js             Gemini chat and Search grounding
api/moderate.js         Safety moderation
api/translate.js        Hindi/Marathi translation
api/tts.js              Multilingual speech synthesis
api/_lib/               Shared HTTP, Gemini, and prompt helpers
scripts/                Asset build and local development tooling
tests/                  Mocked API, rendering, and static checks
docs/                   System overview, baseline, repair plan, and status
```

## Deployment checklist

1. Configure `GEMINI_API_KEY` only in Vercel Environment Variables.
2. Revoke any API key that was previously exposed in an older commit.
3. Run `npm run check` before deployment.
4. Perform real Gemini, mobile, browser-audio, and microphone acceptance checks after deployment.

### Prerequisites

- Modern browser with JavaScript enabled.
- HTTPS for deployed speech-recognition use.
- Stable internet connection for Gemini-backed features.

🔥 Built with Passion by MMCOE Students 🔥
