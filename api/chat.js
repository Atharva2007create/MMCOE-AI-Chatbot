'use strict';

const { generateContent, grounding, responseText } = require('./_lib/gemini');
const { parseBody, publicError, rateLimit, requirePost, requireSameOrigin, sendJson } = require('./_lib/http');
const { SYSTEM_PROMPT } = require('./_lib/prompts');

function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 14) {
    throw Object.assign(new Error('Provide between 1 and 14 conversation messages.'), { status: 400, publicCode: 'INVALID_MESSAGES' });
  }
  let total = 0;
  const messages = value.map((message, index) => {
    const role = message?.role;
    const text = typeof message?.text === 'string' ? message.text.trim() : '';
    if (!['user', 'model'].includes(role) || !text || text.length > 4_000) {
      throw Object.assign(new Error(`Invalid conversation message at index ${index}.`), { status: 400, publicCode: 'INVALID_MESSAGES' });
    }
    total += text.length;
    return { role, parts: [{ text }] };
  });
  const alternates = messages.every((message, index) => index === 0 || message.role !== messages[index - 1].role);
  if (total > 16_000 || messages[0].role !== 'user' || messages.at(-1).role !== 'user' || !alternates) {
    throw Object.assign(new Error('Conversation is too large or does not end with a user message.'), { status: 400, publicCode: 'INVALID_MESSAGES' });
  }
  return messages;
}

module.exports = async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res, { limit: 20 })) return;
  try {
    const body = parseBody(req);
    const contents = validateMessages(body.messages);
    const model = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';
    const result = await generateContent(model, {
      contents,
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: 1_500, temperature: 0.2 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
      ]
    });
    const text = responseText(result);
    const { sources, supports } = grounding(result);
    sendJson(res, 200, { text, sources, supports });
  } catch (error) {
    publicError(res, error);
  }
};

module.exports.validateMessages = validateMessages;
