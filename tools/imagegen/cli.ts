/**
 * Generates game art from prompt specs through fal.ai.
 *
 *   npm run art:gen -- <spec.json> [more specs...] [options]
 *
 * Options:
 *   --model <key>     override the spec's model (flux-schnell, flux-dev, flux-2, flux-ultra, flux-kontext,
 *                     nano-banana-2, gpt-image-2, ideogram-v3, recraft-v3)
 *   --count <n>       images per spec            --seed <n>   fixed seed (if the model has one)
 *   --final           use the model's best quality settings (default: draft settings)
 *   --dry-run         print the exact request for each spec and stop. Costs nothing, needs no key.
 *   --yes             skip the cost confirmation for big batches
 *
 * Spec files live in games/<id>/theme/prompts/. The game's style lock games/<id>/theme/style.json is merged in.
 * Output: games/<id>/theme/generated/<asset>/<asset>_<model>_<time>_<n>.png plus a .json sidecar each.
 * Key: FAL_KEY environment variable, or a FAL_KEY=... line in .env.local at the repo root (git-ignored).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { applyStyleLock, type ImageSpec, type StyleLock } from './spec';
import { ADAPTERS, BACKGROUND_REMOVAL_ENDPOINT, DEFAULT_MODEL, translate } from './adapters';
import { download, imageUrlsOf, runFal } from './falClient';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BATCH_CONFIRM_IMAGES = 20;

interface Args { specs: string[]; model?: string; count?: number; seed?: number; final: boolean; dryRun: boolean; yes: boolean }

function parseArgs(argv: string[]): Args {
  const a: Args = { specs: [], final: false, dryRun: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i]!;
    if (v === '--model') a.model = argv[++i];
    else if (v === '--count') a.count = Number(argv[++i]);
    else if (v === '--seed') a.seed = Number(argv[++i]);
    else if (v === '--final') a.final = true;
    else if (v === '--dry-run') a.dryRun = true;
    else if (v === '--yes') a.yes = true;
    else if (v.startsWith('--')) throw new Error(`Unknown option ${v}`);
    else a.specs.push(v);
  }
  if (!a.specs.length) throw new Error('Give at least one spec file, e.g. npm run art:gen -- games/game-001/theme/prompts/sym_H1.json --dry-run');
  return a;
}

function readKey(): string {
  const envFile = join(root, '.env.local');
  if (!process.env.FAL_KEY && existsSync(envFile)) process.loadEnvFile(envFile);
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error('FAL_KEY is not set. See docs/FAL_AI_SETUP.md, step 2.');
  return key;
}

/** Local reference images become data: URIs (fal accepts them); https URLs pass through. */
function resolveImage(ref: string, specDir: string): string {
  if (/^(https?:|data:)/.test(ref)) return ref;
  const p = isAbsolute(ref) ? ref : resolve(specDir, ref);
  const ext = extname(p).slice(1).toLowerCase().replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${readFileSync(p).toString('base64')}`;
}

function loadSpec(path: string, args: Args) {
  const specPath = resolve(path);
  const specDir = dirname(specPath);
  const artDir = resolve(specDir, '..');
  const stylePath = join(artDir, 'style.json');
  const style: StyleLock | undefined = existsSync(stylePath) ? JSON.parse(readFileSync(stylePath, 'utf8')) : undefined;
  const raw: ImageSpec = JSON.parse(readFileSync(specPath, 'utf8'));
  const spec = applyStyleLock({ ...raw, asset: raw.asset ?? basename(specPath, '.json') }, style);
  spec.output = { ...spec.output };
  if (args.count) spec.output.count = args.count;
  if (args.seed !== undefined) spec.output.seed = args.seed;
  if (args.final) spec.output.quality = 'final';
  const model = args.model ?? spec.model ?? DEFAULT_MODEL;
  const imageUrls = (spec.references ?? []).map(r => resolveImage(r.image, specDir));
  return { spec, model, imageUrls, outDir: join(artDir, 'generated', spec.asset) };
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const short = (input: Record<string, unknown>) =>
  JSON.stringify(input, (k, v) => (typeof v === 'string' && v.startsWith('data:') ? `${v.slice(0, 30)}...` : v), 2);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jobs = args.specs.map(s => {
    const job = loadSpec(s, args);
    return { ...job, t: translate(job.spec, job.model, job.imageUrls) };
  });

  let images = 0, usd = 0, unknownPrice = false;
  for (const { spec, t } of jobs) {
    const n = Math.max(1, spec.output?.count ?? 1);
    images += n;
    if (t.adapter.usdPerImage === undefined) unknownPrice = true; else usd += n * t.adapter.usdPerImage;
    console.log(`\n${spec.asset} -> ${t.adapter.key} (${t.endpoint})${t.removeBackground ? ' + background removal' : ''}`);
    for (const w of t.warnings) console.log(`  ! ${w}`);
    if (args.dryRun) console.log(short(t.input));
  }
  const price = !unknownPrice ? `about $${usd.toFixed(2)}`
    : usd ? `at least $${usd.toFixed(2)} (some models have no published price, see fal.ai/pricing)`
    : 'price not published, see fal.ai/pricing';
  console.log(`\n${images} image(s), ${price}.`);
  if (args.dryRun) return;

  const key = readKey();
  if (images > BATCH_CONFIRM_IMAGES && !args.yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`That's more than ${BATCH_CONFIRM_IMAGES} images. Continue? (y/N) `);
    rl.close();
    if (!/^y/i.test(answer)) return;
  }

  for (const { spec, model, outDir, t } of jobs) {
    console.log(`\nGenerating ${spec.asset} with ${model}...`);
    mkdirSync(outDir, { recursive: true });
    const urls: string[] = [];
    let seed: unknown;
    for (let r = 0; r < t.requests; r++) {
      const output = await runFal(t.endpoint, t.input, { key, log: console.log });
      seed ??= output.seed;
      urls.push(...imageUrlsOf(output));
    }
    const time = stamp();
    for (const [i, url] of urls.entries()) {
      let finalUrl = url;
      if (t.removeBackground) {
        const cut = await runFal(BACKGROUND_REMOVAL_ENDPOINT, { image_url: url, output_format: 'png' }, { key });
        finalUrl = imageUrlsOf(cut)[0] ?? url;
      }
      const { bytes, ext } = await download(finalUrl);
      const name = `${spec.asset}_${model}_${time}_${i + 1}`;
      writeFileSync(join(outDir, `${name}.${ext}`), bytes);
      writeFileSync(join(outDir, `${name}.json`), JSON.stringify({
        asset: spec.asset, model, endpoint: t.endpoint, seed: seed ?? null, removeBackground: t.removeBackground,
        prompt: t.prompt, input: JSON.parse(short(t.input)), spec, createdAt: new Date().toISOString(),
      }, null, 2));
      console.log(`  saved ${relative(root, join(outDir, `${name}.${ext}`))}`);
    }
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
