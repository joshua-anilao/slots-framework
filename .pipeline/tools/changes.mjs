// Work out which files a run changed, ignoring changes that were already uncommitted when it started.
// At `start` we snapshot every dirty file (its content is stored in git's object store, invisible to you);
// at `diff` we compare against that snapshot, so the diff and file list contain only this run's work.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const IGNORE = [/^\.pipeline\//, /^\.claude\//, /^art\/generated\//, /^Library\//, /^Temp\//, /^Logs\//, /^obj\//, /^UserSettings\//];
const MAX_TEXT = 300 * 1024;

function git(root, args, input) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 200e6, input, stdio: ['pipe', 'pipe', 'ignore'] });
}
function gitOk(root, args) { try { return git(root, args).trim(); } catch { return null; } }

export function isRepo(root) { return gitOk(root, ['rev-parse', '--is-inside-work-tree']) === 'true'; }

/** Dirty paths right now: { path: blobSha | 'deleted' }. */
function dirty(root) {
  const out = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const parts = out.split('\0').filter(Boolean);
  const files = {};
  const present = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    const code = entry.slice(0, 2);
    const p = entry.slice(3);
    if (code[0] === 'R' || code[0] === 'C') { const old = parts[++i]; if (!IGNORE.some((r) => r.test(old))) files[old] = 'deleted'; }
    if (IGNORE.some((r) => r.test(p))) continue;
    if (!fs.existsSync(path.join(root, p))) { files[p] = 'deleted'; continue; }
    if (fs.statSync(path.join(root, p)).isDirectory()) continue;
    present.push(p);
  }
  if (present.length) {
    const shas = git(root, ['hash-object', '-w', '--stdin-paths'], present.join('\n') + '\n').trim().split('\n');
    present.forEach((p, i) => { files[p] = shas[i]; });
  }
  return files;
}

export function snapshot(root) {
  if (!isRepo(root)) return null;
  const empty = git(root, ['hash-object', '-w', '--stdin'], '').trim();
  return { at: new Date().toISOString(), head: gitOk(root, ['rev-parse', 'HEAD']), empty, files: dirty(root) };
}

function blobAt(root, rev, p) { return rev ? gitOk(root, ['rev-parse', `${rev}:${p}`]) : null; }

/** Files this run changed, plus a diff of only those changes. `only` (optional Set of paths) limits it to those files. */
export function runChanges(root, base, only = null) {
  const now = dirty(root);
  const head = gitOk(root, ['rev-parse', 'HEAD']);
  const paths = new Set([...Object.keys(now), ...Object.keys(base.files)]);
  const files = [];
  let diff = '';
  for (const p of [...paths].sort()) {
    if (only && !only.has(p)) continue;
    const before = base.files[p] ?? blobAt(root, base.head, p) ?? null;
    const after = now[p] ?? blobAt(root, head, p) ?? 'deleted';
    const b = before === 'deleted' ? null : before;
    const a = after === 'deleted' ? null : after;
    if (b === a) continue;
    const status = !b ? 'added' : !a ? 'deleted' : 'modified';
    // mixed = the file already had uncommitted edits before the run; committing it includes those too.
    const entry = { path: p, status, binary: false, added: 0, removed: 0, mixed: p in base.files };
    const from = b || base.empty;
    const to = a || base.empty;
    const num = gitOk(root, ['diff', '--numstat', from, to]) || '';
    const [plus, minus] = num.split('\t');
    if (plus === '-') entry.binary = true; else { entry.added = Number(plus) || 0; entry.removed = Number(minus) || 0; }
    files.push(entry);
    if (p.endsWith('.meta')) continue;
    const size = a ? Number(gitOk(root, ['cat-file', '-s', a]) || 0) : 0;
    if (entry.binary || size > MAX_TEXT) {
      diff += `diff --git a/${p} b/${p}\n${status} ${entry.binary ? 'binary' : 'large'} file (${(size / 1024).toFixed(0)} KB), contents not shown\n\n`;
      continue;
    }
    const body = gitOk(root, ['diff', '--no-color', '-U3', from, to]) || '';
    const hunks = body.slice(Math.max(0, body.indexOf('@@')));
    diff += `diff --git a/${p} b/${p}\n--- ${b ? 'a/' + p : '/dev/null'}\n+++ ${a ? 'b/' + p : '/dev/null'}\n${hunks}\n`;
  }
  return { files, diff };
}
