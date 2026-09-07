import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const root = process.cwd();
const port = Number(process.env.PORT || 3000);
const handlers = {
  '/api/chat': require('../api/chat'),
  '/api/moderate': require('../api/moderate'),
  '/api/translate': require('../api/translate'),
  '/api/tts': require('../api/tts')
};

async function loadLocalEnvironment() {
  try {
    const file = await readFile(path.join(root, '.env.local'), 'utf8');
    for (const line of file.split(/\r?\n/)) {
      const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function mimeType(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' })[path.extname(file)] || 'application/octet-stream';
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 32_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  try { return JSON.parse(body || '{}'); }
  catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}

function safeStaticPath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0]);
  if (pathname === '/') return path.join(root, 'index.html');
  if (!/^\/(assets|src)\/[A-Za-z0-9._/-]+$/.test(pathname)) return null;
  const candidate = path.resolve(root, `.${pathname}`);
  return candidate.startsWith(root + path.sep) ? candidate : null;
}

await loadLocalEnvironment();

const server = createServer(async (req, res) => {
  try {
    const urlPath = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
    if (handlers[urlPath]) {
      req.body = await readJson(req);
      await handlers[urlPath](req, res);
      return;
    }
    const file = safeStaticPath(urlPath);
    let exists = false;
    if (file) {
      try { exists = (await stat(file)).isFile(); } catch { exists = false; }
    }
    if (!exists) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mimeType(file),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    createReadStream(file).pipe(res);
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(error.status || 500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: { code: error.status === 413 ? 'REQUEST_TOO_LARGE' : 'INVALID_REQUEST', message: error.status < 500 ? error.message : 'Local server error.' } }));
    } else res.end();
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`MMCOE Vector local server: http://127.0.0.1:${port}`);
  if (!process.env.GEMINI_API_KEY) console.log('Gemini is not configured; API routes will return a safe configuration error.');
});
