#!/usr/bin/env node
// Copies the pipeline's agents, commands, skills and hook settings into .claude/.
// Safe to run on every start: it only copies files that changed, and keeps
// any .claude file you edited after the last copy.
//   node .pipeline/setup/install-claude-files.mjs [--quiet]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const src = path.join(here, 'claude');
const dest = path.join(root, '.claude');
const quiet = process.argv.includes('--quiet');
const say = (m) => { if (!quiet) console.log(m); };
let changed = 0;

for (const dir of ['agents', 'commands']) {
  if (!fs.existsSync(path.join(src, dir))) continue;
  fs.mkdirSync(path.join(dest, dir), { recursive: true });
  for (const f of fs.readdirSync(path.join(src, dir))) {
    const from = path.join(src, dir, f);
    const to = path.join(dest, dir, f);
    const next = fs.readFileSync(from);
    if (fs.existsSync(to)) {
      if (Buffer.compare(fs.readFileSync(to), next) === 0) continue;
      if (fs.statSync(to).mtimeMs > fs.statSync(from).mtimeMs) {
        console.log(`kept your edited .claude/${dir}/${f} (differs from the copy in .pipeline/setup/claude/${dir}/)`);
        continue;
      }
    }
    fs.writeFileSync(to, next);
    changed++;
    console.log(`updated .claude/${dir}/${f}`);
  }
}

// Skills: .pipeline/setup/claude/skills/<name>/** -> .claude/skills/<name>/** (same keep-your-edits rule).
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const skillsSrc = path.join(src, 'skills');
if (fs.existsSync(skillsSrc)) {
  for (const from of walk(skillsSrc)) {
    const rel = path.relative(skillsSrc, from);
    const to = path.join(dest, 'skills', rel);
    const next = fs.readFileSync(from);
    if (fs.existsSync(to)) {
      if (Buffer.compare(fs.readFileSync(to), next) === 0) continue;
      if (fs.statSync(to).mtimeMs > fs.statSync(from).mtimeMs) {
        console.log(`kept your edited .claude/skills/${rel} (differs from the copy in .pipeline/setup/claude/skills/)`);
        continue;
      }
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, next);
    changed++;
    console.log(`updated .claude/skills/${rel}`);
  }
}

// Merge hooks into .claude/settings.json, keeping anything else already there.
const file = path.join(dest, 'settings.json');
const oursFile = path.join(src, 'settings.json');
if (fs.existsSync(oursFile)) {
  const ours = JSON.parse(fs.readFileSync(oursFile, 'utf8'));
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const theirs = before ? JSON.parse(before) : {};
  theirs.hooks = theirs.hooks || {};
  for (const [event, groups] of Object.entries(ours.hooks || {})) {
    const list = (theirs.hooks[event] || [])
      .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !String(h.command).includes('.pipeline/tools/hook.mjs')) }))
      .filter((g) => g.hooks.length);
    theirs.hooks[event] = [...list, ...groups];
  }
  const after = JSON.stringify(theirs, null, 2) + '\n';
  if (after !== before) {
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(file, after);
    changed++;
    console.log('updated hooks in .claude/settings.json');
  }
}

say(changed ? `\n${changed} file(s) updated. Restart Claude Code to load them.` : 'Claude files are up to date.');
