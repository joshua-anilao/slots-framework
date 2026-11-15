#!/usr/bin/env node
// Pipeline dashboard: a small local web server that reads .pipeline/runs and shows
// what the agents are doing right now, plus the full history of every run.
//
//   node .pipeline/dashboard/server.mjs [--port 4700] [--host 127.0.0.1] [--open]
// --open opens the dashboard in the default browser (also when it is already running).
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stallInfo } from '../tools/lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(opt('port', process.env.PIPELINE_PORT || 4700));
const HOST = opt('host', '127.0.0.1');
const ROOT = path.resolve(opt('root', process.env.PIPELINE_ROOT || path.resolve(here, '..', '..')));
const RUNS = path.join(ROOT, '.pipeline', 'runs');
const PIPELINES = path.join(ROOT, '.pipeline', 'pipelines.json');

const readJson = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

function readEvents(id) {
  try {
    return fs.readFileSync(path.join(RUNS, id, 'events.jsonl'), 'utf8')
      .split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Turn raw start/end events into one row per action, newest state merged in. */
function buildItems(run, events) {
  const t0 = Date.parse(run.created || events[0]?.ts || Date.now());
  const items = [];
  const open = new Map();
  let gate = null;
  let seq = 0;
  const push = (it) => { it.seq = seq++; it.offsetMs = Date.parse(it.ts) - t0; items.push(it); return it; };

  for (const e of events) {
    switch (e.type) {
      case 'agent.start':
      case 'tool.start': {
        const kind = e.type.startsWith('agent') ? 'agent' : 'tool';
        const it = push({ kind, ts: e.ts, agent: e.agent, tool: e.tool, title: e.text, input: e.detail, status: 'running' });
        open.set(kind + ':' + e.id, it);
        break;
      }
      case 'agent.end':
      case 'tool.end': {
        const kind = e.type.startsWith('agent') ? 'agent' : 'tool';
        let it = open.get(kind + ':' + e.id);
        if (!it) it = push({ kind, ts: e.ts, agent: e.agent, tool: e.tool, title: e.tool || e.agent, status: 'running' });
        open.delete(kind + ':' + e.id);
        it.status = e.error ? 'error' : 'done';
        it.output = e.detail;
        it.endTs = e.ts;
        it.durationMs = e.durationMs || Date.parse(e.ts) - Date.parse(it.ts);
        if (e.tokens) it.tokens = e.tokens;
        if (e.tokensIn) it.tokensIn = e.tokensIn;
        if (e.tokensOut) it.tokensOut = e.tokensOut;
        if (e.toolUses) it.toolUses = e.toolUses;
        break;
      }
      case 'gate.open':
        gate = push({ kind: 'gate', ts: e.ts, agent: 'you', title: e.text, status: 'waiting' });
        break;
      case 'gate.resolve':
        if (gate) { gate.status = e.status === 'approved' ? 'done' : 'rejected'; gate.output = `${cap(e.status)}${e.text ? ': ' + e.text : ''}`; gate.endTs = e.ts; gate.durationMs = Date.parse(e.ts) - Date.parse(gate.ts); gate = null; }
        break;
      case 'user': {
        // Background agents report back as a message into the main chat; show that as the agent finishing, not as you.
        const m = String(e.text || '').match(/agent-message from="([^"]+)"/);
        if (m) push({ kind: 'note', ts: e.ts, agent: 'main', title: 'An agent reported back', output: e.text, status: 'done' });
        else push({ kind: 'user', ts: e.ts, agent: 'you', title: e.text, output: e.text, status: 'done' });
        break;
      }
      case 'stage': {
        const verb = { running: 'started', done: 'finished', failed: 'failed', skipped: 'skipped' }[e.status] || e.status;
        push({ kind: 'stage', ts: e.ts, agent: e.agent, title: `${cap(e.agent)} ${verb}${e.text ? ' — ' + e.text : ''}`, status: e.status === 'failed' ? 'error' : 'done', stageStatus: e.status });
        break;
      }
      case 'handoff': push({ kind: 'handoff', ts: e.ts, agent: e.from, to: e.to, file: e.file, title: `${e.from} → ${e.to}${e.file ? ' · ' + e.file : ''}`, output: e.text, status: 'done' }); break;
      case 'file': push({ kind: 'file', ts: e.ts, agent: e.agent, file: e.file, title: e.text, status: 'done' }); break;
      case 'attention': push({ kind: 'attention', ts: e.ts, agent: 'you', title: e.text, output: e.text, status: 'done', attentionKind: e.kind }); break;
      case 'note': push({ kind: 'note', ts: e.ts, agent: e.agent, title: e.text, output: e.text, status: 'done' }); break;
      case 'score': push({ kind: 'score', ts: e.ts, agent: e.agent, title: e.text, score: e.score, status: 'done' }); break;
      case 'idle': push({ kind: 'idle', ts: e.ts, agent: 'main', title: e.text, status: 'done' }); break;
      case 'run.start': push({ kind: 'run', ts: e.ts, agent: 'you', title: `Started ${e.pipeline} run`, output: e.text, status: 'done' }); break;
      case 'run.resume': push({ kind: 'run', ts: e.ts, agent: 'main', title: 'Run resumed', status: 'done' }); break;
      case 'run.finish': push({ kind: 'run', ts: e.ts, agent: 'main', title: `Finished: ${e.status}`, output: e.text, status: e.status === 'done' ? 'done' : e.status === 'cancelled' ? 'stopped' : 'error' }); break;
      default: break;
    }
  }
  // A turn ending closes anything the hooks never saw finish (for example an interrupted tool).
  const lastIdle = [...items].reverse().find((i) => i.kind === 'idle');
  for (const it of open.values()) if (lastIdle && lastIdle.seq > it.seq) { it.status = 'stopped'; it.endTs = lastIdle.ts; it.durationMs = Date.parse(lastIdle.ts) - Date.parse(it.ts); }
  return items;
}

function summarizeRun(id) {
  const run = readJson(path.join(RUNS, id, 'run.json'));
  if (!run) return null;
  const events = readEvents(id);
  const items = buildItems(run, events);
  const last = events[events.length - 1];
  // A finished run has nothing running: close leftovers (a tool whose end was never logged, an open stage).
  if (['done', 'failed', 'cancelled'].includes(run.status)) {
    const endTs = run.finished || last?.ts;
    for (const it of items) if (it.status === 'running' || it.status === 'waiting') { it.status = 'stopped'; it.endTs = endTs; it.durationMs = Date.parse(endTs) - Date.parse(it.ts); }
    run.stages = (run.stages || []).map((s) => (s.status === 'running' ? { ...s, status: run.status === 'done' ? 'done' : 'failed' } : s));
  }
  const running = items.filter((i) => i.status === 'running');
  // Real tokens and durations come from tokens.json (written from Claude Code's transcripts by the hook).
  const usage = readJson(path.join(RUNS, id, 'tokens.json'), null);
  if (usage?.agents?.length) {
    const byName = {};
    for (const a of usage.agents) (byName[a.name] ||= []).push(a);
    const used = {};
    for (const it of items.filter((i) => i.kind === 'agent')) {
      const list = byName[it.agent] || [];
      const a = list[used[it.agent] = (used[it.agent] || 0)];
      used[it.agent]++;
      if (!a) continue;
      it.tokens = a.total; it.tokensIn = a.input + a.cacheWrite + a.cacheRead; it.tokensOut = a.output;
      if (a.end && it.status !== 'running') { it.endTs = a.end; it.durationMs = Date.parse(a.end) - Date.parse(it.ts); }
    }
  }
  const agentTokens = items.filter((i) => i.kind === 'agent').reduce((s, i) => s + (i.tokens || 0), 0);
  const end = run.finished ? Date.parse(run.finished) : Date.parse(last?.ts || run.updated);
  let status = run.status;
  if (status === 'running' && !running.length && last && Date.now() - Date.parse(last.ts) > 10 * 60e3) status = 'idle';
  return {
    usage,
    run: { ...run, status, durationMs: end - Date.parse(run.created), agentTokens, tokens: usage?.total?.total ?? null, lastTs: last?.ts || run.updated, errors: items.filter((i) => i.status === 'error').length, eventCount: items.length },
    items, running,
  };
}

function listFiles(id) {
  const dir = path.join(RUNS, id);
  try {
    return fs.readdirSync(dir).filter((f) => !['run.json', 'events.jsonl', 'state.json', 'baseline.json', 'tokens.json', 'changes.json'].includes(f) && !f.endsWith('.tmp'))
      .map((f) => { const st = fs.statSync(path.join(dir, f)); return { name: f, size: st.size, mtime: st.mtime.toISOString(), dir: st.isDirectory() }; })
      .filter((f) => !f.dir).sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

function signature() {
  try {
    return fs.readdirSync(RUNS).map((id) => {
      let s = id;
      for (const f of ['run.json', 'events.jsonl']) { try { const st = fs.statSync(path.join(RUNS, id, f)); s += ':' + st.mtimeMs + ':' + st.size; } catch { /* missing */ } }
      return s;
    }).join('|') + (() => { try { return '|attn:' + fs.statSync(path.join(ROOT, '.pipeline', 'attention.json')).mtimeMs; } catch { return ''; } })();
  } catch { return ''; }
}

// ---------- Clean up: delete finished runs older than keepRunsDays (default 30) ----------
function cleanup() {
  const days = Number(readJson(path.join(ROOT, '.pipeline', 'config.json'), {}).keepRunsDays ?? 30);
  if (!days || !fs.existsSync(RUNS)) return;
  const cutoff = Date.now() - days * 86400e3;
  for (const id of fs.readdirSync(RUNS)) {
    const run = readJson(path.join(RUNS, id, 'run.json'));
    if (!run) continue;
    const last = Date.parse(run.finished || run.updated || run.created);
    const active = ['running', 'waiting'].includes(run.status) && Date.now() - Date.parse(run.updated) < 7 * 86400e3;
    if (active || last > cutoff) continue;
    try {
      fs.rmSync(path.join(RUNS, id), { recursive: true, force: true });
      fs.rmSync(path.join(ROOT, 'art', 'generated', id), { recursive: true, force: true });
      console.log(`Removed run older than ${days} days: ${id}`);
    } catch { /* in use; try next time */ }
  }
}
cleanup();
setInterval(cleanup, 6 * 3600e3);

// ---------- Restart itself when its own code is updated (so new dashboard features appear without manual restarts) ----------
const SELF = fileURLToPath(import.meta.url);
const selfStamp = () => { try { return fs.statSync(SELF).mtimeMs; } catch { return 0; } };
const startedStamp = selfStamp();
setInterval(() => {
  if (selfStamp() === startedStamp) return;
  console.log('Dashboard code changed; restarting…');
  for (const res of clients) res.write('data: restart\n\n');
  const args = [SELF, ...argv.filter((a) => a !== '--open')];
  server.close();
  setTimeout(() => {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '"Agent Pipeline dashboard (close to stop)"', '/min', process.execPath, ...args], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } else {
      spawn(process.execPath, args, { cwd: ROOT, detached: true, stdio: 'ignore' }).unref();
    }
    process.exit(0);
  }, 500);
}, 3000);

const clients = new Set();
let lastSig = signature();
setInterval(() => {
  const sig = signature();
  if (sig !== lastSig) { lastSig = sig; for (const res of clients) res.write(`data: changed\n\n`); }
}, 800);
setInterval(() => { for (const res of clients) res.write(`: ping\n\n`); }, 20000);

// Higgsfield credit balance, read through the CLI. Cached for 2 minutes; ?refresh=1 forces a new read.
const HF_SCRIPT = path.join(ROOT, '.pipeline', 'tools', 'gen-image-higgsfield.mjs');
let hfCache = { at: 0, value: null, pending: null };
function higgsfieldBalance(force) {
  if (!fs.existsSync(HF_SCRIPT)) return Promise.resolve({ available: false });
  if (!force && hfCache.value && Date.now() - hfCache.at < 120000) return Promise.resolve(hfCache.value);
  if (hfCache.pending) return hfCache.pending;
  hfCache.pending = new Promise((resolve) => {
    let out = '';
    const child = spawn(process.execPath, [HF_SCRIPT, '--balance'], { cwd: ROOT, windowsHide: true });
    const timer = setTimeout(() => child.kill(), 20000);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', () => {
      clearTimeout(timer);
      let v;
      try { v = JSON.parse(out.trim().split('\n').pop()); } catch { v = { error: out.trim().slice(0, 300) || 'No output' }; }
      if (/not found|not recognized/i.test(v.error || '')) v = { available: false };
      const value = { available: v.available !== false, credits: v.credits ?? null, error: v.error || null, checked: new Date().toISOString() };
      hfCache = { at: Date.now(), value, pending: null };
      resolve(value);
    });
    child.on('error', () => { hfCache = { at: Date.now(), value: { available: false }, pending: null }; resolve(hfCache.value); });
  });
  return hfCache.pending;
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};
// ---------- Helpers for actions the page can ask for (local machine only) ----------
const ATTENTION = path.join(ROOT, '.pipeline', 'attention.json');
function attention() {
  const data = readJson(ATTENTION, { sessions: {} });
  const cutoff = Date.now() - 6 * 3600e3;
  return Object.entries(data.sessions || {})
    .filter(([, v]) => Date.parse(v.ts) > cutoff)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.ts.localeCompare(a.ts));
}

/** Only accept actions from this dashboard page itself, sent as JSON (blocks other websites). */
function allowedAction(req) {
  const origin = req.headers.origin || '';
  const okOrigin = !origin || origin === `http://localhost:${PORT}` || origin === `http://127.0.0.1:${PORT}`;
  return req.method === 'POST' && okOrigin && String(req.headers['content-type'] || '').includes('application/json');
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}
function openFolder(dir) {
  const [cmd, args] = process.platform === 'win32' ? ['explorer.exe', [dir]] : process.platform === 'darwin' ? ['open', [dir]] : ['xdg-open', [dir]];
  spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false }).on('error', () => {}).unref();
}
/** Bring a window to the front by process id (Windows). */
function focusWindow(pid) {
  if (process.platform !== 'win32') return Promise.resolve(false);
  const ps = `$h=(Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue).MainWindowHandle; if(-not $h){exit 1}; Add-Type -Namespace W -Name U -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(System.IntPtr h,int n); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(System.IntPtr h); [DllImport(\"user32.dll\")] public static extern bool IsIconic(System.IntPtr h);'; if([W.U]::IsIconic($h)){[W.U]::ShowWindowAsync($h,9)|Out-Null}; $ws=New-Object -ComObject WScript.Shell; $ws.SendKeys('%'); [W.U]::SetForegroundWindow($h)|Out-Null; $ws.AppActivate(${Number(pid)})|Out-Null`;
  return new Promise((resolve) => {
    const c = spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { windowsHide: true });
    c.on('close', (code) => resolve(code === 0));
    c.on('error', () => resolve(false));
  });
}
/** The commit message from the newest review file of a run. */
function commitMessage(id) {
  // Newest review first (fix-loop reviews come after the first one); accept a heading or an inline "Suggested commit message: ..." line.
  const files = listFiles(id).filter((f) => /^04-review.*\.md$/.test(f.name)).sort((a, b) => b.mtime.localeCompare(a.mtime));
  for (const f of files) {
    const text = fs.readFileSync(path.join(RUNS, id, f.name), 'utf8');
    const m = text.match(/#+\s*Suggested commit message\s*\n+([\s\S]*?)(?:\n#+\s|$)/i) || text.match(/Suggested commit message\s*[:\-]\s*(.+)/i);
    if (m) return m[1].replace(/^```\w*\n?|```\s*$/gm, '').replace(/^`|`$/g, '').trim();
  }
  return null;
}
/** Art folders for a run: staging, and the imported folder taken from catalog rows of this run. */
function artFolders(id) {
  const out = {};
  const staging = path.join(ROOT, 'art', 'generated', id);
  if (fs.existsSync(staging)) out.staging = staging;
  try {
    const rows = fs.readFileSync(path.join(ROOT, 'art', 'catalog.md'), 'utf8').split('\n').filter((l) => l.includes(id));
    const m = rows.map((l) => l.match(/`([^`]+)`/)).find(Boolean);
    if (m) { const dir = path.join(ROOT, path.dirname(m[1])); if (fs.existsSync(dir)) out.imported = dir; }
  } catch { /* no catalog */ }
  return out;
}

/**
 * End the commands a run's Claude Code session is running right now (Windows): its shell children
 * (bash, cmd, PowerShell) started since the oldest running tool call, with everything under them,
 * such as a Unity CLI call or a test run. MCP servers and Claude Code itself are left alone.
 */
function killRunningCommands(claudePid, sinceMs) {
  if (process.platform !== 'win32' || !claudePid || !sinceMs) return Promise.resolve([]);
  const ps = `$since=[DateTimeOffset]::FromUnixTimeMilliseconds(${Math.floor(sinceMs)}).LocalDateTime; Get-CimInstance Win32_Process -Filter "ParentProcessId=${Number(claudePid)}" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^(bash|sh|cmd|powershell|pwsh)\\.exe$' -and $_.CreationDate -ge $since } | ForEach-Object { taskkill /PID $_.ProcessId /T /F | Out-Null; Write-Output "$($_.ProcessId) $($_.Name)" }`;
  return new Promise((resolve) => {
    let out = '';
    const c = spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { windowsHide: true });
    const timer = setTimeout(() => c.kill(), 15000);
    c.stdout.on('data', (d) => { out += d; });
    c.on('close', () => { clearTimeout(timer); resolve(out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)); });
    c.on('error', () => { clearTimeout(timer); resolve([]); });
  });
}

/** Stop a running or waiting run: mark it cancelled, end its running commands, and let the hook wind the session down. */
async function stopRun(id) {
  const file = path.join(RUNS, id, 'run.json');
  const run = readJson(file);
  if (['done', 'failed', 'cancelled'].includes(run.status)) return { code: 409, body: { error: `This run is already ${run.status}.` } };
  const now = new Date().toISOString();
  const tools = summarizeRun(id).running.filter((i) => i.kind === 'tool');
  const since = tools.length ? Math.min(...tools.map((i) => Date.parse(i.ts))) - 5000 : null;
  const save = (data) => { fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2)); fs.renameSync(file + '.tmp', file); };
  const ev = (e) => fs.appendFileSync(path.join(RUNS, id, 'events.jsonl'), JSON.stringify({ ts: new Date().toISOString(), ...e }) + '\n');
  // Mark it stopped first, so the hook denies the session's next tool call even while the commands are being ended.
  const stages = (run.stages || []).map((s) => (s.status === 'running' ? { ...s, status: 'failed' } : s));
  save({ ...run, status: 'cancelled', stages, waitingOn: null, summary: 'You pressed Stop in the dashboard', finished: now, updated: now, stop: { requested: now, handled: null } });
  ev({ type: 'run.finish', status: 'cancelled', text: 'You pressed Stop in the dashboard' });
  const active = path.join(ROOT, '.pipeline', 'active-run');
  try { if (fs.readFileSync(active, 'utf8').trim() === id) fs.rmSync(active, { force: true }); } catch { /* no active run */ }
  const killed = await killRunningCommands(run.claudePid, since);
  if (killed.length) {
    const cur = readJson(file, {});
    save({ ...cur, stop: { ...cur.stop, killed } });
    ev({ type: 'note', agent: 'you', text: `Ended ${killed.length} running command${killed.length > 1 ? 's' : ''} (${killed.join(', ')})` });
  }
  return { code: 200, body: { ok: true, killed: killed.length, live: Object.values(readJson(path.join(ROOT, '.pipeline', 'sessions.json'), {})).includes(id) } };
}

const validId = (id) => /^[\w.-]+$/.test(id) && fs.existsSync(path.join(RUNS, id, 'run.json'));

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (url.pathname === '/' || url.pathname === '/index.html') return send(res, 200, fs.readFileSync(path.join(here, 'index.html'), 'utf8'), 'text/html');
    if (url.pathname === '/api/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write('retry: 2000\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url.pathname === '/api/pipelines') return send(res, 200, readJson(PIPELINES, {}));
    if (url.pathname === '/api/variants') {
      const cfg = readJson(path.join(ROOT, '.pipeline', 'config.json'), {});
      const file = path.join(ROOT, cfg.variantsFile || 'Docs/Variants.json');
      const reg = readJson(file, { games: {} });
      // Attach run titles so the page can show and link the runs that built each variant.
      const title = (id) => readJson(path.join(RUNS, id, 'run.json'), null)?.title || null;
      for (const g of Object.values(reg.games || {})) for (const sl of Object.values(g.slots || {})) for (const v of sl.variants || []) {
        v.runInfo = (v.runs || []).map((id) => ({ id, title: title(id) }));
        for (const o of v.options || []) o.runInfo = (o.runs || []).map((id) => ({ id, title: title(id) }));
      }
      return send(res, 200, { file: path.relative(ROOT, file), activeGame: cfg.activeGame || null, ...reg });
    }
    if (url.pathname === '/api/attention') return send(res, 200, { sessions: attention(), canFocus: process.platform === 'win32' });
    if (url.pathname === '/api/feedback') {
      const ids = fs.existsSync(RUNS) ? fs.readdirSync(RUNS).filter((i) => fs.existsSync(path.join(RUNS, i, 'process-feedback.md'))).sort().reverse() : [];
      return send(res, 200, { items: ids.map((i) => ({ run: i, title: readJson(path.join(RUNS, i, 'run.json'), {}).title || i, type: readJson(path.join(RUNS, i, 'run.json'), {}).type, text: fs.readFileSync(path.join(RUNS, i, 'process-feedback.md'), 'utf8') })) });
    }
    if (url.pathname === '/api/stop') {
      if (!allowedAction(req)) return send(res, 403, { error: 'not allowed' });
      readBody(req).then(async (body) => {
        const id = String(body.run || '');
        if (!validId(id)) return send(res, 404, { error: 'run not found' });
        const { code, body: out } = await stopRun(id);
        send(res, code, out);
      }).catch((err) => send(res, 500, { error: String(err.message || err) }));
      return;
    }
    if (url.pathname === '/api/focus' || url.pathname === '/api/open') {
      if (!allowedAction(req)) return send(res, 403, { error: 'not allowed' });
      readBody(req).then(async (body) => {
        if (url.pathname === '/api/focus') {
          const s = attention().find((a) => a.id === body.session);
          if (!s) return send(res, 404, { error: 'That request is no longer pending.' });
          if (!s.host?.pid) return send(res, 409, { error: 'Could not find the Claude Code window for this session. Check your open terminals or the Claude app.' });
          const ok = await focusWindow(s.host.pid);
          return send(res, ok ? 200 : 409, ok ? { ok: true, app: s.host.app } : { error: `Could not bring ${s.host.app || 'the window'} to the front. Look for it in the taskbar (it may be flashing).` });
        }
        const id = String(body.run || '');
        if (!validId(id)) return send(res, 404, { error: 'run not found' });
        const folders = { run: path.join(RUNS, id), ...artFolders(id) };
        const dir = folders[body.target];
        if (!dir) return send(res, 404, { error: body.target === 'staging' ? 'Nothing generated yet for this run.' : body.target === 'imported' ? 'Nothing imported yet for this run.' : 'Unknown folder' });
        openFolder(dir);
        return send(res, 200, { ok: true, path: dir });
      });
      return;
    }
    if (url.pathname === '/api/higgsfield') { higgsfieldBalance(url.searchParams.has('refresh')).then((v) => send(res, 200, v)); return; }
    if (url.pathname === '/api/runs') {
      const ids = fs.existsSync(RUNS) ? fs.readdirSync(RUNS).filter((id) => fs.existsSync(path.join(RUNS, id, 'run.json'))) : [];
      const runs = ids.map((id) => { const s = summarizeRun(id); return s && { ...s.run, stalled: stallInfo(s.run), now: s.running.map((r) => ({ agent: r.agent, title: r.title, kind: r.kind })) }; })
        .filter(Boolean).sort((a, b) => b.created.localeCompare(a.created));
      return send(res, 200, { root: ROOT, runs });
    }
    if (parts[0] === 'api' && parts[1] === 'runs' && parts[2]) {
      const id = decodeURIComponent(parts[2]);
      if (!validId(id)) return send(res, 404, { error: 'run not found' });
      if (parts[3] === 'file') {
        const name = path.basename(url.searchParams.get('name') || '');
        const file = path.join(RUNS, id, name);
        if (!name || !fs.existsSync(file)) return send(res, 404, { error: 'file not found' });
        const ext = path.extname(name).toLowerCase();
        const img = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' }[ext];
        if (img) { res.writeHead(200, { 'Content-Type': img, 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" }); return fs.createReadStream(file).pipe(res); }
        return send(res, 200, fs.readFileSync(file, 'utf8').slice(0, 500000), 'text/plain');
      }
      const s = summarizeRun(id);
      const run = s.run;
      run.stalled = stallInfo(run);
      const code = ['feature', 'quick'].includes(run.type);
      const changes = code ? readJson(path.join(RUNS, id, 'changes.json'), null) : null;
      const kids = fs.readdirSync(RUNS).map((k) => readJson(path.join(RUNS, k, 'run.json'))).filter((r) => r && r.root && r.root === (run.root || run.id)).sort((a, b) => a.created.localeCompare(b.created)).map((r) => ({ id: r.id, iteration: r.iteration || 1, status: r.status }));
      return send(res, 200, { ...s, files: listFiles(id), commitMessage: code ? commitMessage(id) : null, changes, iterations: kids.length > 1 ? kids : null, art: run.type === 'art' ? Object.keys(artFolders(id)) : null });
    }
    send(res, 404, { error: 'not found' });
  } catch (err) {
    send(res, 500, { error: String(err.message || err) });
  }
});

const URL_HOME = `http://localhost:${PORT}`;
function openBrowser() {
  if (!argv.includes('--open')) return;
  try {
    const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', URL_HOME]]
      : process.platform === 'darwin' ? ['open', [URL_HOME]] : ['xdg-open', [URL_HOME]];
    spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).on('error', () => {}).unref();
  } catch { /* no browser available */ }
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Dashboard already running at ${URL_HOME}`);
    openBrowser();
    setTimeout(() => process.exit(0), 500);
  } else {
    console.error(err);
    process.exit(1);
  }
});
server.listen(PORT, HOST, () => {
  console.log(`Pipeline dashboard: ${URL_HOME}`);
  console.log(`Reading runs from: ${RUNS}`);
  openBrowser();
});
