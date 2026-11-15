// Token usage per run: reads Claude Code's own transcripts (the main session and each subagent),
// counts every API response once, and writes .pipeline/runs/<id>/tokens.json.
// Subagents usually run in the background, so their usage is only in their own transcript files.
import fs from 'node:fs';
import path from 'node:path';
import { runsDir, runDir, readJson, writeJson } from './lib.mjs';

const zero = () => ({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0, total: 0 });

/** Sum usage in one transcript, counting each API message once. Optional time window. */
function sumFile(file, from, to) {
  const u = zero();
  const seen = new Set();
  let first = null, last = null, firstUser = '';
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  for (const line of text.split('\n')) {
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const ts = e.timestamp ? Date.parse(e.timestamp) : null;
    if (!firstUser && e.type === 'user') {
      const c = e.message?.content;
      firstUser = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x.text || '').join('\n') : '';
    }
    const usage = e.message?.usage;
    if (!usage) continue;
    if (from && ts && ts < from) continue;
    if (to && ts && ts > to) continue;
    const key = e.message?.id || e.requestId || e.uuid;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    u.input += usage.input_tokens || 0;
    u.cacheWrite += usage.cache_creation_input_tokens || 0;
    u.cacheRead += usage.cache_read_input_tokens || 0;
    u.output += usage.output_tokens || 0;
    if (ts) { first = first ?? ts; last = ts; }
  }
  u.total = u.input + u.cacheWrite + u.cacheRead + u.output;
  return { usage: u, first, last, firstUser };
}

function subagentFiles(transcriptPath) {
  const dir = path.dirname(transcriptPath);
  const session = path.basename(transcriptPath, '.jsonl');
  const out = [];
  for (const d of [path.join(dir, session, 'subagents'), dir]) {
    try {
      for (const f of fs.readdirSync(d)) if (/^agent-.*\.jsonl$/.test(f)) out.push(path.join(d, f));
    } catch { /* folder missing */ }
  }
  return out;
}

/** Which agent was this? Match its first message against the prompts logged when agents were launched. */
function agentName(firstUser, events) {
  const head = firstUser.trim().slice(0, 300);
  if (!head) return 'agent';
  const hit = events.find((e) => e.type === 'agent.start' && typeof e.detail === 'string' && e.detail.trim().slice(0, 300) === head);
  return hit ? hit.agent : 'agent';
}

/**
 * Recompute tokens.json for runs touched recently, using this session's transcript.
 * Called by the hook when a turn ends or a background agent reports back.
 */
export function updateUsage(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return;
  let ids = [];
  try { ids = fs.readdirSync(runsDir()); } catch { return; }
  const recent = ids.map((id) => ({ id, run: readJson(path.join(runDir(id), 'run.json')) }))
    .filter((r) => r.run && Date.now() - Date.parse(r.run.updated || r.run.created) < 6 * 3600e3);
  if (!recent.length) return;

  // Every event of the recent runs, so an agent can be named even if its launch was logged to another run.
  const allEvents = [];
  for (const r of recent) {
    try {
      for (const l of fs.readFileSync(path.join(runDir(r.id), 'events.jsonl'), 'utf8').split('\n')) {
        if (l.includes('"agent.start"')) { try { allEvents.push(JSON.parse(l)); } catch { /* skip */ } }
      }
    } catch { /* no events */ }
  }

  // Subagents belong to the run whose folder their first message names.
  const agentsByRun = {};
  for (const f of subagentFiles(transcriptPath)) {
    const s = sumFile(f);
    if (!s || !s.usage.total) continue;
    const r = recent.find((x) => s.firstUser.includes(`runs/${x.id}`) || s.firstUser.includes(`runs\\${x.id}`) || s.firstUser.includes(x.id));
    if (!r) continue;
    (agentsByRun[r.id] ||= []).push({
      file: path.basename(f), name: agentName(s.firstUser, allEvents),
      start: s.first ? new Date(s.first).toISOString() : null, end: s.last ? new Date(s.last).toISOString() : null,
      ...s.usage,
    });
  }

  for (const r of recent) {
    const agents = (agentsByRun[r.id] || []).sort((a, b) => String(a.start).localeCompare(String(b.start)));
    const from = Date.parse(r.run.created);
    const to = r.run.finished ? Date.parse(r.run.finished) + 60e3 : null;
    const main = sumFile(transcriptPath, from, to);
    const prev = readJson(path.join(runDir(r.id), 'tokens.json'), null);
    // Only this session's transcript is visible here; keep a larger earlier count (e.g. from another window).
    const conductor = main ? main.usage : zero();
    if (!agents.length && !conductor.total) continue;
    const total = zero();
    for (const a of [...agents, conductor]) for (const k of Object.keys(total)) total[k] += a[k] || 0;
    if (prev && prev.total?.total > total.total && !agents.length) continue;
    writeJson(path.join(runDir(r.id), 'tokens.json'), { updated: new Date().toISOString(), total, conductor, agents });
  }
}
