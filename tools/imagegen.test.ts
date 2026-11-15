import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyStyleLock, buildPrompt, type ImageSpec } from './imagegen/spec';
import { ADAPTERS, CUTOUT_CONSTRAINT, fitSize, nearestRatio, translate } from './imagegen/adapters';
import { imageUrlsOf, runFal, type FetchLike } from './imagegen/falClient';

const spec: ImageSpec = {
  asset: 'sym_H1',
  purpose: 'Slot symbol icon',
  subject: 'Four fishballs on a bamboo skewer',
  composition: 'Front view, centred',
  constraints: ['No watermark'],
  output: { width: 1024, height: 1200, transparent: true, count: 4, seed: 7 },
};

describe('prompt builder', () => {
  it('keeps the skill order and adds "No text" when the image has no text', () => {
    const p = buildPrompt(spec, 'labelled');
    expect(p.split('\n').map(l => l.split(':')[0])).toEqual(['PURPOSE', 'SUBJECT', 'COMPOSITION', 'CONSTRAINTS']);
    expect(p).toContain('CONSTRAINTS: No text. No watermark.');
  });

  it('adds "No other text" when text is given, and edit lines come first', () => {
    const p = buildPrompt({ ...spec, text: '"WILD" on the banner', edit: { change: 'sauce to red', keep: 'everything else' } }, 'prose');
    expect(p.startsWith('Change only this: sauce to red. Keep exactly as it is: everything else.')).toBe(true);
    expect(p).toContain('No other text.');
  });

  it('merges the style lock under the asset spec', () => {
    const merged = applyStyleLock(spec, { style: 'Sticker', subject: 'ignored', constraints: ['No logos', 'No watermark'], output: { quality: 'final' } });
    expect(merged.subject).toBe(spec.subject);
    expect(merged.style).toBe('Sticker');
    expect(merged.constraints).toEqual(['No logos', 'No watermark']);
    expect(merged.output).toMatchObject({ quality: 'final', count: 4 });
  });
});

describe('adapters', () => {
  it('maps sizes to multiples of 16 and to the nearest aspect ratio', () => {
    expect(fitSize(1000, 1201, 2048)).toEqual({ width: 1008, height: 1200 });
    expect(fitSize(4000, 2000, 2048)).toEqual({ width: 2048, height: 1024 });
    expect(nearestRatio(1024, 1200, ['1:1', '4:5', '3:4', '9:16'])).toBe('4:5');
    expect(nearestRatio(1920, 1080, ['1:1', '16:9', '21:9'])).toBe('16:9');
  });

  it('FLUX: prose prompt, cutout constraint, background removal, image_size and seed', () => {
    const t = translate(spec, 'flux-dev');
    expect(t.endpoint).toBe('fal-ai/flux/dev');
    expect(t.prompt).toContain(CUTOUT_CONSTRAINT);
    expect(t.removeBackground).toBe(true);
    expect(t.input).toMatchObject({ image_size: { width: 1024, height: 1200 }, seed: 7, num_images: 4, output_format: 'png' });
  });

  it('GPT Image 2: native transparency, labelled prompt, warns about seed', () => {
    const t = translate(spec, 'gpt-image-2');
    expect(t.input.background).toBe('transparent');
    expect(t.removeBackground).toBe(false);
    expect(t.prompt.startsWith('PURPOSE:')).toBe(true);
    expect(t.input.seed).toBeUndefined();
    expect(t.warnings.join()).toMatch(/no seed/);
  });

  it('Ideogram: exclusions go to negative_prompt instead of the prompt', () => {
    const t = translate(spec, 'ideogram-v3');
    expect(t.input.negative_prompt).toBe('watermark');
    expect(t.prompt).not.toContain('No watermark');
  });

  it('Nano Banana 2: aspect ratio, references switch to the edit endpoint', () => {
    const t = translate({ ...spec, references: [{ image: 'x.png', role: 'the style only' }] }, 'nano-banana-2', ['https://x/x.png']);
    expect(t.input.aspect_ratio).toBe('4:5');
    expect(t.endpoint).toBe('fal-ai/nano-banana-2/edit');
    expect(t.input.image_urls).toEqual(['https://x/x.png']);
    expect(t.prompt).toContain('Use image 1 for the style only');
  });

  it('models without num_images send one request per image', () => {
    const t = translate(spec, 'flux-2');
    expect(t.requests).toBe(4);
    expect(t.input.num_images).toBeUndefined();
  });

  it('edit-only models refuse a spec without an image', () => {
    expect(() => translate(spec, 'flux-kontext')).toThrow(/only edits/);
  });

  it('every example spec translates for every model that does text-to-image', () => {
    const style = JSON.parse(readFileSync('games/game-001/theme/style.json', 'utf8'));
    for (const name of ['sym_H1', 'sym_WILD', 'bg_main', 'bg_desktop', 'logo']) {
      const s = applyStyleLock(JSON.parse(readFileSync(`games/game-001/theme/prompts/${name}.json`, 'utf8')), style);
      for (const key of Object.keys(ADAPTERS).filter(k => !ADAPTERS[k]!.requiresImage)) {
        expect(translate(s, key).prompt.length).toBeGreaterThan(50);
      }
    }
  });
});

describe('fal client', () => {
  const reply = (body: unknown, ok = true, status = 200) => ({
    ok, status, json: async () => body, text: async () => JSON.stringify(body), arrayBuffer: async () => new ArrayBuffer(0),
    headers: { get: () => null },
  });

  it('submits, polls until COMPLETED and returns the result, sending the key header', async () => {
    const calls: { url: string; auth?: string }[] = [];
    const statuses = ['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED'];
    const f: FetchLike = async (url, init) => {
      calls.push({ url, auth: init?.headers?.Authorization });
      if (url.endsWith('/fal-ai/flux/dev')) return reply({ request_id: 'r1', status_url: 'https://q/status', response_url: 'https://q/result' });
      if (url === 'https://q/status') return reply({ status: statuses.shift() });
      return reply({ images: [{ url: 'https://img/1.png' }], seed: 42 });
    };
    const out = await runFal('fal-ai/flux/dev', { prompt: 'x' }, { key: 'k', fetchImpl: f, sleep: async () => {} });
    expect(imageUrlsOf(out)).toEqual(['https://img/1.png']);
    expect(calls[0]).toEqual({ url: 'https://queue.fal.run/fal-ai/flux/dev', auth: 'Key k' });
    expect(calls.filter(c => c.url === 'https://q/status')).toHaveLength(3);
  });

  it('explains a bad key', async () => {
    const f: FetchLike = async () => reply({ detail: 'Unauthorized' }, false, 401);
    await expect(runFal('fal-ai/flux/dev', {}, { key: 'bad', fetchImpl: f })).rejects.toThrow(/Check FAL_KEY/);
  });

  it('reads background-removal output (image, not images)', () => {
    expect(imageUrlsOf({ image: { url: 'u' } })).toEqual(['u']);
  });
});
