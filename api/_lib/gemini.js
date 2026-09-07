'use strict';

class GeminiError extends Error {
  constructor(status, publicCode, publicMessage) {
    super(publicMessage);
    this.status = status;
    this.publicCode = publicCode;
    this.publicMessage = publicMessage;
  }
}

function requireApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError(503, 'AI_NOT_CONFIGURED', 'The AI service is not configured yet.');
  return key;
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1000, 8_000);
  return Math.min(500 * (2 ** attempt) + Math.random() * 250, 4_000);
}

async function generateContent(model, payload, { timeoutMs = 30_000, retries = 2 } = {}) {
  const key = requireApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (response.ok) return await response.json();
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        throw new GeminiError(503, 'AI_AUTH_FAILED', 'The AI service is temporarily unavailable.');
      }
      if (response.status === 429) {
        throw new GeminiError(429, 'AI_RATE_LIMITED', 'The AI service is busy. Please wait and try again.');
      }
      throw new GeminiError(502, 'AI_UPSTREAM_ERROR', 'The AI service returned an error. Please try again.');
    } catch (error) {
      if (error instanceof GeminiError) throw error;
      if (error?.name === 'AbortError') throw new GeminiError(504, 'AI_TIMEOUT', 'The AI service took too long to respond.');
      if (attempt >= retries) throw new GeminiError(502, 'AI_NETWORK_ERROR', 'The AI service could not be reached.');
      await new Promise(resolve => setTimeout(resolve, retryDelay(null, attempt)));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new GeminiError(502, 'AI_UPSTREAM_ERROR', 'The AI service returned an error.');
}

function responseText(result) {
  const parts = result?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map(part => typeof part.text === 'string' ? part.text : '').join('').trim() : '';
  if (!text) throw new GeminiError(502, 'AI_EMPTY_RESPONSE', 'The AI service returned no answer.');
  return text;
}

function grounding(result) {
  const metadata = result?.candidates?.[0]?.groundingMetadata || {};
  const chunks = Array.isArray(metadata.groundingChunks) ? metadata.groundingChunks : [];
  const sources = chunks.map((chunk, index) => {
    const uri = chunk?.web?.uri;
    if (typeof uri !== 'string') return null;
    try {
      const parsed = new URL(uri);
      if (parsed.protocol !== 'https:') return null;
      return { index, uri: parsed.href, title: String(chunk.web.title || parsed.hostname).slice(0, 200) };
    } catch { return null; }
  }).filter(Boolean);
  const supports = Array.isArray(metadata.groundingSupports) ? metadata.groundingSupports.map(support => ({
    startIndex: Number.isInteger(support?.segment?.startIndex) ? support.segment.startIndex : null,
    endIndex: Number.isInteger(support?.segment?.endIndex) ? support.segment.endIndex : null,
    sourceIndices: Array.isArray(support?.groundingChunkIndices) ? support.groundingChunkIndices.filter(Number.isInteger) : [],
  })) : [];
  return { sources, supports };
}

module.exports = { GeminiError, generateContent, grounding, responseText };
