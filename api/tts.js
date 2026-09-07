'use strict';

const { generateContent } = require('./_lib/gemini');
const { parseBody, publicError, rateLimit, requirePost, requireSameOrigin, sendJson } = require('./_lib/http');
const { ttsModel } = require('./_lib/models');

const LANGUAGES = Object.freeze({ en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' });
const VOICES = new Set(['Aoede', 'Kore', 'Puck', 'Charon']);

module.exports = async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res, { limit: 15 })) return;
  try {
    const body = parseBody(req);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const languageCode = Object.prototype.hasOwnProperty.call(LANGUAGES, body.language) ? LANGUAGES[body.language] : null;
    const voiceName = VOICES.has(body.voice) ? body.voice : 'Aoede';
    if (!text || text.length > 5_000 || !languageCode) {
      throw Object.assign(new Error('Provide valid text and a supported audio language.'), { status: 400, publicCode: 'INVALID_TTS_REQUEST' });
    }
    const model = ttsModel();
    const result = await generateContent(model, {
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } }, languageCode }
      }
    }, { timeoutMs: 45_000, retries: 1 });
    const parts = result?.candidates?.[0]?.content?.parts;
    const inlineData = Array.isArray(parts) ? parts.find(part => part?.inlineData?.data)?.inlineData : null;
    if (!inlineData?.data || !String(inlineData.mimeType || '').startsWith('audio/')) {
      throw Object.assign(new Error('The AI service returned no audio.'), { status: 502, publicCode: 'AI_EMPTY_AUDIO', publicMessage: 'Audio could not be generated.' });
    }
    if (inlineData.data.length > 12_000_000) {
      throw Object.assign(new Error('Audio response exceeded the size limit.'), { status: 502, publicCode: 'AI_AUDIO_TOO_LARGE', publicMessage: 'The generated audio was too large.' });
    }
    sendJson(res, 200, { data: inlineData.data, mimeType: inlineData.mimeType });
  } catch (error) {
    publicError(res, error);
  }
};

module.exports.LANGUAGES = LANGUAGES;
