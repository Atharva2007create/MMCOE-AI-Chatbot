import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../index.html', import.meta.url);
let html = await readFile(path, 'utf8');

html = html.replace(
  /<head><script>window\.__V0_SANDBOX_ID__[\s\S]*?<\/script><script async src="\/v0-runtime-dist\.js"><\/script><style>nextjs-portal\{display: none !important\}<\/style>/,
  '<head>'
);
html = html.replace(
  /<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*<link href="https:\/\/fonts\.googleapis\.com[^>]+>\s*<script src="https:\/\/unpkg\.com\/lucide@latest"><\/script>/,
  '<link rel="stylesheet" href="/assets/tailwind.css">\n<script src="/assets/marked.min.js" defer></script>\n<script src="/assets/purify.min.js" defer></script>\n<script src="/assets/lucide.min.js" defer></script>'
);
html = html.replace(/\s+onclick="[^"]*"/g, '');
html = html.replace(/\s+onkeydown="[^"]*"/g, '');
html = html.replace('<div id="chat-box" class="chat-container flex-grow space-y-4">', '<div id="chat-box" class="chat-container flex-grow space-y-4" role="log" aria-live="polite" aria-relevant="additions">');
html = html.replace('<button id="theme-toggle-button"', '<button type="button" id="theme-toggle-button" aria-label="Switch theme"');
html = html.replace('<button id="mic-button"', '<button type="button" id="mic-button" aria-label="Start voice input" aria-pressed="false"');
html = html.replace('<button id="send-button"', '<button type="button" id="send-button" aria-label="Send question"');
html = html.replace('<button id="history-toggle-button"', '<button type="button" id="history-toggle-button" aria-expanded="false" aria-controls="history-panel"');
html = html.replace('<button class="quick-reply-button', '<button type="button" class="quick-reply-button');
html = html.replaceAll('<button class="quick-reply-button', '<button type="button" class="quick-reply-button');
if (!html.includes('id="user-input" maxlength="4000" aria-label="Ask MMCOE Vector a question"')) {
  html = html.replace('<input type="text" id="user-input"', '<input type="text" id="user-input" maxlength="4000" aria-label="Ask MMCOE Vector a question"');
}

const responsiveCss = `

/* Reliability and responsive additions */
button:focus-visible, input:focus-visible, summary:focus-visible, [role="button"]:focus-visible {
  outline: 3px solid #f59e0b;
  outline-offset: 3px;
}
#privacy-summary { color: var(--text-color); }
#history-panel { color: var(--text-color); }
@media (max-width: 767px) {
  body { overflow-x: hidden; }
  #main-content { min-height: 100dvh; height: auto; }
  #app-container { flex-direction: column; width: 100%; min-height: 100dvh; height: auto; padding: 0.75rem; gap: 0.75rem; }
  #app-container > aside { width: 100%; min-width: 0; height: auto; padding: 1rem; }
  #app-container > section { width: 100%; min-height: 70dvh; height: auto; overflow: visible; }
  .chat-container { height: 55dvh; min-height: 22rem; padding: 1rem; }
  #app-footer { position: sticky; bottom: 0; padding: 0.75rem; gap: 0.35rem; }
  #app-footer .app-input { min-width: 0; padding: 0.75rem; }
  #send-button { padding: 0.75rem 1rem; }
  .bot-message, .user-message { max-width: 92%; overflow-wrap: anywhere; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
`;
if (!html.includes('/* Reliability and responsive additions */')) {
  html = html.replace(/<\/style>\s*<\/head>/, `${responsiveCss}</style>\n</head>`);
}
html = html.replace(
  /\s*<script>\s*\/\/ --- API Configuration and State ---[\s\S]*?<\/script>\s*<\/body>/,
  '\n<script src="/src/app.js" defer></script>\n</body>'
);

await writeFile(path, html, 'utf8');
