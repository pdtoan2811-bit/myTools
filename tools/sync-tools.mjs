#!/usr/bin/env node
// Push each canonical tool (~/qdn/tools/<tool>) into every app's working copy
// (apps/<app>/tools/<tool>), per workspace.json. Preserves each copy's identity
// CLAUDE.md, its .env, and its generated assets.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'); // ~/qdn
const ws = JSON.parse(readFileSync(join(root, 'workspace.json'), 'utf8'));

const EXCLUDES = [
  'node_modules/', '.git/', '.env', '.DS_Store', '.astro/',
  'CLAUDE.md',                 // keep the per-copy "synced — do not edit" identity
  'exports/*.png', 'public/products/*.png', // keep each app's generated assets
];
const exArgs = EXCLUDES.map((e) => `--exclude '${e}'`).join(' ');

let n = 0;
for (const [appName, app] of Object.entries(ws.apps || {})) {
  for (const [toolName, destRel] of Object.entries(app.tools || {})) {
    const src = join(root, 'tools', toolName) + '/';
    const dest = join(root, destRel) + '/';
    console.log(`sync  ${toolName}  →  ${appName}  (${destRel})`);
    execSync(`rsync -a ${exArgs} "${src}" "${dest}"`, { stdio: 'inherit' });
    n++;
  }
}
console.log(`\n✓ synced ${n} tool copy(ies). CLAUDE.md, .env, and generated assets left intact.`);
