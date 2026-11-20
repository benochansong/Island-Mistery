// Development-only preview: loopback, explicit asset allowlist, no filesystem browsing.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const allowed = new Set(['index.html', 'css/styles.css', 'assets/island.svg', 'assets/compass.svg', ...['data', 'config', 'social', 'dialogue', 'discussion', 'perception', 'schema', 'story-data', 'story', 'missions', 'codex', 'ai', 'state', 'storage', 'ui', 'story-ui', 'app'].map(name => `js/${name}.js`)]);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  let requested;
  try { requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html'; }
  catch { res.writeHead(400); return res.end(); }
  if (!['GET', 'HEAD'].includes(req.method) || !allowed.has(requested)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(requested)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(path.join(root, requested)).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log('Island Mystery preview: http://127.0.0.1:4173'));
