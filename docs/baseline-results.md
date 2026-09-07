# MMCOE Vector baseline results

Run date: 2026-09-07 (Asia/Calcutta)  
Repository: `https://github.com/Atharva2007create/MMCOE-AI-Chatbot.git`  
Baseline branch/commit: `master` / `ec108647c202ea38007e27a7cd4ec87b37192376`  
Working branch: `fix/mmcoe-chatbot-reliability`

## Workspace and repository baseline

- The starting workspace was not a Git repository and contained only `work/` and `outputs/`.
- The named repository was cloned into `MMCOE-AI-Chatbot/`.
- `origin` fetch/push URL exactly matches the user-provided repository.
- The clone was clean before branch creation. Existing user changes were not present and no cleanup/reset/force operation was used.
- The remote `fix/code-cleanups` branch is commit `e2211b3...` and is already an ancestor of `master`, so its work is already included. A new requested branch was therefore created from current `master`.
- Baseline tracked tree: `README.md` and `index.html` only.
- No applicable `AGENTS.md` was found.
- No package manifest, package manager, dependency install step, build script, test suite, CI workflow, or deployment manifest existed.

## Local-run baseline

The current app is static and required no package installation. It was served with Python's existing standard-library server:

```text
python -m http.server 8000 --bind 127.0.0.1
```

Result: HTTP load succeeded at `http://127.0.0.1:8000/`. The server recorded 404 responses for the exported `/v0-runtime-dist.js` and favicon. Tailwind emitted its explicit “should not be used in production” warning. The main inline JavaScript parsed successfully with Node.

## Test matrix

| Check | Method | Result | Evidence/limits |
|---|---|---|---|
| Initial local loading/navigation | Local browser | Partial pass | Intro completed and main UI became accessible; coded intro blocks the UI for about six seconds. Missing v0 runtime returned 404. |
| Initial production loading | Public-site browser smoke | Pass | Branding, capability panel, chat, quick replies, history/theme/mic/send controls loaded. One tab, no destructive actions. |
| Simple educational question | Local real external API + one production smoke query | Fail | Both returned Google's invalid-authentication-credentials category. Credential value was not logged in this report. |
| Admission quick reply | Local browser / real endpoint boundary | UI pass, answer fail | Button submitted “How do I apply for admission?”; auth failure prevented answer validation. |
| Fee quick reply | Local browser / real endpoint boundary | UI pass, answer fail | Button submitted B.Tech fee query; auth failure prevented table/accuracy validation. |
| Course quick reply | Local browser / real endpoint boundary | UI pass, answer fail | Mechanical core-subject query submitted; auth failure prevented answer validation. |
| Follow-up conversation | Static inspection | Fail | Answer payload contains only the latest query, not earlier user/model turns. Real semantic check blocked by auth. |
| Marathi translation | Local browser / real endpoint boundary | Fail | UI displayed “Translation failed. Please try again.” |
| Hindi translation | Local browser / real endpoint boundary | Fail | UI displayed “Translation failed. Please try again.” |
| English/Hindi/Marathi TTS | Local browser / real endpoint boundary | Fail/unverified playback | No usable audio was produced; console reported missing/invalid audio data. Auth is invalid and configured TTS model ID is undocumented. No physical-output quality claim is made. |
| History list | Local browser | Pass with issues | Four locally generated question/error records appeared with timestamps. Upstream error text was persisted. |
| History detail | Local browser | Pass | Selecting a record opened question, answer, and timestamp. |
| History back | Local browser | Fail | Back control did not restore list because `loadChatHistory()` could no longer find `#history-list`. |
| History deletion/clear | Static inspection only | Not run | Production destructive history actions were explicitly avoided. Local delete has an event-bubbling defect; clear uses confirmation. |
| Theme switch | Local browser | Pass | Body changed from `antialiased` to `antialiased dark-mode`; theme persistence code is present. Full component visual regression is still required. |
| Desktop layout | Local browser + static inspection | Partial pass | Main two-column UI rendered and controls were reachable in the available browser surface. Horizontal geometry/visual regression remains to be formalized. |
| Phone layout | Static inspection; browser viewport attempt | Fail by inspection; manual confirmation required | No responsive breakpoint changes the fixed row layout; sidebar has a 240px minimum. The browser tool's requested phone viewport was not applied, so no claim of real-device validation is made. |
| Console/runtime errors | Local and production browser logs | Fail | Tailwind production warning. Local server additionally showed missing v0 runtime; TTS emitted missing/invalid audio data. |
| Speech recognition support initialization | Local browser console + static inspection | Partial | Browser constructed `SpeechRecognition`; physical mic was not activated. Lifecycle defects are confirmed statically. |
| Microphone lifecycle | Static inspection only | Fail by inspection | Acquired MediaStream is discarded without stopping tracks; manual stop can trigger `onend` auto-restart. No physical microphone was activated. |
| Unsafe rendering | Automated static checks + harmless local fixture | Fail | Fixture assigning harmless `<img onerror>` through the same raw-`innerHTML` pattern changed its own status to `event-handler-executed`. No production exploit payload was used. |
| API/model/schema documentation | Official Google sources | Fail/partial | Chat model `gemini-2.5-flash` is supported. TTS must be `gemini-2.5-flash-preview-tts`; current grounding uses chunks/supports; translation's `generationConfig.language` is not documented. |
| Vercel process | Repository inspection + official docs | Partial | Static root can deploy with preset “Other” and no build. Actual project settings/env/header/deployment provenance remain external. |

## Automated baseline checks

`node tests/baseline-static.mjs` passed 15 assertions that intentionally document the *presence* of baseline conditions, including direct browser credentials/calls, missing conversation state/cancellation/live region, obsolete grounding parsing, unsupported request/model configuration, storage use, and unsafe fallback rendering. These passing assertions do not mean the application behavior is correct; they make the defects reproducible until implementation replaces the tests with desired-behavior assertions.

`tests/unsafe-rendering-fixture.html` is isolated from production code, makes no API calls, and uses a harmless DOM marker to demonstrate why raw HTML cannot be the fallback.

## External API result and blockers

The exact failure category is **invalid authentication credentials**. It blocks real chat, moderation correctness, grounded citation output, translation, and generated-audio acceptance tests. The repository credential is also client-exposed and must be considered compromised even if it were re-enabled.

Required external work before final acceptance:

1. Revoke the exposed credential in the owning Google project.
2. Create/configure a replacement credential outside chat, restrict it appropriately, and store it as a Vercel server-side environment variable.
3. Confirm Gemini API/billing/quota/search-grounding/TTS access in the owning Google project.
4. Provide access to or screenshots/export of Vercel project build, environment, domain, Git integration, and relevant runtime settings when deployment validation is authorized.
5. Perform consented microphone and speaker tests on supported desktop and phone browsers; this phase deliberately did not activate a physical microphone.
6. Perform real phone/tablet testing after responsive repairs. The available viewport override did not yield a phone-sized surface.

## Official references consulted

- [Google Gemini API key security](https://ai.google.dev/gemini-api/docs/generate-content/api-key): keys must not be committed or exposed in production clients; use a backend proxy and environment variables.
- [GenerateContent API](https://ai.google.dev/api/generate-content): `contents` is repeated for multi-turn chat and defines the supported request/response shape.
- [Google Search grounding](https://ai.google.dev/gemini-api/docs/generate-content/google-search): use `groundingChunks` and `groundingSupports` to attribute claims.
- [Gemini 2.5 Flash TTS model](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-preview-tts): documented model code is `gemini-2.5-flash-preview-tts`.
- [Gemini TTS guide](https://ai.google.dev/gemini-api/docs/speech-generation): audio modality/speech configuration; Hindi (`hi`) and Marathi (`mr`) are supported.
- [Vercel environment variables](https://vercel.com/docs/environment-variables): runtime values are scoped by environment and apply to new deployments.
- [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build): a static root project can use “Other” with no build command.

## Not performed

- No application repair, commit, push, pull request, Vercel change, or deployment.
- No production exploit payload, load test, bulk API call, microphone activation, account-setting change, or destructive production-history operation.
- No claim that generated answers, citations, translations, or audio quality are valid while authentication is blocked.
