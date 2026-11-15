/**
 * Appends one entry to a game's art log: what was asked, with which prompt and model, what was decided and why,
 * plus small thumbnails of the images that were picked or rejected.
 *
 *   npm run art:log -- games/game-001 --asset sym_H2 --decision "Picked candidate 2" --why "One stick, best glaze"
 *       [--pick <image> ...] [--reject <image> ...] [--sidecar <generated .json> ...] [--cost "$0.16"] [--by "Josh"]
 *
 * Writes to games/<id>/theme/art-log/LOG.md (newest entry at the bottom) and thumbnails (384 px PNG) into
 * games/<id>/theme/art-log/images/. A sidecar is the .json that `npm run art:gen` saves next to each image; it
 * supplies the model, seed and exact prompt. Nothing here reads or prints FAL_KEY.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const THUMB = 384;

export interface LogEntry {
  when: Date;
  asset: string;
  decision?: string;
  why?: string;
  cost?: string;
  by?: string;
  runs: { model?: string; seed?: unknown; prompt?: string; file?: string }[];
  picked: string[]; // thumbnail paths relative to LOG.md
  rejected: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');
export const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Pure formatting, so it can be tested without files. */
export function formatEntry(e: LogEntry): string {
  const out: string[] = [`\n## ${stamp(e.when)} · ${e.asset}`];
  if (e.decision) out.push(`**Decision${e.by ? ` (${e.by})` : ''}:** ${e.decision}`);
  if (e.why) out.push(`**Why:** ${e.why}`);
  const facts = [e.cost && `**Cost:** ${e.cost}`].filter(Boolean);
  if (facts.length) out.push(facts.join(' · '));
  for (const r of e.runs) {
    out.push(`**Model:** ${r.model ?? 'unknown'}${r.seed != null ? ` · **Seed:** ${r.seed}` : ''}${r.file ? ` · \`${r.file}\`` : ''}`);
    if (r.prompt) out.push(`<details><summary>Prompt</summary>\n\n\`\`\`text\n${r.prompt}\n\`\`\`\n\n</details>`);
  }
  const gallery = (label: string, list: string[]) => list.length ? `**${label}:**\n\n${list.map(p => `![${basename(p)}](${p.replace(/\\/g, '/')})`).join(' ')}` : '';
  for (const g of [gallery('Picked', e.picked), gallery('Rejected', e.rejected)]) if (g) out.push(g);
  return out.join('\n\n') + '\n\n---\n';
}

async function thumb(src: string, dest: string) {
  mkdirSync(dirname(dest), { recursive: true });
  await sharp(src).resize(THUMB, THUMB, { fit: 'inside', withoutEnlargement: true }).png().toFile(dest);
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const getAll = (flag: string) => args.flatMap((a, i) => (a === flag ? [args[i + 1]!] : []));
  const gameDir = resolve(args.find(a => !a.startsWith('--')) ?? '');
  const asset = get('--asset');
  const theme = join(gameDir, 'theme');
  if (!asset || !existsSync(theme)) throw new Error('Usage: npm run art:log -- games/game-001 --asset sym_H2 --decision "..." [--why "..."] [--pick img] [--reject img] [--sidecar file.json]');

  const logDir = join(theme, 'art-log');
  const logFile = join(logDir, 'LOG.md');
  mkdirSync(logDir, { recursive: true });
  if (!existsSync(logFile)) writeFileSync(logFile, '# Art log\n\nPrompts, models, decisions and the images behind them. Newest at the bottom. Added with `npm run art:log`.\n\n---\n');

  const when = new Date();
  const tag = `${when.getFullYear()}${pad(when.getMonth() + 1)}${pad(when.getDate())}-${pad(when.getHours())}${pad(when.getMinutes())}`;
  const runs = getAll('--sidecar').map(f => {
    const j = JSON.parse(readFileSync(resolve(f), 'utf8'));
    return { model: j.model, seed: j.seed, prompt: j.prompt, file: relative(gameDir, resolve(f)).replace(/\\/g, '/') };
  });
  const make = async (kind: string, list: string[]) => {
    const rels: string[] = [];
    for (const [i, src] of list.entries()) {
      const dest = join(logDir, 'images', `${tag}-${asset}-${kind}${i + 1}.png`);
      await thumb(resolve(src), dest);
      rels.push(relative(logDir, dest));
    }
    return rels;
  };
  const entry: LogEntry = {
    when, asset, decision: get('--decision'), why: get('--why'), cost: get('--cost'), by: get('--by'),
    runs, picked: await make('pick', getAll('--pick')), rejected: await make('reject', getAll('--reject')),
  };
  appendFileSync(logFile, formatEntry(entry));
  console.log(`Logged ${asset} to ${relative(process.cwd(), logFile)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
