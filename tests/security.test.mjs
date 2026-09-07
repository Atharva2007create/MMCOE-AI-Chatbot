import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { parseBody, publicError, rateLimit, requirePost, requireSameOrigin } = require('../api/_lib/http');
const translate = require('../api/translate');
const tts = require('../api/tts');

function response() {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    setHeader(name, value) { headers[name.toLowerCase()] = String(value); },
    end(body) { this.body = body; }
  };
}

function request(body, origin = 'https://example.test') {
  return { method: 'POST', headers: { origin, host: 'example.test' }, body, socket: { remoteAddress: 'ruthless-test' } };
}

test('HTTP helpers reject malformed bodies and cross-origin requests', () => {
  assert.deepEqual(parseBody({ body: '{"ok":true}' }), { ok: true });
  assert.throws(() => parseBody({ body: '[]' }), /JSON object/);

  const methodResponse = response();
  assert.equal(requirePost({ method: 'GET' }, methodResponse), false);
  assert.equal(methodResponse.statusCode, 405);
  assert.equal(methodResponse.headers.allow, 'POST');

  const originResponse = response();
  assert.equal(requireSameOrigin({ headers: { origin: 'https://evil.test', host: 'example.test' } }, originResponse), false);
  assert.equal(originResponse.statusCode, 403);
});

test('language handlers reject prototype-property language values', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const translationResponse = response();
    await translate(request({ text: 'hello', language: 'toString' }), translationResponse);
    assert.equal(translationResponse.statusCode, 400);

    const ttsResponse = response();
    await tts(request({ text: 'hello', language: '__proto__' }), ttsResponse);
    assert.equal(ttsResponse.statusCode, 400);
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test('rate limiting returns a bounded rejection and errors redact internals', () => {
  const first = response();
  const req = { ...request({ ok: true }), socket: { remoteAddress: 'ruthless-rate-test' } };
  assert.equal(rateLimit(req, first, { limit: 2, windowMs: 60_000 }), true);
  assert.equal(rateLimit(req, first, { limit: 2, windowMs: 60_000 }), true);
  const limited = response();
  assert.equal(rateLimit(req, limited, { limit: 2, windowMs: 60_000 }), false);
  assert.equal(limited.statusCode, 429);

  const errorResponse = response();
  publicError(errorResponse, Object.assign(new Error('internal secret'), { status: 500 }));
  assert.equal(errorResponse.body.includes('internal secret'), false);
});
