#!/usr/bin/env node
// Scaffold a new app in the workspace:
//   node tools/scaffold-app.mjs <app-name>
// Creates apps/<app>/{app,website,guides} with CLAUDE.md identity stubs, adds synced
// working copies of every shared tool, and prints the workspace.json entry to paste.
import { readdirSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'); // ~/qdn
const app = process.argv[2];
if (!app || !/^[a-z0-9-]+$/.test(app)) {
  console.error('Usage: node tools/scaffold-app.mjs <app-name>   (lowercase-kebab)');
  process.exit(1);
}
const appDir = join(root, 'apps', app);
if (existsSync(appDir)) { console.error(`✗ apps/${app} already exists.`); process.exit(1); }

// 1. Copy the template, substituting {{APP}}.
const tpl = join(root, 'tools', '_template-app');
(function copy(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, e.name), d = join(dst, e.name);
    if (e.isDirectory()) copy(s, d);
    else writeFileSync(d, readFileSync(s, 'utf8').replaceAll('{{APP}}', app));
  }
})(tpl, appDir);

// 2. Add synced working copies of every shared tool.
mkdirSync(join(appDir, 'tools'), { recursive: true });
const tools = readdirSync(join(root, 'tools'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'));
for (const t of tools) {
  const src = join(root, 'tools', t.name) + '/';
  const dst = join(appDir, 'tools', t.name) + '/';
  execSync(`rsync -a --exclude 'node_modules/' --exclude '.git/' --exclude '.env' --exclude 'CLAUDE.md' "${src}" "${dst}"`, { stdio: 'inherit' });
  writeFileSync(join(appDir, 'tools', t.name, 'CLAUDE.md'),
    `# Identity: ${app} · tool copy · ${t.name} (SYNCED — do not edit here)\n\n` +
    `Working copy synced from canonical \`~/qdn/tools/${t.name}\`. Edits here are overwritten ` +
    `on the next \`sync-tools\`. Edit the canonical and re-sync. App map → ../../CLAUDE.md.\n`);
}

// 3. Print the registry entry to paste into workspace.json.
const entry = { [app]: {
  aka: [], parts: {
    app:     { path: `apps/${app}/app`,     repo: '', branch: '', role: '' },
    website: { path: `apps/${app}/website`, repo: '', branch: '', role: '' },
    guides:  { path: `apps/${app}/guides`,  repo: '', branch: '', role: '' },
  },
  tools: Object.fromEntries(tools.map((t) => [t.name, `apps/${app}/tools/${t.name}`])),
} };

console.log(`\n✓ created apps/${app}/{app,website,guides,tools}\nNext:`);
console.log(`  1. Clone/copy the real repos into apps/${app}/{app,website,guides}`);
console.log(`  2. Fill each CLAUDE.md identity header (repo + branch).`);
console.log(`  3. Add to workspace.json under "apps":\n`);
console.log(JSON.stringify(entry, null, 2));
