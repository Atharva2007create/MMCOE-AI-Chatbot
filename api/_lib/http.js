'use strict';

const buckets = new Map();
const MAX_BUCKETS = 10_000;

function pruneBuckets(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function requirePost(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for this endpoint.' } });
    return false;
  }
  return true;
}

function requireSameOrigin(req, res) {
  const origin = req.headers?.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    if (!host || new URL(origin).host !== host) {
      sendJson(res, 403, { error: { code: 'ORIGIN_REJECTED', message: 'Request origin was rejected.' } });
      return false;
    }
  } catch {
    sendJson(res, 403, { error: { code: 'ORIGIN_REJECTED', message: 'Request origin was rejected.' } });
    return false;
  }
  return true;
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(new Error('Request body must be a JSON object.'), { publicCode: 'INVALID_REQUEST', status: 400 });
  }
  return body;
}

function rateLimit(req, res, { limit = 30, windowMs = 60_000 } = {}) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const now = Date.now();
  let key = forwarded || req.socket?.remoteAddress || 'unknown';
  if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) {
    pruneBuckets(now);
    if (buckets.size >= MAX_BUCKETS) key = '__rate_limit_overflow__';
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  if (current.count <= limit) return true;
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
  sendJson(res, 429, { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait and try again.' } });
  return false;
}

function publicError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const code = error?.publicCode || 'INTERNAL_ERROR';
  const message = error?.publicMessage || (status < 500 ? error.message : 'The service could not complete this request.');
  sendJson(res, status, { error: { code, message } });
}

module.exports = { parseBody, publicError, rateLimit, requirePost, requireSameOrigin, sendJson };
