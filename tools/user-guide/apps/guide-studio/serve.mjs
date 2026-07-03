/* =====================================================================
   Guide Studio — local server: job board + markdown editor + image editor.
   Run:  npm run studio   (then open http://localhost:4319)
   ===================================================================== */
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, stat, rename, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');
const JOBS = join(ROOT, 'jobs');
const EDITOR_DIR = join(ROOT, 'packages', 'userguidesnap', 'src');
const PORT = +(process.env.PORT || 4319);
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const send = (res, code, type, body) => { res.writeHead(code, { 'content-type': type, 'access-control-allow-origin': '*' }); res.end(body); };
const json = (res, code, obj) => send(res, code, 'application/json', JSON.stringify(obj));
const body = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d)); });
const readJson = async (p, fb = null) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fb; } };
const safe = (s) => /^[a-z0-9-]+$/.test(s || '');

async function listJobs() {
  if (!existsSync(JOBS)) return [];
  const out = [];
  for (const slug of await readdir(JOBS)) {
    if (slug.startsWith('.')) continue;   // skip .trash and other dotfolders
    const dir = join(JOBS, slug);
    if (!(await stat(dir)).isDirectory()) continue;
    const job = await readJson(join(dir, 'job.json'));
    const st = await readJson(join(dir, 'status.json'), { state: job ? 'draft' : 'new' });
    let images = 0; try { images = (await readdir(join(dir, 'assets'))).filter((f) => f.endsWith('.png')).length; } catch {}
    // Archived state lives in a marker file (NOT status.json, which the worker rewrites every run).
    out.push({ slug, title: job?.title || slug, state: st?.state || 'new', steps: job?.steps?.length || 0, images, hasMd: existsSync(join(dir, 'guide.md')), archived: existsSync(join(dir, '.archived')) });
  }
  return out;
}

function runWorker(slug, args, res) {
  const p = spawn('node', [join(ROOT, 'workers', 'guide-jobs', 'run.mjs'), join('jobs', slug), ...args], { cwd: ROOT, env: process.env });
  let log = ''; p.stdout.on('data', (d) => (log += d)); p.stderr.on('data', (d) => (log += d));
  p.on('close', (code) => json(res, code === 0 ? 200 : 500, { ok: code === 0, log }));
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = decodeURIComponent(url.pathname);
    const m = path.match(/^\/api\/jobs\/([a-z0-9-]+)(\/.*)?$/);

    // ---- API ----
    if (path === '/api/jobs') return json(res, 200, await listJobs());
    if (m) {
      const slug = m[1], sub = m[2] || ''; const dir = join(JOBS, slug);
      if (!safe(slug) || !existsSync(dir)) return json(res, 404, { error: 'no job' });
      if (req.method === 'GET' && sub === '') return json(res, 200, {
        slug, job: await readJson(join(dir, 'job.json')), guide: await readJson(join(dir, 'guide.json')),
        md: existsSync(join(dir, 'guide.md')) ? await readFile(join(dir, 'guide.md'), 'utf8') : '', status: await readJson(join(dir, 'status.json')),
      });
      // live-reload: newest mtime across a job's rendered assets + guide.md (client polls this)
      if (req.method === 'GET' && sub === '/rev') {
        let rev = 0;
        try { for (const f of await readdir(join(dir, 'assets'))) { const s = await stat(join(dir, 'assets', f)); if (s.mtimeMs > rev) rev = s.mtimeMs; } } catch {}
        try { const s = await stat(join(dir, 'guide.md')); if (s.mtimeMs > rev) rev = s.mtimeMs; } catch {}
        try { const s = await stat(join(dir, 'status.json')); if (s.mtimeMs > rev) rev = s.mtimeMs; } catch {}
        return json(res, 200, { rev: Math.round(rev) });
      }
      if (req.method === 'PUT' && sub === '/md') { await writeFile(join(dir, 'guide.md'), await body(req)); return json(res, 200, { ok: true }); }
      if (req.method === 'PUT' && sub === '/guide') { await writeFile(join(dir, 'guide.json'), await body(req)); return json(res, 200, { ok: true }); }
      if (req.method === 'POST' && sub === '/render') return runWorker(slug, ['--from-guide'], res);   // re-render edited images + md
      if (req.method === 'POST' && sub === '/rebuild') return runWorker(slug, ['--no-capture'], res);  // rebuild from job.json
      if (req.method === 'POST' && sub === '/archive') {                                                // soft archive (reversible)
        const want = JSON.parse((await body(req)) || '{}'); const marker = join(dir, '.archived');
        if (want.archived === false) { if (existsSync(marker)) await unlink(marker); }
        else await writeFile(marker, new Date().toISOString());
        return json(res, 200, { ok: true, archived: want.archived !== false });
      }
      if (req.method === 'DELETE' && sub === '') {                                                      // remove → move to jobs/.trash (recoverable)
        const trash = join(JOBS, '.trash'); if (!existsSync(trash)) await mkdir(trash, { recursive: true });
        const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        await rename(dir, join(trash, `${slug}-${stamp}`));
        return json(res, 200, { ok: true });
      }
      if (sub.startsWith('/asset/')) { const f = join(dir, 'assets', normalize(sub.slice('/asset/'.length))); if (f.startsWith(join(dir, 'assets')) && existsSync(f)) { res.writeHead(200, { 'content-type': MIME['.png'], 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); return res.end(await readFile(f)); } return json(res, 404, {}); }
      return json(res, 404, { error: 'unknown' });
    }

    // ---- userGuideSnap image editor (mounted at /editor/) ----
    if (path.startsWith('/editor/')) {
      const f = join(EDITOR_DIR, normalize(path.slice('/editor/'.length) || 'editor.html'));
      if (f.startsWith(EDITOR_DIR) && existsSync(f)) return send(res, 200, MIME[extname(f)] || 'text/plain', await readFile(f));
      return send(res, 404, 'text/plain', 'not found');
    }

    // ---- studio static ----
    const f = join(__dir, path === '/' ? 'index.html' : normalize(path));
    if (f.startsWith(__dir) && existsSync(f) && (await stat(f)).isFile()) return send(res, 200, MIME[extname(f)] || 'text/plain', await readFile(f));
    return send(res, 404, 'text/plain', 'not found');
  } catch (e) { json(res, 500, { error: String(e && e.message || e) }); }
}).listen(PORT, () => console.log(`Guide Studio → http://localhost:${PORT}`));
