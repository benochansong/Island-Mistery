// Development-only preview: loopback, explicit asset allowlist, no filesystem browsing.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const allowed = new Set(['index.html', 'css/styles.css', 'css/cinematic.css', 'css/online.css', 'css/growth.css', 'css/beta.css', 'assets/island.svg', 'assets/compass.svg', ...['data', 'config', 'social', 'dialogue', 'discussion', 'perception', 'schema', 'challenges', 'progression', 'story-data', 'story', 'missions', 'codex', 'ai', 'state', 'storage', 'ui', 'story-ui', 'assets', 'settings', 'audio', 'presentation-model', 'presentation', 'growth-store', 'app', 'online', 'growth-ui','beta-core','beta-ui'].map(name => `js/${name}.js`)]);
for (const folder of ['assets/backgrounds','assets/characters','assets/audio/bgm','assets/audio/sfx']) for (const file of fs.readdirSync(path.join(root,folder))) allowed.add(folder+'/'+file);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.wav': 'audio/wav' };
http.createServer((req, res) => {
  let requested;
  try { requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html'; }
  catch { res.writeHead(400); return res.end(); }
  if (!['GET', 'HEAD'].includes(req.method) || !allowed.has(requested)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(requested)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(path.join(root, requested)).on('error', () => res.destroy()).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log('Island Mystery preview: http://127.0.0.1:4173'));
