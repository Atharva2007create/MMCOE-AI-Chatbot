import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { validateMessages } = require('../api/chat');
const { grounding, responseText, generateContent } = require('../api/_lib/gemini');
const { LANGUAGES } = require('../api/tts');

test('chat validation accepts a bounded conversation', () => {
  assert.deepEqual(validateMessages([
    { role: 'user', text: 'Tell me about MMCOE.' },
    { role: 'model', text: 'MMCOE is an engineering college in Pune.' },
    { role: 'user', text: 'Which admission exam applies?' }
  ]).map(item => item.role), ['user', 'model', 'user']);
});

test('chat validation rejects oversized and non-user-final conversations', () => {
  assert.throws(() => validateMessages([{ role: 'model', text: 'answer' }]), /does not end/);
  assert.throws(() => validateMessages([{ role: 'user', text: 'x'.repeat(4_001) }]), /Invalid conversation/);
});

test('response parsing joins all text parts', () => {
  assert.equal(responseText({ candidates: [{ content: { parts: [{ text: 'one' }, { text: ' two' }] } }] }), 'one two');
});

test('grounding parser keeps only safe HTTPS sources and support indexes', () => {
  const parsed = grounding({ candidates: [{ groundingMetadata: {
    groundingChunks: [
      { web: { uri: 'https://www.mmcoe.edu.in/', title: 'MMCOE' } },
      { web: { uri: 'javascript:alert(1)', title: '<img>' } }
    ],
    groundingSupports: [{ segment: { startIndex: 0, endIndex: 6 }, groundingChunkIndices: [0, 1] }]
  } }] });
  assert.equal(parsed.sources.length, 1);
  assert.equal(parsed.sources[0].title, 'MMCOE');
  assert.deepEqual(parsed.supports[0].sourceIndices, [0]);
});

test('Gemini request sends the credential in a header, never in the URL', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-only-key';
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ candidates: [] }) };
  };
  try {
    await generateContent('gemini-test', { contents: [] }, { retries: 0 });
    assert.equal(request.url.includes('test-only-key'), false);
    assert.equal(request.options.headers['x-goog-api-key'], 'test-only-key');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test('TTS supports exactly the intended interface languages', () => {
  assert.deepEqual(LANGUAGES, { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' });
});
