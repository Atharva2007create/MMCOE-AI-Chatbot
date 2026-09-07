'use strict';

const { generateContent, responseText } = require('./_lib/gemini');
const { parseBody, publicError, rateLimit, requirePost, requireSameOrigin, sendJson } = require('./_lib/http');
const { MODERATION_PROMPT } = require('./_lib/prompts');

module.exports = async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res, { limit: 30 })) return;
  try {
    const body = parseBody(req);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 4_000) {
      throw Object.assign(new Error('Message must contain 1 to 4,000 characters.'), { status: 400, publicCode: 'INVALID_TEXT' });
    }
    const model = process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash';
    const result = await generateContent(model, {
      contents: [{ role: 'user', parts: [{ text }] }],
      systemInstruction: { parts: [{ text: MODERATION_PROMPT }] },
      generationConfig: {
        maxOutputTokens: 256,
        thinkingConfig: { thinkingLevel: 'MINIMAL' }
      }
    }, { timeoutMs: 15_000, retries: 1 });
    const verdict = responseText(result).toUpperCase();
    if (verdict !== 'CLEAN') {
      sendJson(res, 200, { allowed: false, message: 'Please use polite language and maintain a respectful academic tone. 🚫' });
      return;
    }
    sendJson(res, 200, { allowed: true });
  } catch (error) {
    if (error?.status >= 500) {
      console.error('Moderation request failed.', {
        code: error.publicCode || 'UNKNOWN',
        status: error.status
      });
      sendJson(res, 503, { error: { code: 'MODERATION_UNAVAILABLE', message: 'Message safety could not be verified. Please try again.' } });
      return;
    }
    publicError(res, error);
  }
};
