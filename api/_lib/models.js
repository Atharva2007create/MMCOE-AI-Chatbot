'use strict';

const DEFAULT_GROUNDED_MODEL = 'gemini-2.5-flash';
const DEFAULT_UTILITY_MODEL = 'gemini-3.5-flash';
const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const MODEL_NAME = /^[a-z0-9][a-z0-9._-]{0,99}$/i;

function configuredModel(value, fallback) {
  const model = typeof value === 'string' ? value.trim() : '';
  return MODEL_NAME.test(model) ? model : fallback;
}

function groundedModel() {
  return configuredModel(process.env.GEMINI_GROUNDED_MODEL, DEFAULT_GROUNDED_MODEL);
}

function utilityModel() {
  return configuredModel(
    process.env.GEMINI_UTILITY_MODEL || process.env.GEMINI_CHAT_MODEL,
    DEFAULT_UTILITY_MODEL
  );
}

function ttsModel() {
  return configuredModel(process.env.GEMINI_TTS_MODEL, DEFAULT_TTS_MODEL);
}

function textGenerationConfig(model, maxOutputTokens, thinkingLevel = 'LOW') {
  const config = { maxOutputTokens };
  if (/^gemini-3(?:[.-]|$)/i.test(model)) {
    config.thinkingConfig = { thinkingLevel };
  } else if (/^gemini-2\.5(?:[.-]|$)/i.test(model)) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }
  return config;
}

module.exports = {
  DEFAULT_GROUNDED_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_UTILITY_MODEL,
  groundedModel,
  textGenerationConfig,
  ttsModel,
  utilityModel
};
