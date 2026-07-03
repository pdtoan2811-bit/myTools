#!/usr/bin/env node
/* =====================================================================
   publish.mjs — the bridge from a finished guide JOB to a guide REPO.

   Takes  jobs/<slug>/guide.md + assets/*.png  (what the worker produces,
   as edited in Guide Studio) and writes it into a local clone of the app's
   guide repo (a qsortby-guide-style Astro docs site), in that repo's exact
   shape:
     - src/content/docs/<section>/<order>-<file>.mdx   (frontmatter + body)
     - public/assets/<file>/<image>.png                (copied images)

   Transforms applied:
     - frontmatter  → title / description / updated / draft   (repo schema)
     - drops the duplicate body H1 (title comes from frontmatter)
     - image paths  ](assets/x.png)  →  ](/assets/<file>/x.png)
     - "> **Tip:** …" blockquotes    →  <Callout type="tip"> … </Callout>

   By default it lands the result on a fresh branch `guide/<file>` in the
   guide repo, STAGED but not committed, so you can review the diff, then
   commit / push / open the PR yourself.

   Usage:
     node workers/guide-jobs/publish.mjs jobs/<slug> [--no-git] [--dry]

     --no-git   just write files on the current branch (no branch switch)
     --dry      print what would happen; write nothing
   ===================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..'); // userGuideTools/

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const jobArg = args.find((a) => !a.startsWith('--'));
const DRY = flags.has('--dry');
const NO_GIT = flags.has('--no-git');
const PUSH = flags.has('--push');       // gate: go ONLINE (push the local commit to origin/<branch>)
const STATUS = flags.has('--status');   // just print the pipeline state for this job, then exit

if (!jobArg) die('Usage: node workers/guide-jobs/publish.mjs jobs/<slug> [--push] [--status] [--no-git] [--dry]');

const expand = (p) => (p ? p.replace(/^~(?=$|\/)/, os.homedir()) : p);
function die(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1); }
function git(cwd, ...a) { return execFileSync('git', a, { cwd, encoding: 'utf8' }).trim(); }
function gitOk(cwd, ...a) { try { git(cwd, ...a); return true; } catch { return false; } }
const nowISO = () => new Date().toISOString();

// ---- load job -------------------------------------------------------------
const jobDir = path.resolve(ROOT, jobArg);
const jobJsonPath = path.join(jobDir, 'job.json');
const guideMdPath = path.join(jobDir, 'guide.md');
if (!fs.existsSync(jobJsonPath)) die(`No job.json at ${jobJsonPath}`);
if (!STATUS && !fs.existsSync(guideMdPath)) die(`No guide.md at ${guideMdPath} — run the worker first (node workers/guide-jobs/run.mjs ${jobArg}).`);

// ---- publish-state file (jobs/<slug>/publish.json): rendered → local → online
const stateFile = path.join(jobDir, 'publish.json');
const readState = () => { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return {}; } };
const writeState = (s) => fs.writeFileSync(stateFile, JSON.stringify(s, null, 2) + '\n');
const isRendered = () => {
  if (fs.existsSync(guideMdPath)) return true;
  try { return JSON.parse(fs.readFileSync(path.join(jobDir, 'status.json'), 'utf8')).state === 'ok'; } catch { return false; }
};

const job = JSON.parse(fs.readFileSync(jobJsonPath, 'utf8'));
const pub = job.publish;
if (!pub || !pub.app) die(`job.json has no "publish" block. Add one, e.g.:\n\n  "publish": {\n    "app": "qsortby",\n    "section": "1-getting-started",\n    "order": 30,\n    "file": "quickstart",\n    "description": "One-line summary shown under the title."\n  }`);

// ---- resolve target app from the registry ---------------------------------
const registry = (await import(pathToFileURL(path.join(ROOT, 'apps.config.mjs')))).default;
const app = registry.apps?.[pub.app];
if (!app) die(`Unknown app "${pub.app}". Known apps: ${Object.keys(registry.apps || {}).join(', ') || '(none)'}. Add it to apps.config.mjs.`);

const repo = expand(app.guideRepo);
if (!fs.existsSync(path.join(repo, '.git'))) die(`Guide repo not found (or not a git repo) at ${repo}. Clone it first:\n  git clone <url> ${repo}`);

// warn if the repo's preset doesn't match the app we think we're publishing to
try {
  const cfg = fs.readFileSync(path.join(repo, 'src/config.ts'), 'utf8');
  const m = cfg.match(/preset:\s*'([^']+)'/);
  if (m && app.preset && m[1] !== app.preset) {
    console.warn(`⚠ guide repo preset is '${m[1]}' but app "${pub.app}" expects '${app.preset}' (check src/config.ts).`);
  }
} catch { /* non-fatal */ }

// ---- derive names ---------------------------------------------------------
const slug = String(pub.file || job.slug).replace(/^\d+[-_.]/, '');
const section = pub.section || '1-getting-started';
const order = pub.order ?? 10;
const draft = pub.draft ?? false;
const branch = app.branch || `guide/${slug}`;   // registry-configured target branch (e.g. toanGuide)

// ---- `--status`: print the pipeline and exit ------------------------------
if (STATUS) {
  const st = readState();
  const local = st.stage === 'local' || st.stage === 'online';
  const online = st.stage === 'online';
  const mark = (on) => (on ? '✓' : '·');
  console.log(`\n  ${jobArg}  →  ${pub.app} / ${branch}`);
  console.log(`   [${mark(isRendered())}] rendered   ${isRendered() ? '' : '— run.mjs first'}`);
  console.log(`   [${mark(local)}] local      ${st.commit ? `commit ${st.commit.slice(0, 7)} · ${st.local_at || ''}` : '— not published locally'}`);
  console.log(`   [${mark(online)}] online     ${online ? `pushed · ${st.online_at || ''}` : '— not pushed'}\n`);
  process.exit(0);
}

// ---- parse guide.md -------------------------------------------------------
const raw = fs.readFileSync(guideMdPath, 'utf8');
const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
const fmData = {};
if (fm) for (const line of fm[1].split('\n')) {
  const mm = line.match(/^(\w+):\s*(.*)$/);
  if (mm) fmData[mm[1]] = mm[2].replace(/^["']|["']$/g, '');
}
let body = fm ? raw.slice(fm[0].length) : raw;

const title = pub.title || job.title || fmData.title || slug;

// drop the leading duplicate H1 (repo renders the title from frontmatter)
body = body.replace(/^\s*#\s+.*\n+/, '');

// description: explicit → else first sentence of the lead paragraph
let description = pub.description || job.intro || '';
if (description) description = description.replace(/\s+/g, ' ').trim().replace(/^(.+?[.!?])\s.*$/s, '$1');

// image paths → repo's public/assets/<slug>/…
body = body.replace(/\]\(assets\//g, `](/assets/${slug}/`);

// "> **Tip:** …" blockquotes → <Callout>
let usedCallout = false;
const KIND = { tip: 'tip', note: 'note', warning: 'warning', danger: 'danger', careful: 'danger', caution: 'warning' };
{
  const lines = body.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i].match(/^>\s*\*\*([A-Za-z]+):\*\*\s*(.*)$/);
    if (start) {
      const kind = KIND[start[1].toLowerCase()] || 'note';
      const title = start[1][0].toUpperCase() + start[1].slice(1);
      const buf = [start[2]];
      while (i + 1 < lines.length && /^>/.test(lines[i + 1])) buf.push(lines[++i].replace(/^>\s?/, ''));
      usedCallout = true;
      out.push(`<Callout type="${kind}" title="${title}">`, buf.join('\n').trim(), `</Callout>`);
    } else {
      out.push(lines[i]);
    }
  }
  body = out.join('\n');
}
body = body.replace(/\n{3,}/g, '\n\n').trim();

// ---- compose the .mdx -----------------------------------------------------
const updated = new Date().toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/"/g, '\\"');
const frontmatter = [
  '---',
  `title: "${esc(title)}"`,
  description ? `description: "${esc(description)}"` : null,
  // optional exact group label + order (else the site derives them from the folder name/number)
  pub.sectionLabel ? `section: "${esc(pub.sectionLabel)}"` : null,
  pub.sectionOrder != null ? `sectionOrder: ${pub.sectionOrder}` : null,
  `updated: ${updated}`,
  draft ? 'draft: true' : null,
  '---',
].filter(Boolean).join('\n');

const imports = usedCallout ? `import Callout from '../../../components/Callout.astro';\n\n` : '';
const mdx = `${frontmatter}\n${imports}${body}\n`;

// ---- destinations ---------------------------------------------------------
const docsDir = path.join(repo, 'src/content/docs', section);
const mdxPath = path.join(docsDir, `${order}-${slug}.mdx`);
const assetsOut = path.join(repo, 'public/assets', slug);
const srcAssets = path.join(jobDir, 'assets');
const images = fs.existsSync(srcAssets) ? fs.readdirSync(srcAssets).filter((f) => /\.(png|jpe?g|webp|gif|svg)$/i.test(f)) : [];

const rel = (p) => path.relative(repo, p);
console.log(`\n  guide job : ${jobArg}`);
console.log(`  → app     : ${pub.app}  (preset ${app.preset})`);
console.log(`  → repo    : ${repo}`);
console.log(`  → page    : ${rel(mdxPath)}`);
console.log(`  → images  : ${images.length} → ${rel(assetsOut)}/`);

if (DRY) { console.log('\n--dry: nothing written.\n'); console.log(mdx); process.exit(0); }

console.log(`  → branch  : ${branch}`);

// ---- checkout the target branch (unless --no-git) -------------------------
if (!NO_GIT) {
  const dirty = git(repo, 'status', '--porcelain');
  if (dirty) console.warn(`⚠ guide repo has uncommitted changes; publishing on top of them.`);
  const cur = git(repo, 'rev-parse', '--abbrev-ref', 'HEAD');
  if (cur !== branch) {
    if (git(repo, 'branch', '--list', branch)) git(repo, 'checkout', branch);
    else if (gitOk(repo, 'rev-parse', '--verify', `origin/${branch}`)) git(repo, 'checkout', '-b', branch, `origin/${branch}`);
    else git(repo, 'checkout', '-b', branch);
  }
}

// ---- write ----------------------------------------------------------------
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(mdxPath, mdx);
fs.mkdirSync(assetsOut, { recursive: true });
for (const img of images) fs.copyFileSync(path.join(srcAssets, img), path.join(assetsOut, img));

if (NO_GIT) {
  console.log(`\n✓ written on the current branch (no-git). Files are unstaged — commit them yourself.\n`);
  process.exit(0);
}

// ══ STATE: LOCAL — stage + commit onto <branch> in the local clone ═════════
git(repo, 'add', rel(mdxPath), rel(assetsOut));
let state = readState();
const nothingStaged = gitOk(repo, 'diff', '--cached', '--quiet');  // true ⇒ index clean (ignores untracked)
if (!nothingStaged) {
  git(repo, 'commit', '-m', `guide: ${slug}`);
  const commit = git(repo, 'rev-parse', 'HEAD');
  state = { slug, app: pub.app, repo, branch, stage: 'local', commit, message: `guide: ${slug}`, local_at: nowISO(), online_at: null };
  writeState(state);
  console.log(`\n✓ LOCAL — committed ${commit.slice(0, 7)} onto ${branch} (not pushed).`);
} else {
  console.log(`\n✓ LOCAL — no changes; ${branch} already carries this guide.`);
  if (state.stage !== 'online') { state = { ...state, slug, app: pub.app, repo, branch, stage: 'local', commit: git(repo, 'rev-parse', 'HEAD'), local_at: state.local_at || nowISO(), online_at: null }; writeState(state); }
}

// ══ STATE: ONLINE — gated behind --push ════════════════════════════════════
if (PUSH) {
  git(repo, 'push', '-u', 'origin', branch);
  state.stage = 'online'; state.online_at = nowISO(); writeState(state);
  console.log(`\n✓ ONLINE — pushed ${branch} → origin/${branch}.`);
  console.log(`   https://github.com/qdndigital/qsortby-guide/tree/${branch}\n`);
} else {
  console.log(`\n  Review it, then go online when ready:`);
  console.log(`    cd ${repo} && npm run dev       # preview at http://localhost:4321`);
  console.log(`    node workers/guide-jobs/publish.mjs ${jobArg} --push   # → origin/${branch}`);
  console.log(`  Check state any time:  node workers/guide-jobs/publish.mjs ${jobArg} --status\n`);
}
