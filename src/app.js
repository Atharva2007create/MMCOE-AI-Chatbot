'use strict';

const STORAGE = { history: 'mmcoeVectorChatHistory', theme: 'theme' };
const HISTORY_LIMIT = 50;
const MAX_CONTEXT_MESSAGES = 12;
const LANGUAGE = {
  en: { code: 'en-IN', label: 'English' },
  hi: { code: 'hi-IN', label: 'Hindi' },
  mr: { code: 'mr-IN', label: 'Marathi' }
};

const state = {
  chatBox: null,
  input: null,
  sendButton: null,
  micButton: null,
  themeButton: null,
  history: readHistory(),
  historyVisible: false,
  conversation: [],
  requests: { chat: null, translation: null, audio: null },
  translations: new Map(),
  activeAudio: null,
  activeAudioUrl: null,
  recognition: null,
  recognitionState: 'idle',
  userWantsListening: false
};

function safeJsonParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function readHistory() {
  let stored = null;
  try { stored = localStorage.getItem(STORAGE.history); } catch { stored = null; }
  const parsed = safeJsonParse(stored, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(item => item && typeof item.question === 'string' && typeof item.answer === 'string')
    .slice(0, HISTORY_LIMIT)
    .map(item => ({ question: item.question.slice(0, 4_000), answer: item.answer.slice(0, 16_000), timestamp: item.timestamp || new Date().toISOString() }));
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE.history, JSON.stringify(state.history));
    return true;
  } catch {
    showStatus('History could not be saved in this browser.', 'warning');
    return false;
  }
}

function addHistory(question, answer) {
  state.history.unshift({ question, answer, timestamp: new Date().toISOString() });
  state.history = state.history.slice(0, HISTORY_LIMIT);
  saveHistory();
}

function makeIcon(name, className = 'w-4 h-4') {
  const icon = document.createElement('i');
  icon.dataset.lucide = name;
  icon.className = className;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

function refreshIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

function showStatus(message, kind = 'info') {
  let region = document.getElementById('app-status');
  if (!region) {
    region = document.createElement('div');
    region.id = 'app-status';
    region.className = 'sr-only';
    region.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    region.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
    document.body.appendChild(region);
  }
  region.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  region.textContent = message;
}

function publicErrorMessage(error, fallback) {
  if (error?.name === 'AbortError') return 'Request cancelled.';
  return error?.publicMessage || fallback;
}

async function apiRequest(path, payload, { signal, timeoutMs = 35_000, retries = 1 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, timeoutMs);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      let data = {};
      try { data = await response.json(); } catch { data = {}; }
      if (response.ok) return data;
      if ((response.status === 429 || response.status >= 500) && attempt < retries && !signal?.aborted) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const delay = Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 4_000) : 500 * (2 ** attempt);
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
        });
        continue;
      }
      const error = new Error(data?.error?.message || 'Request failed.');
      error.publicMessage = data?.error?.message || 'The service could not complete the request.';
      error.code = data?.error?.code;
      error.status = response.status;
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
  throw new Error('Request failed.');
}

function replaceRequest(kind) {
  state.requests[kind]?.abort();
  const controller = new AbortController();
  state.requests[kind] = controller;
  return controller;
}

function setSafeMarkdown(container, markdown) {
  const text = String(markdown || '');
  try {
    if (!window.marked?.parse || !window.DOMPurify?.sanitize) throw new Error('Renderer unavailable');
    const html = window.marked.parse(text, { breaks: true, gfm: true });
    container.innerHTML = window.DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['style']
    });
    container.querySelectorAll('a').forEach(anchor => {
      try {
        const url = new URL(anchor.getAttribute('href'), location.origin);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported link');
        anchor.href = url.href;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      } catch {
        anchor.replaceWith(document.createTextNode(anchor.textContent || 'link'));
      }
    });
  } catch {
    container.textContent = text;
  }
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

function utilityButton(label, iconName, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tts-button text-xs text-white/80 hover:text-white transition duration-150 flex items-center gap-1 rounded px-1 py-1';
  button.append(makeIcon(iconName), document.createTextNode(label));
  button.addEventListener('click', onClick);
  return button;
}

function displayMessage(content, sender, sources = [], messageId = `msg-${Date.now()}`, rawText = null) {
  const wrapper = document.createElement('div');
  wrapper.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;
  const bubble = document.createElement('div');
  bubble.className = `${sender === 'user' ? 'user-message' : 'bot-message'} p-4 max-w-sm md:max-w-md fluid-reveal`;
  bubble.dataset.messageId = messageId;
  if (sender === 'user') bubble.textContent = String(content);
  else setSafeMarkdown(bubble, content);

  if (sender === 'bot' && Array.isArray(sources) && sources.length) {
    const sourceArea = document.createElement('div');
    sourceArea.className = 'mt-3 pt-2 border-t border-white/30 text-xs flex flex-wrap gap-2';
    const heading = document.createElement('p');
    heading.className = 'font-bold w-full mb-1 text-xs opacity-90';
    heading.textContent = 'Sources';
    sourceArea.appendChild(heading);
    sources.forEach(source => {
      const href = safeHttpsUrl(source?.uri);
      if (!href) return;
      const link = document.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'source-tag';
      link.append(makeIcon('link', 'w-3 h-3 mr-1'), document.createTextNode(String(source.title || new URL(href).hostname).slice(0, 200)));
      sourceArea.appendChild(link);
    });
    if (sourceArea.children.length > 1) bubble.appendChild(sourceArea);
  }

  if (sender === 'bot' && rawText) {
    const utility = document.createElement('div');
    utility.className = 'mt-3 pt-2 border-t border-white/30 space-y-2';
    const audioRow = document.createElement('div');
    audioRow.className = 'flex flex-wrap gap-2 justify-start text-xs font-medium';
    for (const lang of ['en', 'hi', 'mr']) {
      audioRow.appendChild(utilityButton(`Play (${lang.toUpperCase()})`, 'volume-2', event => handleTts(lang, event.currentTarget, messageId, rawText)));
    }
    const translationRow = document.createElement('div');
    translationRow.className = 'flex flex-wrap justify-end gap-2 text-xs font-medium';
    for (const lang of ['mr', 'hi']) {
      translationRow.appendChild(utilityButton(`Translate to ${LANGUAGE[lang].label}`, 'languages', event => translateMessage(lang, event.currentTarget, messageId, rawText)));
    }
    const translation = document.createElement('div');
    translation.id = `translation-container-${messageId}`;
    translation.dataset.originalText = rawText;
    utility.append(audioRow, translationRow, translation);
    bubble.appendChild(utility);
  }

  wrapper.appendChild(bubble);
  state.chatBox.appendChild(wrapper);
  requestAnimationFrame(() => bubble.classList.add('is-in'));
  refreshIcons();
  if (sender === 'user' || isNearBottom()) state.chatBox.scrollTop = state.chatBox.scrollHeight;
  return bubble;
}

function isNearBottom() {
  return state.chatBox.scrollHeight - state.chatBox.scrollTop - state.chatBox.clientHeight < 140;
}

function setLoading(show, message = 'MMCOE Vector is processing your request…') {
  state.sendButton.disabled = show;
  state.input.disabled = show;
  state.micButton.disabled = show;
  let loading = document.getElementById('loading-indicator');
  if (show && !loading) {
    loading = document.createElement('div');
    loading.id = 'loading-indicator';
    loading.className = 'flex justify-start';
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');
    const bubble = document.createElement('div');
    bubble.className = 'bot-message typing-indicator p-4 max-w-sm md:max-w-md';
    bubble.textContent = message;
    loading.appendChild(bubble);
    state.chatBox.appendChild(loading);
    state.chatBox.scrollTop = state.chatBox.scrollHeight;
    showStatus(message);
  } else if (!show && loading) {
    loading.remove();
  }
}

async function sendMessage(textOverride) {
  const query = String(textOverride ?? state.input.value).trim();
  if (!query || query.length > 4_000) {
    if (query.length > 4_000) showStatus('Please shorten the question to 4,000 characters.', 'error');
    return;
  }
  const controller = replaceRequest('chat');
  displayMessage(query, 'user');
  state.input.value = '';
  setLoading(true);
  try {
    const moderation = await apiRequest('/api/moderate', { text: query }, { signal: controller.signal, timeoutMs: 20_000, retries: 0 });
    if (!moderation.allowed) {
      displayMessage(moderation.message || 'Please use respectful academic language.', 'bot', [], `mod-${Date.now()}`, moderation.message);
      return;
    }
    const allMessages = [...state.conversation, { role: 'user', text: query }];
    let contextStart = Math.max(0, allMessages.length - MAX_CONTEXT_MESSAGES);
    while (contextStart > 0 && allMessages[contextStart].role !== 'user') contextStart += 1;
    const messages = allMessages.slice(contextStart);
    const answer = await apiRequest('/api/chat', { messages }, { signal: controller.signal, timeoutMs: 40_000, retries: 1 });
    if (state.requests.chat !== controller) return;
    displayMessage(answer.text, 'bot', answer.sources, `msg-${Date.now()}`, answer.text);
    state.conversation = [...messages, { role: 'model', text: answer.text }].slice(-MAX_CONTEXT_MESSAGES);
    addHistory(query, answer.text);
  } catch (error) {
    if (error?.name !== 'AbortError') {
      const message = publicErrorMessage(error, 'MMCOE Vector could not answer right now. Please try again.');
      displayMessage(message, 'bot', [], `err-${Date.now()}`, message);
      showStatus(message, 'error');
    }
  } finally {
    if (state.requests.chat === controller) {
      state.requests.chat = null;
      setLoading(false);
      state.input.focus();
    }
  }
}

async function translatedText(language, messageId, originalText, signal) {
  const key = `${messageId}:${language}`;
  if (state.translations.has(key)) return state.translations.get(key);
  const response = await apiRequest('/api/translate', { text: originalText, language }, { signal, retries: 1 });
  state.translations.set(key, response.text);
  return response.text;
}

async function translateMessage(language, button, messageId, originalText) {
  const container = document.getElementById(`translation-container-${messageId}`);
  if (!container) return;
  if (container.dataset.language === language && container.childElementCount) {
    container.replaceChildren();
    delete container.dataset.language;
    button.textContent = `Translate to ${LANGUAGE[language].label}`;
    return;
  }
  const controller = replaceRequest('translation');
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Translating…';
  try {
    const text = await translatedText(language, messageId, originalText, controller.signal);
    if (state.requests.translation !== controller) return;
    const card = document.createElement('div');
    card.className = 'mt-3 p-3 bg-white/10 rounded-lg translation-content';
    const title = document.createElement('p');
    title.className = 'font-bold text-sm mb-1';
    title.textContent = `${LANGUAGE[language].label} translation`;
    const content = document.createElement('div');
    content.className = 'text-sm';
    setSafeMarkdown(content, text);
    card.append(title, content);
    container.replaceChildren(card);
    container.dataset.language = language;
    button.textContent = 'Hide translation';
    showStatus(`${LANGUAGE[language].label} translation ready.`);
  } catch (error) {
    if (error?.name !== 'AbortError') showStatus(publicErrorMessage(error, 'Translation failed. Please try again.'), 'error');
    button.textContent = originalLabel;
  } finally {
    if (state.requests.translation === controller) state.requests.translation = null;
    button.disabled = false;
  }
}

function base64Bytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pcmWav(bytes, sampleRate = 24_000) {
  const buffer = new ArrayBuffer(44 + bytes.byteLength);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + bytes.byteLength, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, bytes.byteLength, true); new Uint8Array(buffer, 44).set(bytes);
  return new Blob([buffer], { type: 'audio/wav' });
}

function stopAudio() {
  state.requests.audio?.abort();
  state.requests.audio = null;
  if (state.activeAudio) {
    state.activeAudio.pause();
    state.activeAudio.src = '';
    state.activeAudio = null;
  }
  if (state.activeAudioUrl) {
    URL.revokeObjectURL(state.activeAudioUrl);
    state.activeAudioUrl = null;
  }
}

async function handleTts(language, button, messageId, originalText) {
  stopAudio();
  const controller = replaceRequest('audio');
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Generating…';
  try {
    let text = originalText;
    if (language !== 'en') text = await translatedText(language, messageId, originalText, controller.signal);
    const response = await apiRequest('/api/tts', { text, language, voice: 'Aoede' }, { signal: controller.signal, timeoutMs: 50_000, retries: 0 });
    if (state.requests.audio !== controller) return;
    const bytes = base64Bytes(response.data);
    const mimeType = String(response.mimeType || '');
    const rate = Number(mimeType.match(/rate=(\d+)/i)?.[1] || 24_000);
    const blob = /L16|pcm/i.test(mimeType) ? pcmWav(bytes, rate) : new Blob([bytes], { type: mimeType || 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    state.activeAudio = audio;
    state.activeAudioUrl = url;
    button.textContent = 'Playing…';
    const cleanup = () => {
      if (state.activeAudio === audio) stopAudio();
      button.disabled = false;
      button.textContent = originalLabel;
    };
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
    await audio.play();
    showStatus(`${LANGUAGE[language].label} audio playing.`);
  } catch (error) {
    if (error?.name !== 'AbortError') showStatus(publicErrorMessage(error, 'Audio could not be played.'), 'error');
    button.disabled = false;
    button.textContent = originalLabel;
    if (state.requests.audio === controller) state.requests.audio = null;
  }
}

function createHistoryItem(chat, index) {
  const item = document.createElement('div');
  item.className = 'history-item p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition duration-150';
  item.tabIndex = 0;
  item.setAttribute('role', 'button');
  item.setAttribute('aria-label', `Open history item: ${chat.question.slice(0, 80)}`);
  const question = document.createElement('p'); question.className = 'font-semibold text-sm truncate'; question.textContent = chat.question;
  const answer = document.createElement('p'); answer.className = 'text-xs text-gray-500 mt-1 truncate'; answer.textContent = `${chat.answer.slice(0, 50)}${chat.answer.length > 50 ? '…' : ''}`;
  const date = document.createElement('p'); date.className = 'text-xs text-gray-400 mt-1'; date.textContent = new Date(chat.timestamp).toLocaleString();
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'text-red-600 p-2 float-right'; remove.setAttribute('aria-label', `Delete history item: ${chat.question.slice(0, 80)}`); remove.appendChild(makeIcon('trash-2'));
  remove.addEventListener('click', event => { event.stopPropagation(); state.history.splice(index, 1); saveHistory(); renderHistoryList(); });
  item.append(remove, question, answer, date);
  item.addEventListener('click', () => renderHistoryDetail(index));
  item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); renderHistoryDetail(index); } });
  return item;
}

function renderHistoryList() {
  const content = document.getElementById('history-content');
  if (!content) return;
  content.replaceChildren();
  const list = document.createElement('div');
  list.id = 'history-list';
  list.className = 'max-h-64 overflow-y-auto';
  if (!state.history.length) {
    const empty = document.createElement('p'); empty.className = 'text-gray-500 text-center py-4'; empty.textContent = 'No chat history yet.'; list.appendChild(empty);
  } else state.history.forEach((chat, index) => list.appendChild(createHistoryItem(chat, index)));
  content.appendChild(list);
  refreshIcons();
}

function renderHistoryDetail(index) {
  const chat = state.history[index];
  const content = document.getElementById('history-content');
  if (!chat || !content) return;
  content.replaceChildren();
  const back = document.createElement('button'); back.type = 'button'; back.className = 'flex items-center gap-1 text-sm mb-3'; back.setAttribute('aria-label', 'Back to chat history'); back.append(makeIcon('arrow-left'), document.createTextNode('Back'));
  back.addEventListener('click', renderHistoryList);
  const question = document.createElement('div'); question.className = 'user-message p-3 rounded-lg mb-3'; question.textContent = `You: ${chat.question}`;
  const answer = document.createElement('div'); answer.className = 'bot-message p-3 rounded-lg';
  const label = document.createElement('strong'); label.textContent = 'MMCOE Vector: ';
  const answerBody = document.createElement('div'); setSafeMarkdown(answerBody, chat.answer); answer.append(label, answerBody);
  const date = document.createElement('p'); date.className = 'mt-3 text-xs text-gray-500'; date.textContent = new Date(chat.timestamp).toLocaleString();
  content.append(back, question, answer, date);
  refreshIcons();
  back.focus();
}

function toggleHistory() {
  const panel = document.getElementById('history-panel');
  state.historyVisible = !state.historyVisible;
  panel.classList.toggle('hidden', !state.historyVisible);
  state.historyVisible ? renderHistoryList() : state.historyButton?.focus();
  state.historyButton?.setAttribute('aria-expanded', String(state.historyVisible));
}

function clearHistory() {
  if (!window.confirm('Clear all locally stored chat history? This cannot be undone.')) return;
  state.history = [];
  saveHistory();
  renderHistoryList();
  showStatus('Chat history cleared.');
}

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.body.classList.toggle('dark-mode', dark);
  state.themeButton?.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  const icon = state.themeButton?.querySelector('[data-lucide]');
  if (icon) icon.dataset.lucide = dark ? 'sun' : 'moon';
  refreshIcons();
}

function toggleTheme() {
  const theme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
  try { localStorage.setItem(STORAGE.theme, theme); } catch { /* Theme still applies for this page. */ }
  applyTheme(theme);
}

function updateRecognitionUi(message) {
  const listening = state.recognitionState === 'listening';
  state.micButton.classList.toggle('mic-listening', listening);
  state.micButton.setAttribute('aria-pressed', String(listening));
  state.micButton.setAttribute('aria-label', listening ? 'Stop voice input' : 'Start voice input');
  state.input.placeholder = listening ? 'Listening… speak now' : 'Ask about MMCOE… or use voice input';
  if (message) showStatus(message);
  refreshIcons();
}

function initializeRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    state.recognitionState = 'unsupported';
    state.micButton.hidden = true;
    return;
  }
  const recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-IN';
  recognition.maxAlternatives = 1;
  recognition.onstart = () => { state.recognitionState = 'listening'; updateRecognitionUi('Voice input started.'); };
  recognition.onresult = event => {
    let finalText = '';
    let interimText = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const text = event.results[index][0]?.transcript || '';
      if (event.results[index].isFinal) finalText += text; else interimText += text;
    }
    if (finalText.trim()) state.input.value = finalText.trim();
    if (interimText.trim()) showStatus(`Listening: ${interimText.trim()}`);
  };
  recognition.onerror = event => {
    state.userWantsListening = false;
    state.recognitionState = 'idle';
    const messages = {
      'not-allowed': 'Microphone permission was denied.',
      'audio-capture': 'No microphone audio could be captured.',
      'no-speech': 'No speech was detected.',
      network: 'Voice recognition could not reach its service.'
    };
    updateRecognitionUi(messages[event.error] || 'Voice input stopped because of an error.');
  };
  recognition.onend = () => {
    state.userWantsListening = false;
    state.recognitionState = 'idle';
    updateRecognitionUi('Voice input stopped. Review the transcript before sending.');
  };
  state.recognition = recognition;
}

function toggleRecognition() {
  if (!state.recognition || state.recognitionState === 'unsupported') return;
  if (state.recognitionState === 'listening' || state.recognitionState === 'starting') {
    state.userWantsListening = false;
    state.recognitionState = 'stopping';
    try { state.recognition.stop(); } catch { state.recognitionState = 'idle'; }
    updateRecognitionUi('Stopping voice input.');
    return;
  }
  state.userWantsListening = true;
  state.recognitionState = 'starting';
  updateRecognitionUi('Requesting voice input.');
  try { state.recognition.start(); }
  catch {
    state.userWantsListening = false;
    state.recognitionState = 'idle';
    updateRecognitionUi('Voice input could not start.');
  }
}

function prepareHistoryPanel() {
  const panel = document.getElementById('history-panel');
  const historyButton = document.getElementById('history-toggle-button');
  const aside = document.querySelector('aside');
  const dateCard = document.getElementById('date-day-tracker');
  const duplicateHeading = historyButton?.closest('h1');
  const primaryHeading = aside?.querySelector('h1');
  if (historyButton && primaryHeading) {
    primaryHeading.classList.add('flex', 'justify-between', 'items-center');
    primaryHeading.appendChild(historyButton);
    duplicateHeading?.remove();
  }
  if (panel && aside) aside.insertBefore(panel, dateCard || null);
  state.historyButton = historyButton;
  historyButton?.setAttribute('aria-expanded', 'false');
  historyButton?.setAttribute('aria-controls', 'history-panel');
}

function addPrivacyNotice() {
  const aside = document.querySelector('aside');
  if (!aside || document.getElementById('privacy-summary')) return;
  const details = document.createElement('details');
  details.id = 'privacy-summary';
  details.className = 'mt-3 text-xs text-gray-600';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer font-semibold';
  summary.textContent = 'Privacy and data use';
  const text = document.createElement('p');
  text.className = 'mt-2 leading-relaxed';
  text.textContent = 'Questions and recent turns are sent to Google Gemini for safety checks and answers. Translation and audio send answer text to Gemini. Voice recognition may use your browser provider. Up to 50 chats and your theme stay only in this browser until you clear them.';
  details.append(summary, text);
  aside.appendChild(details);
}

function startIntro() {
  const canvas = document.getElementById('intro-canvas');
  const main = document.getElementById('main-content');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveal = () => {
    canvas.hidden = true;
    main.classList.remove('hidden');
    main.style.opacity = '1';
    state.input.focus();
  };
  if (reduceMotion || !canvas.getContext) { reveal(); return; }
  const context = canvas.getContext('2d');
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const start = performance.now();
  const draw = now => {
    const elapsed = now - start;
    context.fillStyle = 'rgba(0,0,0,.22)'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#FF7043'; context.font = '700 48px Inter, system-ui, sans-serif'; context.textAlign = 'center';
    context.fillText('MMCOE Vector', canvas.width / 2, canvas.height / 2);
    if (elapsed < 1_200) requestAnimationFrame(draw);
    else { canvas.style.transition = 'opacity .25s ease'; canvas.style.opacity = '0'; setTimeout(reveal, 260); }
  };
  requestAnimationFrame(draw);
}

function boot() {
  state.chatBox = document.getElementById('chat-box');
  state.input = document.getElementById('user-input');
  state.sendButton = document.getElementById('send-button');
  state.micButton = document.getElementById('mic-button');
  state.themeButton = document.getElementById('theme-toggle-button');
  prepareHistoryPanel();
  addPrivacyNotice();

  state.input.maxLength = 4_000;
  state.input.setAttribute('aria-label', 'Ask MMCOE Vector a question');
  state.chatBox.setAttribute('role', 'log');
  state.chatBox.setAttribute('aria-live', 'polite');
  state.chatBox.setAttribute('aria-relevant', 'additions');
  state.sendButton.setAttribute('aria-label', 'Send question');
  state.themeButton.setAttribute('type', 'button');
  state.micButton.setAttribute('type', 'button');
  state.sendButton.setAttribute('type', 'button');

  document.getElementById('history-toggle-button')?.addEventListener('click', toggleHistory);
  document.querySelector('#history-panel button')?.addEventListener('click', clearHistory);
  state.themeButton.addEventListener('click', toggleTheme);
  state.micButton.addEventListener('click', toggleRecognition);
  state.sendButton.addEventListener('click', () => sendMessage());
  state.input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
  });

  const quickQueries = [
    'How do I apply for admission?',
    'What is the fee structure for B.Tech?',
    'What are the core subjects in Mechanical Engineering?'
  ];
  document.querySelectorAll('.quick-reply-button').forEach((button, index) => {
    button.type = 'button';
    button.addEventListener('click', () => sendMessage(quickQueries[index]));
  });

  const initialText = "Hello! 👋 Welcome to your Educational Assistant Bot. I'm ready to help you with your queries. How can I assist you today?";
  document.querySelectorAll('[data-message-id="msg-initial"]').forEach(button => {
    const label = button.textContent.match(/\((EN|HI|MR)\)/)?.[1]?.toLowerCase();
    if (label) button.addEventListener('click', event => handleTts(label, event.currentTarget, 'msg-initial', initialText));
  });
  document.querySelectorAll('#translate-buttons-msg-initial [data-lang]').forEach(button => {
    button.addEventListener('click', event => translateMessage(button.dataset.lang, event.currentTarget, 'msg-initial', initialText));
  });
  const initialContainer = document.getElementById('translation-container-msg-initial');
  if (initialContainer) initialContainer.dataset.originalText = initialText;

  let savedTheme = null;
  try { savedTheme = localStorage.getItem(STORAGE.theme); } catch { savedTheme = null; }
  const preferred = savedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(preferred);
  const now = new Date();
  document.getElementById('current-day').textContent = now.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase();
  document.getElementById('current-date').textContent = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  initializeRecognition();
  refreshIcons();
  startIntro();
}

window.addEventListener('beforeunload', () => {
  Object.values(state.requests).forEach(controller => controller?.abort());
  stopAudio();
  state.userWantsListening = false;
  try { state.recognition?.stop(); } catch { /* Already stopped. */ }
});

document.addEventListener('DOMContentLoaded', boot);
