import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const port = Number(process.env.MOCK_PORT || 3001);

async function body(req) {
  let value = '';
  for await (const chunk of req) value += chunk;
  return JSON.parse(value || '{}');
}

function json(res, value) {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/moderate') return json(res, { allowed: true });
  if (url.pathname === '/api/chat') {
    const request = await body(req);
    const turns = Array.isArray(request.messages) ? request.messages.length : 0;
    return json(res, {
      text: `## Mocked educational answer\n\nConversation messages received: **${turns}**.`,
      sources: [{ uri: 'https://www.mmcoe.edu.in/', title: 'MMCOE official website' }],
      supports: []
    });
  }
  if (url.pathname === '/api/translate') {
    const request = await body(req);
    return json(res, { language: request.language, text: request.language === 'hi' ? 'यह एक सुरक्षित परीक्षण अनुवाद है।' : 'हे एक सुरक्षित चाचणी भाषांतर आहे.' });
  }
  if (url.pathname === '/api/tts') {
    return json(res, { data: Buffer.alloc(4_800).toString('base64'), mimeType: 'audio/L16;codec=pcm;rate=24000' });
  }
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!/^\/(index\.html|assets\/[A-Za-z0-9._/-]+|src\/[A-Za-z0-9._/-]+)$/.test(pathname)) {
    res.writeHead(404); res.end(); return;
  }
  const file = path.resolve(root, `.${pathname}`);
  let exists = false;
  try { exists = (await stat(file)).isFile(); } catch { exists = false; }
  if (!exists) { res.writeHead(404); res.end(); return; }
  const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => console.log(`MMCOE mock server: http://127.0.0.1:${port}`));
