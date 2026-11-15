#!/usr/bin/env node
// Pipeline CLI. The main Claude session calls this to start runs and log stages,
// handoffs, approval gates and scores. Hooks log tool calls automatically.
//
//   node .pipeline/tools/pipeline.mjs start   --type feature --title "Mute toggle" --request "..." [--parent <run id>]   (parent = iterate on an earlier run)
//   node .pipeline/tools/pipeline.mjs stage   --name coder --status running|done|failed|skipped
//   node .pipeline/tools/pipeline.mjs handoff --from planner --to coder --file 01-spec.md --summary "..."
//   node .pipeline/tools/pipeline.mjs gate    --question "Generate 3 new sprites?"      (marks run waiting)
//   node .pipeline/tools/pipeline.mjs gate    --resolve approved|rejected --note "..."
//   node .pipeline/tools/pipeline.mjs note    --agent reviewer --text "..."
//   node .pipeline/tools/pipeline.mjs save    --file 04-review.md --from reviewer   (reads content from stdin)
//   node .pipeline/tools/pipeline.mjs diff                                          (writes changes.diff)
//   node .pipeline/tools/pipeline.mjs diff    --since <any run of the feature>      (whole-feature diff for /feature-qa)
//   node .pipeline/tools/pipeline.mjs start   --lane play-first ...                  (stops after the coder; iterations inherit the lane)
//   node .pipeline/tools/pipeline.mjs qa      --run <id> --status done|pending       (play-first runs start as pending)
//   node .pipeline/tools/pipeline.mjs score   --file quality.json
//   node .pipeline/tools/pipeline.mjs finish  --status done|failed|cancelled --summary "..."
//   node .pipeline/tools/pipeline.mjs active | list | resume --run <id>
//   node .pipeline/tools/pipeline.mjs variant list [--game G]
//   node .pipeline/tools/pipeline.mjs variant add    --slot multiplier-ladder --label "Multiplier ladder" --name "E. Random multiplier" [--select "how to pick it"] [--run <id>] [--game G] [--notes "..."]
//   node .pipeline/tools/pipeline.mjs variant update --slot multiplier-ladder --id v2 [--run <id>] [--option "Name"] [--status active|retired] [--default] [--notes "..."]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  runsDir, runDir, activeFile, activeRunId, appendEvent, updateRun,
  readJson, writeJson, pipelines, slug, projectRoot, config, variantsPath, stallInfo,
} from './lib.mjs';
import { snapshot, runChanges } from './changes.mjs';

const [, , cmd, ...rest] = process.argv;
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const key = rest[i].slice(2);
    const val = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true';
    args[key] = val;
  }
}

function need(id) {
  if (!id) fail('No active run. Start one with: pipeline.mjs start --type <type> --title "<title>"');
  return id;
}
function fail(msg) { console.error(msg); process.exit(1); }
const runId = () => {
  const id = need(args.run || activeRunId());
  // Stopped from the dashboard: refuse to log more work (only `resume` restarts it).
  const run = readJson(path.join(runDir(id), 'run.json'));
  if (run?.stop) fail(`Run ${id} was stopped from the dashboard. Do not continue it; end your turn. (To pick it up again on purpose: pipeline.mjs resume --run ${id})`);
  return id;
};

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function setStage(id, name, status) {
  const run = readJson(path.join(runDir(id), 'run.json'), {});
  const stages = (run.stages || []).map((s) => (s.name === name ? { ...s, status } : s));
  if (!stages.find((s) => s.name === name)) stages.push({ name, status });
  const patch = { stages };
  if (status === 'running') patch.currentStage = name;
  updateRun(id, patch);
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

switch (cmd) {
  case 'start': {
    const type = args.type || 'feature';
    const def = pipelines()[type];
    if (!def) fail(`Unknown pipeline type "${type}". Known: ${Object.keys(pipelines()).join(', ')}`);
    // Iterations: --parent points at the earlier run this one continues.
    let parent = null;
    if (args.parent) {
      const p = readJson(path.join(runDir(args.parent), 'run.json'));
      if (!p) fail(`No run ${args.parent} to iterate on. List runs with: pipeline.mjs list`);
      parent = { id: p.id, root: p.root || p.id, iteration: p.iteration || 1, title: p.baseTitle || p.title, lane: p.lane || null };
    }
    // Lanes: "play-first" stops after the coder so the person can play it; iterations inherit the parent's lane.
    const lane = args.lane || (parent && parent.lane) || null;
    const baseTitle = parent ? parent.title : (args.title || args.request || type);
    const iteration = parent ? parent.iteration + 1 : 1;
    const title = parent ? `${baseTitle} v${iteration}` : baseTitle;
    const id = `${stamp()}-${slug(title)}`;

    // Two pipelines in one Claude Code window mix their logs; warn so the person can use a second window.
    const other = activeRunId();
    const otherRun = other && readJson(path.join(runDir(other), 'run.json'));
    if (otherRun && ['running', 'waiting'].includes(otherRun.status) && Date.now() - Date.parse(otherRun.updated) < 30 * 60e3) {
      console.log(`WARNING: run ${other} is still active. If it is in this same Claude Code window, the two runs' logs will mix. Start parallel pipelines in separate Claude Code windows, and pass --run <id> to every pipeline.mjs command.`);
    }

    fs.mkdirSync(runDir(id), { recursive: true });
    const now = new Date().toISOString();
    writeJson(path.join(runDir(id), 'run.json'), {
      id, type, title, baseTitle, request: args.request || '', status: 'running',
      created: now, updated: now, currentStage: def.stages[0].name,
      stages: def.stages.map((s) => ({ name: s.name, label: s.label, status: 'pending' })),
      loops: 0, iteration, parent: parent ? parent.id : null, root: parent ? parent.root : id,
      ...(lane ? { lane } : {}), ...(lane === 'play-first' ? { qa: 'pending' } : {}),
    });
    // Remember what was already uncommitted, so this run's diff and file list contain only its own changes.
    try { const base = snapshot(projectRoot()); if (base) writeJson(path.join(runDir(id), 'baseline.json'), base); } catch { /* not a git repo */ }
    fs.writeFileSync(activeFile(), id);
    appendEvent(id, { type: 'run.start', pipeline: type, title, text: args.request || '' });
    console.log(`RUN_ID=${id}`);
    console.log(`RUN_DIR=.pipeline/runs/${id}`);
    break;
  }
  case 'resume': {
    const id = need(args.run);
    if (!fs.existsSync(runDir(id))) fail(`No run ${id}`);
    fs.writeFileSync(activeFile(), id);
    updateRun(id, { status: 'running', stop: null, finished: null, summary: '' });
    appendEvent(id, { type: 'run.resume' });
    console.log(`RUN_DIR=.pipeline/runs/${id}`);
    break;
  }
  case 'stage': {
    const id = runId();
    const status = args.status || 'running';
    setStage(id, args.name, status);
    if (args.name === 'coder' && status === 'running' && args.loop) updateRun(id, { loops: Number(args.loop) });
    appendEvent(id, { type: 'stage', agent: args.name, status, text: args.note || '' });
    break;
  }
  case 'handoff': {
    const id = runId();
    appendEvent(id, { type: 'handoff', from: args.from, to: args.to, file: args.file, text: args.summary || '' });
    break;
  }
  case 'gate': {
    const id = runId();
    if (args.resolve) {
      updateRun(id, { status: 'running', waitingOn: null });
      appendEvent(id, { type: 'gate.resolve', status: args.resolve, text: args.note || '' });
    } else {
      updateRun(id, { status: 'waiting', waitingOn: args.question || 'Your approval' });
      appendEvent(id, { type: 'gate.open', text: args.question || 'Your approval' });
    }
    break;
  }
  case 'note': {
    appendEvent(runId(), { type: 'note', agent: args.agent || 'main', text: args.text || readStdin() });
    break;
  }
  case 'save': {
    // Read-only agents return text; the main session saves it here so the agent never writes files.
    const id = runId();
    const name = path.basename(args.file || 'output.md');
    const content = args.text || readStdin();
    fs.writeFileSync(path.join(runDir(id), name), content);
    appendEvent(id, { type: 'file', agent: args.from || 'main', file: name, text: `Saved ${name}` });
    console.log(`.pipeline/runs/${id}/${name}`);
    break;
  }
  case 'qa': {
    // Marks whether a play-first run has had its tester + reviewer pass: pipeline.mjs qa --run <id> --status done|pending
    const id = runId();
    const status = args.status || 'done';
    updateRun(id, { qa: status });
    appendEvent(id, { type: 'note', agent: 'main', text: `QA ${status}` });
    break;
  }
  case 'diff': {
    const id = runId();
    let base = readJson(path.join(runDir(id), 'baseline.json'));
    let only = null;
    if (args.since) {
      // Whole-feature diff for /feature-qa: from before the chain's first run, limited to the files the chain (and this run) changed.
      const first = readJson(path.join(runDir(args.since), 'run.json'));
      const rootId = first ? (first.root || first.id) : null;
      const rootBase = rootId && readJson(path.join(runDir(rootId), 'baseline.json'));
      if (!rootBase) fail(`No baseline for ${args.since}. Use the id of a run started after baselines were added.`);
      only = new Set();
      for (const rid of fs.readdirSync(runsDir())) {
        const r = readJson(path.join(runDir(rid), 'run.json'));
        if (!r || (r.root || r.id) !== rootId) continue;
        for (const f of readJson(path.join(runDir(rid), 'changes.json'), { files: [] }).files) only.add(f.path);
      }
      if (base) for (const f of runChanges(projectRoot(), base).files) only.add(f.path);
      base = rootBase;
    }
    if (base) {
      const { files, diff } = runChanges(projectRoot(), base, only);
      fs.writeFileSync(path.join(runDir(id), 'changes.diff'), diff || '(no changes)\n');
      writeJson(path.join(runDir(id), 'changes.json'), { at: new Date().toISOString(), files });
      const n = (st) => files.filter((f) => f.status === st).length;
      appendEvent(id, { type: 'file', agent: 'main', file: 'changes.diff', text: `Saved diff: ${n('added')} added, ${n('modified')} modified, ${n('deleted')} deleted` });
      console.log(`.pipeline/runs/${id}/changes.diff (${files.length} files changed by this run)`);
      break;
    }
    let out = '';
    const sh = (c) => { try { return execSync(c, { cwd: projectRoot(), encoding: 'utf8', maxBuffer: 50e6 }); } catch (e) { return e.stdout || ''; } };
    out += sh('git diff -- . ":(exclude).pipeline"');
    const untracked = sh('git ls-files --others --exclude-standard').split('\n')
      .filter((f) => f && !f.startsWith(".pipeline/") && !f.endsWith('.meta'));
    for (const f of untracked) {
      try {
        const body = fs.readFileSync(path.join(projectRoot(), f), 'utf8');
        if (body.length < 200000) out += `\n--- /dev/null\n+++ b/${f}  (new file)\n` + body.split('\n').map((l) => '+' + l).join('\n') + '\n';
      } catch { /* binary or unreadable */ }
    }
    fs.writeFileSync(path.join(runDir(id), 'changes.diff'), out || '(no changes)\n');
    appendEvent(id, { type: 'file', agent: 'main', file: 'changes.diff', text: `Saved diff (${untracked.length} new files)` });
    console.log(`.pipeline/runs/${id}/changes.diff`);
    break;
  }
  case 'score': {
    const id = runId();
    const file = path.join(runDir(id), path.basename(args.file || 'quality.json'));
    const data = readJson(file);
    if (!data) fail(`Could not read ${file}`);
    updateRun(id, { score: data.overall ?? null });
    appendEvent(id, { type: 'score', agent: 'ux-reviewer', score: data.overall, text: `Quality score ${data.overall}/10` });
    break;
  }
  case 'finish': {
    const id = runId();
    const status = args.status || 'done';
    // Close any stage still marked running so the stepper stops blinking.
    const r0 = readJson(path.join(runDir(id), 'run.json'), {});
    const stages = (r0.stages || []).map((s) => (s.status === 'running' ? { ...s, status: status === 'done' ? 'done' : 'failed' } : s));
    updateRun(id, { status, stages, summary: args.summary || '', finished: new Date().toISOString(), waitingOn: null });
    appendEvent(id, { type: 'run.finish', status, text: args.summary || '' });
    if (activeRunId() === id) fs.rmSync(activeFile(), { force: true });
    break;
  }
  case 'active': {
    const id = activeRunId();
    console.log(id ? `RUN_ID=${id}\nRUN_DIR=.pipeline/runs/${id}` : 'No active run');
    break;
  }
  case 'status': {
    // One line per running run: what is running now, or STALLED when a stage finished and nothing started after it
    const dir = runsDir();
    let shown = 0;
    if (fs.existsSync(dir)) {
      for (const id of fs.readdirSync(dir).sort().reverse()) {
        const r = readJson(path.join(runDir(id), 'run.json'));
        if (!r || r.status !== 'running') continue;
        shown++;
        const running = (r.stages || []).find((s) => s.status === 'running');
        const stall = stallInfo(r);
        if (stall) console.log(`STALLED ${id}: ${stall.after} finished ${stall.minutes} min ago and nothing started${stall.next ? `; launch ${stall.next} now` : ''}`);
        else console.log(`OK ${id}: ${running ? `${running.name} running` : 'between stages'}`);
      }
    }
    if (!shown) console.log('No running runs');
    break;
  }
  case 'list': {
    if (!fs.existsSync(runsDir())) break;
    for (const id of fs.readdirSync(runsDir()).sort().reverse()) {
      const r = readJson(path.join(runDir(id), 'run.json'));
      if (r) console.log(`${r.status.padEnd(9)} ${r.type.padEnd(8)} ${id}  ${r.title}${r.parent ? `  (iterates ${r.parent})` : ''}${r.qa === 'pending' ? '  [QA pending]' : ''}`);
    }
    break;
  }
  case 'variant': {
    // Registry of selectable alternatives: games > slots > variants (v1, v2 …). Options combine on top of a variant.
    const sub = rest[0];
    const file = variantsPath();
    const reg = readJson(file, { games: {} });
    const game = args.game || config().activeGame || Object.keys(reg.games)[0] || 'Game';
    const g = (reg.games[game] ||= { slots: {} });
    const save = () => { reg.updated = new Date().toISOString(); writeJson(file, reg); };
    const linkRun = (runId, slotKey, v) => {
      if (!runId) return;
      const rf = path.join(runDir(runId), 'run.json');
      const r = readJson(rf);
      if (r) writeJson(rf, { ...r, variant: { game, slot: slotKey, slotLabel: g.slots[slotKey].label, id: v.id, name: v.name } });
    };
    if (sub === 'list' || !sub) {
      for (const [gk, gv] of Object.entries(reg.games)) {
        if (args.game && gk !== args.game) continue;
        console.log(`# ${gk}`);
        for (const [sk, sv] of Object.entries(gv.slots)) {
          console.log(`  ${sv.label} (${sk})${sv.select ? ` — select: ${sv.select}` : ''}`);
          for (const v of sv.variants) console.log(`    ${v.id}  ${v.name}${sv.default === v.id ? '  [default]' : ''}${v.status === 'retired' ? '  [retired]' : ''}${v.options?.length ? `  options: ${v.options.map((o) => o.name).join(', ')}` : ''}`);
        }
      }
      break;
    }
    const key = args.slot;
    if (!key) fail('variant needs --slot <key>, e.g. --slot result-ui');
    if (sub === 'add') {
      const slot = (g.slots[key] ||= { label: args.label || key, select: args.select || '', default: null, variants: [] });
      if (args.label) slot.label = args.label;
      if (args.select) slot.select = args.select;
      const n = slot.variants.reduce((m, v) => Math.max(m, Number(String(v.id).replace(/\D/g, '')) || 0), 0) + 1;
      const v = { id: `v${n}`, name: args.name || `Variant ${n}`, status: 'active', added: new Date().toISOString().slice(0, 10), runs: args.run ? [args.run] : [], options: [], notes: args.notes || '' };
      slot.variants.push(v);
      if (!slot.default || args.default) slot.default = v.id;
      save(); linkRun(args.run, key, v);
      console.log(`VARIANT=${game}/${key}/${v.id} (${v.name})`);
      break;
    }
    if (sub === 'update') {
      const slot = g.slots[key];
      const v = slot?.variants.find((x) => x.id === args.id);
      if (!v) fail(`No variant ${args.id} in slot ${key}. See: pipeline.mjs variant list`);
      if (args.name) v.name = args.name;
      if (args.status) v.status = args.status;
      if (args.notes) v.notes = args.notes;
      if (args.default) slot.default = v.id;
      if (args.run && !v.runs.includes(args.run)) v.runs.push(args.run);
      if (args.option) {
        const o = v.options.find((x) => x.name === args.option);
        if (o) { if (args.run && !o.runs.includes(args.run)) o.runs.push(args.run); } else v.options.push({ name: args.option, runs: args.run ? [args.run] : [] });
      }
      save(); linkRun(args.run, key, v);
      console.log(`VARIANT=${game}/${key}/${v.id} updated`);
      break;
    }
    fail('variant commands: list, add, update');
  }
  default:
    console.log('Commands: start, resume, stage, handoff, gate, note, save, diff, qa, score, finish, active, status, list, variant');
}
