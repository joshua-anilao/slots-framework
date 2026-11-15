#!/usr/bin/env node
// Claude Code hook: logs tool calls, subagent launches and your prompts into the active run.
// Registered in .claude/settings.json for PreToolUse, PostToolUse, UserPromptSubmit and Stop.
// It never blocks Claude, with two exceptions: after you press Stop on a run in the dashboard, it denies that
// session's tool calls (exit 2) so the conductor and its agents wind down; and on Stop it refuses to let the
// conductor end its turn while the run is between stages (see idleRunReason). Every error is swallowed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { activeRunId as latestRunId, appendEvent, runDir, readJson, writeJson, clip, pipelineDir } from './lib.mjs';
import { updateUsage } from './usage.mjs';

/**
 * Why the conductor must not end its turn yet, or null. A run that is still "running" with no stage running and a stage
 * still to start (or every stage done but the run not finished) is stalled: the next agent has to be launched now.
 * Runs waiting on a gate, stopped from the dashboard or already finished are left alone.
 */
function idleRunReason(run) {
  if (!run || run.status !== 'running' || run.stop) return null;
  const stages = run.stages || [];
  if (!stages.length || stages.some((s) => s.status === 'running')) return null;
  const next = stages.find((s) => s.status === 'pending');
  const done = stages.filter((s) => s.status === 'done');
  const flow = `Pipeline run ${run.id} is between stages: ${done.length ? done[done.length - 1].name : 'nothing'} finished and no stage is running.`;
  if (next) return `${flow} Log it (P stage --run ${run.id} --name ${done.length ? done[done.length - 1].name : next.name} --status done), launch the ${next.name} agent now, and tell Josh in one line. If you are deliberately waiting for Josh, open a gate with P gate instead.`;
  return `${flow} All stages are done: finish the run (P finish --run ${run.id} --status done|failed) and give the final message.`;
}

// Each Claude Code window (session) logs to the run it started, so two windows can run pipelines side by side.
const SESSIONS = () => path.join(pipelineDir(), 'sessions.json');
let currentSession = null;
function activeRunId() {
  const map = readJson(SESSIONS(), {});
  const id = currentSession && map[currentSession];
  const run = id && readJson(path.join(runDir(id), 'run.json'));
  if (run && !['done', 'failed', 'cancelled'].includes(run.status)) return id;
  return latestRunId();
}
function rememberSessionRun(session, runId) {
  const map = readJson(SESSIONS(), {});
  map[session] = runId;
  writeJson(SESSIONS(), map);
}

/**
 * The Claude Code process running this session (the hook's nearest ancestor named claude or node), so the
 * dashboard's Stop button can end the commands it started. Looked up once, when a run starts or resumes.
 */
function findClaudePid() {
  if (process.platform === 'win32') {
    const script = `$p=${process.ppid}; for($i=0;$i -lt 8 -and $p;$i++){ $pr=Get-CimInstance Win32_Process -Filter "ProcessId=$p" -ErrorAction SilentlyContinue; if(-not $pr){exit}; if($pr.Name -match '^(claude|node)\\.exe$'){ Write-Output $pr.ProcessId; exit }; $p=$pr.ParentProcessId }`;
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8', timeout: 6000, windowsHide: true });
    const pid = Number(String(r.stdout || '').trim());
    return pid || null;
  }
  let pid = process.ppid;
  for (let i = 0; i < 8 && pid > 1; i++) {
    const r = spawnSync('ps', ['-o', 'ppid=,comm=', '-p', String(pid)], { encoding: 'utf8', timeout: 3000 });
    const m = String(r.stdout || '').trim().match(/^(\d+)\s+(.*)$/);
    if (!m) return null;
    if (/(^|\/)(claude|node)$/.test(m[2])) return pid;
    pid = Number(m[1]);
  }
  return null;
}

/** The run you stopped from the dashboard, if this session still has to wind it down. */
function stoppedRun(input) {
  const map = readJson(SESSIONS(), {});
  const ids = [currentSession && map[currentSession]];
  // A pipeline.mjs call that names a stopped run is blocked too, even from a window that never started it.
  const named = String(input.tool_input?.command || '').match(/pipeline\.mjs[^\n]*--run\s+["']?([\w.-]+)/);
  if (named) ids.push(named[1]);
  for (const id of ids.filter(Boolean)) {
    const run = readJson(path.join(runDir(id), 'run.json'));
    if (!run?.stop) continue;
    // The main session is released once it has ended its turn; agents stay blocked for 30 minutes,
    // since a background agent can outlive the turn that launched it.
    const isAgent = Boolean(input.agent_id || input.agent_type);
    const recent = Date.now() - Date.parse(run.stop.requested) < 30 * 60e3;
    if (isAgent ? recent : !run.stop.handled) return run;
  }
  return null;
}
function markStopHandled(run) {
  const file = path.join(runDir(run.id), 'run.json');
  const cur = readJson(file);
  if (cur?.stop && !cur.stop.handled) writeJson(file, { ...cur, stop: { ...cur.stop, handled: new Date().toISOString() } });
}
const STOP_REASON = (run) => `STOPPED: Josh pressed Stop on pipeline run ${run.id} ("${run.title}") in the dashboard. Do not run any more tools or agents for this run, do not resume or finish it, and do not retry. End your turn now with one line saying the run was stopped and what, if anything, was left half-done.`;

const AGENT_TOOLS = new Set(['Task', 'Agent']);

function summarize(tool, input = {}) {
  const rel = (p) => (p ? String(p).replace(/\\/g, '/').replace(/^.*?(Assets|Packages|docs|\.pipeline|\.claude|art|research)[\\/]/i, '$1/') : '');
  switch (tool) {
    case 'Read': return `Read ${rel(input.file_path)}`;
    case 'Write': return `Write ${rel(input.file_path)}`;
    case 'Edit': case 'MultiEdit': return `Edit ${rel(input.file_path)}`;
    case 'Bash': return input.description || String(input.command || '').slice(0, 120);
    case 'Grep': return `Search "${input.pattern}"`;
    case 'Glob': return `Find ${input.pattern}`;
    case 'WebSearch': return `Web search "${input.query}"`;
    case 'WebFetch': return `Fetch ${input.url}`;
    case 'Task': case 'Agent': return `${input.subagent_type || 'agent'}: ${input.description || ''}`;
    default: return tool;
  }
}

function isError(res) {
  if (!res || typeof res !== 'object') return false;
  if (res.is_error || res.isError || res.error || res.success === false || res.interrupted) return true;
  const code = res.exitCode ?? res.exit_code ?? res.returnCode;
  return typeof code === 'number' && code !== 0;
}

function numbers(res) {
  if (!res || typeof res !== 'object') return {};
  const u = res.usage || {};
  const out = {};
  const tokens = res.totalTokens ?? u.total_tokens ?? ((u.input_tokens || 0) + (u.output_tokens || 0) || undefined);
  if (tokens) out.tokens = tokens;
  if (u.input_tokens) out.tokensIn = u.input_tokens + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  if (u.output_tokens) out.tokensOut = u.output_tokens;
  if (res.totalDurationMs) out.durationMs = res.totalDurationMs;
  if (res.totalToolUseCount) out.toolUses = res.totalToolUseCount;
  return out;
}

function agentText(res) {
  if (!res) return '';
  if (typeof res === 'string') return res;
  if (Array.isArray(res.content)) return res.content.map((c) => c.text || '').join('\n');
  return res.result || res.output || res.text || JSON.stringify(res, null, 2);
}

/**
 * Windows: find the window that hosts this Claude Code session (terminal, VS Code, Claude app)
 * by walking up parent processes until one owns a visible window. Cached per session.
 */
function findHostWindowPid() {
  if (process.platform !== 'win32') return null;
  const script = `$p=${process.ppid}; for($i=0;$i -lt 15 -and $p;$i++){ $pr=Get-Process -Id $p -ErrorAction SilentlyContinue; if($pr -and $pr.MainWindowHandle -ne 0){ Write-Output "$($pr.Id)|$($pr.ProcessName)"; exit }; $p=(Get-CimInstance Win32_Process -Filter "ProcessId=$p" -ErrorAction SilentlyContinue).ParentProcessId }`;
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8', timeout: 6000, windowsHide: true });
  const m = String(r.stdout || '').trim().match(/^(\d+)\|(.*)$/m);
  return m ? { pid: Number(m[1]), app: m[2] } : null;
}

/** Sessions waiting on the person (permission prompts, questions). Kept outside runs so it works for any chat. */
function updateAttention(input, waiting) {
  const file = path.join(pipelineDir(), 'attention.json');
  const data = readJson(file, { sessions: {} });
  const sid = input.session_id || 'unknown';
  const prev = data.sessions[sid];
  if (!waiting) {
    if (!prev) return;
    delete data.sessions[sid];
  } else {
    const host = prev?.host || findHostWindowPid();
    data.sessions[sid] = { ...waiting, ts: new Date().toISOString(), cwd: input.cwd || null, run: activeRunId(), host };
  }
  writeJson(file, data);
}

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  const ev = input.hook_event_name;
  currentSession = input.session_id || null;

  // A pipeline run was started or resumed from this window: remember it for this session.
  if (ev === 'PostToolUse' && input.tool_name === 'Bash' && currentSession) {
    const out = typeof input.tool_response === 'string' ? input.tool_response : `${input.tool_response?.stdout || ''}`;
    const m = out.match(/RUN_DIR=\.pipeline\/runs\/([\w.-]+)/) || out.match(/RUN_ID=([\w.-]+)/);
    if (m && /pipeline\.mjs\s+(start|resume)/.test(String(input.tool_input?.command || ''))) {
      rememberSessionRun(currentSession, m[1]);
      const file = path.join(runDir(m[1]), 'run.json');
      const run = readJson(file);
      if (run) writeJson(file, { ...run, session: currentSession, claudePid: findClaudePid() });
    }
  }

  // Stop pressed in the dashboard: deny tool calls, and tell Claude why, until the session has wound down.
  const stopped = ev === 'PreToolUse' || ev === 'UserPromptSubmit' || ev === 'Stop' ? stoppedRun(input) : null;
  if (stopped && ev === 'PreToolUse') {
    appendEvent(stopped.id, { type: 'note', agent: input.agent_type || 'main', text: `Blocked ${input.tool_name}: the run was stopped` });
    process.stderr.write(STOP_REASON(stopped));
    process.exit(2);
  }
  if (stopped && ev === 'Stop') markStopHandled(stopped);
  if (stopped && ev === 'UserPromptSubmit') {
    // You stopped the run while Claude was waiting on you (for example at a gate): say so before it reads your reply.
    markStopHandled(stopped);
    process.stdout.write(`Note: pipeline run ${stopped.id} ("${stopped.title}") was stopped from the dashboard. Do not continue or resume it unless the person asks for that in this message.\n`);
  }
  // Token usage: refresh when a turn ends or a background agent reports back.
  if (ev === 'Stop' || (ev === 'UserPromptSubmit' && /agent-message|Subagent hand-back/i.test(String(input.prompt || '')))) {
    try { updateUsage(input.transcript_path); } catch { /* best effort */ }
  }

  // Anything the person needs to answer: a permission prompt or idle wait (Notification), or a question (AskUserQuestion).
  if (ev === 'Notification') {
    const msg = String(input.message || 'Claude Code needs your attention');
    const kind = input.notification_type || (/permission/i.test(msg) ? 'permission' : /waiting|input|idle/i.test(msg) ? 'idle' : 'notice');
    updateAttention(input, { kind, message: msg });
    const rid = activeRunId();
    if (rid) appendEvent(rid, { type: 'attention', kind, text: msg });
    process.exit(0);
  }
  if (ev === 'PreToolUse' && input.tool_name === 'AskUserQuestion') {
    const q = input.tool_input?.questions?.[0]?.question || 'Claude is asking you a question';
    updateAttention(input, { kind: 'question', message: q });
  } else if (ev === 'PostToolUse' || ev === 'UserPromptSubmit' || ev === 'Stop' || (ev === 'PreToolUse' && input.tool_name !== 'AskUserQuestion')) {
    updateAttention(input, null); // the session moved on, so nothing is pending any more
  }

  const id = activeRunId();
  if (!id) process.exit(0);

  const stateFile = path.join(runDir(id), 'state.json');
  const state = readJson(stateFile, { agentStack: [] });
  const event = input.hook_event_name;
  const tool = input.tool_name;
  const toolInput = input.tool_input || {};
  const callId = input.tool_use_id || crypto.createHash('sha1').update(tool + JSON.stringify(toolInput)).digest('hex').slice(0, 16);
  // Newer Claude Code versions say which subagent made the call; otherwise use the agent that is running.
  const agent = input.agent_type || state.agentStack[state.agentStack.length - 1] || 'main';

  if (event === 'PreToolUse' && tool) {
    if (AGENT_TOOLS.has(tool)) {
      const name = toolInput.subagent_type || 'general-purpose';
      state.agentStack.push(name);
      state.calls = { ...(state.calls || {}), [callId]: name };
      appendEvent(id, { type: 'agent.start', id: callId, agent: name, text: summarize(tool, toolInput), detail: clip(toolInput.prompt, 8000) });
    } else {
      appendEvent(id, { type: 'tool.start', id: callId, agent, tool, text: summarize(tool, toolInput), detail: clip(toolInput, 3000) });
    }
  } else if (event === 'PostToolUse' && tool) {
    const res = input.tool_response;
    if (AGENT_TOOLS.has(tool)) {
      const name = state.calls?.[callId] || toolInput.subagent_type || 'general-purpose';
      const idx = state.agentStack.lastIndexOf(name);
      if (idx >= 0) state.agentStack.splice(idx, 1);
      appendEvent(id, { type: 'agent.end', id: callId, agent: name, error: isError(res), ...numbers(res), detail: clip(agentText(res), 12000) });
    } else {
      appendEvent(id, { type: 'tool.end', id: callId, agent, tool, error: isError(res), detail: clip(res, 3000) });
    }
  } else if (event === 'UserPromptSubmit') {
    appendEvent(id, { type: 'user', text: clip(input.prompt, 2000) });
  } else if (event === 'Stop') {
    state.agentStack = [];
    appendEvent(id, { type: 'idle', text: 'Main session finished its turn' });
    const reason = input.stop_hook_active ? null : idleRunReason(readJson(path.join(runDir(id), 'run.json')));
    if (reason) {
      appendEvent(id, { type: 'note', text: 'Stop blocked: ' + reason });
      writeJson(stateFile, state);
      process.stdout.write(JSON.stringify({ decision: 'block', reason }));
      process.exit(0);
    }
  }
  writeJson(stateFile, state);
} catch { /* never block Claude */ }
process.exit(0);
