'use strict';

const { generateContent, responseText } = require('./_lib/gemini');
const { parseBody, publicError, rateLimit, requirePost, requireSameOrigin, sendJson } = require('./_lib/http');
const { TRANSLATION_PROMPT } = require('./_lib/prompts');

const LANGUAGES = Object.freeze({ hi: 'Hindi', mr: 'Marathi' });

module.exports = async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res, { limit: 30 })) return;
  try {
    const body = parseBody(req);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const language = Object.prototype.hasOwnProperty.call(LANGUAGES, body.language) ? LANGUAGES[body.language] : null;
    if (!text || text.length > 12_000 || !language) {
      throw Object.assign(new Error('Provide valid text and a supported target language.'), { status: 400, publicCode: 'INVALID_TRANSLATION_REQUEST' });
    }
    const model = process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash';
    const result = await generateContent(model, {
      contents: [{ role: 'user', parts: [{ text: `Target language: ${language}\n\n${text}` }] }],
      systemInstruction: { parts: [{ text: TRANSLATION_PROMPT }] },
      generationConfig: {
        maxOutputTokens: 8_192,
        thinkingConfig: { thinkingLevel: 'MINIMAL' }
      }
    });
    sendJson(res, 200, { text: responseText(result), language: body.language });
  } catch (error) {
    publicError(res, error);
  }
};
