// Shared helpers for the pipeline CLI, hooks and dashboard. Node 18+, no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Project root: CLAUDE_PROJECT_DIR when Claude Code sets it, else two folders up from .pipeline/tools. */
export function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR || path.resolve(here, '..', '..');
}

export const pipelineDir = () => path.join(projectRoot(), '.pipeline');
export const runsDir = () => path.join(pipelineDir(), 'runs');
export const activeFile = () => path.join(pipelineDir(), 'active-run');

export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export function activeRunId() {
  try {
    const id = fs.readFileSync(activeFile(), 'utf8').trim();
    return id && fs.existsSync(path.join(runsDir(), id, 'run.json')) ? id : null;
  } catch { return null; }
}

export const runDir = (id) => path.join(runsDir(), id);

/** Append one event line. Every event gets ts (ISO) and type. */
export function appendEvent(id, event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n';
  fs.appendFileSync(path.join(runDir(id), 'events.jsonl'), line);
}

export function updateRun(id, patch) {
  const file = path.join(runDir(id), 'run.json');
  const run = readJson(file, {});
  const next = { ...run, ...patch, updated: new Date().toISOString() };
  writeJson(file, next);
  return next;
}

export function pipelines() {
  return readJson(path.join(pipelineDir(), 'pipelines.json'), {});
}

export function slug(text) {
  return String(text || 'run').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'run';
}

/** Shorten long strings so events.jsonl stays small. */
export function clip(value, max = 4000) {
  if (value == null) return value;
  const s = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return s.length > max ? s.slice(0, max) + `\n… [${s.length - max} more characters]` : s;
}

/** Project settings in .pipeline/config.json (all optional). */
export function config() {
  return readJson(path.join(pipelineDir(), 'config.json'), {});
}

/** The variant registry: every selectable alternative per game and slot. */
export function variantsPath() {
  return path.join(projectRoot(), config().variantsFile || 'Docs/Variants.json');
}

/** Minutes without progress after which a running run whose stages are all idle counts as stalled. */
export const STALL_MINUTES = 2;

/**
 * Says whether a run is stalled: still "running", no stage running, and the last update is older than
 * <see cref="STALL_MINUTES"/>. Returns null when fine, else { minutes, after, next }.
 */
export function stallInfo(run, now = Date.now()) {
  if (!run || run.status !== 'running') return null;
  const stages = run.stages || [];
  if (stages.some((s) => s.status === 'running')) return null;
  const minutes = (now - Date.parse(run.updated || run.created)) / 60000;
  if (!(minutes >= STALL_MINUTES)) return null;
  const done = stages.filter((s) => s.status === 'done');
  const next = stages.find((s) => s.status === 'pending');
  return { minutes: Math.floor(minutes), after: done.length ? done[done.length - 1].name : 'start', next: next ? next.name : null };
}
