/* Tiny static file server for the demo target app (no deps).
   Usage: node fixtures/serve.mjs [dir] [port]   default: ./demo-app 4178 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(__dir, 'demo-app');
const port = +(process.argv[3] || 4178);
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p.endsWith('/')) p += 'index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, () => console.log(`demo app on http://localhost:${port}  (serving ${root})`));
