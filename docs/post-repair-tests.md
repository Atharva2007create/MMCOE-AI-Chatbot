# Post-repair test report

Run date: 2026-09-07  
Branch: `master`

## Automated checks

All commands completed successfully:

```text
npm run check
npm audit --audit-level=high --cache .npm-cache
node --check src/app.js
node --check scripts/dev-server.mjs
node --check tests/mock-server.mjs
node --check api/chat.js
node --check api/moderate.js
node --check api/translate.js
node --check api/tts.js
```

Results:

- Build generated local Tailwind, marked, DOMPurify, and Lucide assets.
- Six API/contract tests passed.
- Four security/regression tests passed.
- One DOM sanitization test passed.
- Nineteen implementation/security assertions passed.
- `npm audit` reported 0 vulnerabilities.
- `git diff --check` reported no whitespace errors (Git may normalize `index.html` line endings on the next checkout).

The build prints a non-failing Browserslist maintenance notice about `caniuse-lite`; this is a dependency-data freshness warning, not an application error.

## Gemini 3.5 migration and production diagnosis

- Official Google documentation confirms `gemini-3.5-flash` is stable and supports GenerateContent plus Google Search grounding.
- Chat, moderation, and translation now default to `gemini-3.5-flash`; Gemini 3 sampling overrides were removed and explicit thinking levels were added.
- Moderation now has a sufficient output allowance with minimal thinking, fixing the deployed `MODERATION_UNAVAILABLE` failure caused by the previous eight-token limit.
- TTS remains on `gemini-2.5-flash-preview-tts`, which is a supported audio-generation model. Gemini 3.5 Flash itself does not support audio output.

## API boundary checks without credentials

Direct invocation of each local handler returned safe, redacted responses without exposing a secret:

| Endpoint | Result |
|---|---|
| `/api/chat` | HTTP 503 `AI_NOT_CONFIGURED` |
| `/api/moderate` | HTTP 503 `MODERATION_UNAVAILABLE` |
| `/api/translate` | HTTP 503 `AI_NOT_CONFIGURED` |
| `/api/tts` | HTTP 503 `AI_NOT_CONFIGURED` |

This is the expected local behavior until `GEMINI_API_KEY` is supplied through `.env.local` or Vercel environment settings. No key was pasted into chat or committed.

## Mocked browser smoke test

`tests/mock-server.mjs` supplied harmless, non-production fixtures for chat, follow-up, translation, and PCM audio. A fresh in-app browser session verified:

- Initial branded UI and accessible control names.
- First chat request received one message; follow-up received three bounded messages.
- Grounded source rendered as a safe HTTPS link.
- Hindi and Marathi translation controls displayed fixture output.
- TTS completed without browser console errors or warnings.
- History list → detail → Back restored the list.
- Theme toggle changed its accessible label and visual state.

The mock server was stopped after testing. It is test-only and is not used by Vercel.

## Source/security checks

The browser-delivered `index.html`, `src/`, and `assets/` trees contain no Gemini credential, direct Google API URL, query-string key, runtime CDN dependency, v0 runtime reference, inline event handler, or `getUserMedia()` preflight call. Gemini authentication now exists only in `api/_lib/gemini.js` and is sent in the `x-goog-api-key` request header.

## Still requiring external validation

- Revoke the credential that was present in the baseline Git history and configure a replacement `GEMINI_API_KEY` in Vercel/local environment settings.
- Run real chat, Search grounding, moderation, Hindi/Marathi translation, and EN/HI/MR TTS checks against the configured Google project.
- Deploy a Vercel Preview and verify response headers/CSP and Function runtime behavior.
- Test actual desktop/mobile viewport sizes and physical microphone/speaker permission/lifecycle behavior on supported browsers.
- Have MMCOE content owners review volatile admissions, fee, contact, schedule, and safety information.
