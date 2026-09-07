import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
const server = await readFile(new URL('../api/_lib/gemini.js', import.meta.url), 'utf8');
const vercel = await readFile(new URL('../vercel.json', import.meta.url), 'utf8');

const checks = [
  ['no credential is present in browser files', !/const\s+API_KEY|[?&]key=|AQ\.[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}/.test(html + client)],
  ['browser does not call Gemini directly', !/generativelanguage\.googleapis\.com/.test(html + client)],
  ['browser uses same-origin API routes', /['"]\/api\/chat['"]/.test(client) && /['"]\/api\/translate['"]/.test(client) && /['"]\/api\/tts['"]/.test(client)],
  ['server authenticates with a header', /['"]x-goog-api-key['"]:\s*key/.test(server) && !/[?&]key=/.test(server)],
  ['conversation context is bounded', /MAX_CONTEXT_MESSAGES\s*=\s*12/.test(client)],
  ['current grounding parser is implemented', /groundingChunks/.test(server) && /groundingSupports/.test(server)],
  ['unsafe HTML fallback is absent', !/innerHTML\s*=\s*(?:content|text|markdown)/.test(client)],
  ['request cancellation is implemented', /AbortController/.test(client) && /replaceRequest/.test(client)],
  ['ARIA live log is implemented', /aria-live="polite"/.test(html) && /role="log"/.test(html)],
  ['responsive phone breakpoint exists', /@media \(max-width: 767px\)/.test(html)],
  ['runtime CDN dependencies are absent', !/cdn\.tailwindcss|fonts\.googleapis|unpkg\.com|cdnjs\.cloudflare/.test(html)],
  ['v0 development runtime is absent', !/__V0_|v0-runtime-dist/.test(html)],
  ['inline JavaScript handlers are absent', !/\son(?:click|keydown|keypress|keyup)=/.test(html)],
  ['CSP disallows third-party scripts', /script-src 'self'/.test(vercel) && !/script-src[^;]*unsafe-inline/.test(vercel)],
  ['Vercel serves the repository root', /"outputDirectory"\s*:\s*"\."/.test(vercel)],
  ['microphone preflight stream is absent', !/getUserMedia/.test(client) && !/auto-restart|automatic restart/i.test(client)],
];

for (const [name, condition] of checks) {
  assert.equal(condition, true, `Implementation check failed: ${name}`);
  console.log(`PASS: ${name}`);
}

console.log(`PASS: ${checks.length} implementation checks`);
