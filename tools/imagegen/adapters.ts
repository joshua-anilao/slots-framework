/**
 * Model adapters: turn one ImageSpec into the exact request a model expects.
 * Each adapter only describes what its model accepts; the shared translate() does the rest.
 * Schemas checked against fal.ai model pages on 2026-11-12. To add a model, add an entry here
 * and a row in .claude/skills/image-prompting/references/adapters.md.
 */
import { buildPrompt, type ImageSpec, type PromptLayout } from './spec';

export type SizeMode =
  | { kind: 'imageSize'; maxEdge: number } // image_size: { width, height }
  | { kind: 'aspectRatio'; ratios: string[] } // aspect_ratio: "4:5"
  | { kind: 'fixedSizes'; sizes: string[] }; // image_size: "1024x1536"

export interface ModelAdapter {
  key: string;
  provider: 'fal';
  /** Endpoint for new images. */
  endpoint: string;
  /** Endpoint used when the spec has an edit or reference images; omitted = model can't take images. */
  editEndpoint?: string;
  /** How reference images are sent: one image_url or a list image_urls. */
  imageField?: 'image_url' | 'image_urls';
  /** Reference images can be sent to the text-to-image endpoint too (style references). */
  refsOnTextEndpoint?: boolean;
  /** The model only edits: it always needs an input image. */
  requiresImage?: boolean;
  layout: PromptLayout;
  size: SizeMode;
  negativeField?: boolean;
  nativeTransparency?: boolean;
  seed: boolean;
  numImages: boolean;
  outputFormat: boolean;
  /** Prompt length limit in characters, if the model has one. */
  maxPromptChars?: number;
  /** Extra parameters by quality. */
  draft?: Record<string, unknown>;
  final?: Record<string, unknown>;
  /** Rough cost per image in USD (fal pricing page), for the batch warning. Undefined = not published. */
  usdPerImage?: number;
}

const ASPECTS_BFL = ['21:9', '16:9', '4:3', '3:2', '1:1', '2:3', '3:4', '9:16', '9:21'];
const ASPECTS_NANO2 = ['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '4:1', '1:4', '8:1', '1:8'];

export const ADAPTERS: Record<string, ModelAdapter> = {
  'flux-schnell': {
    key: 'flux-schnell', provider: 'fal', endpoint: 'fal-ai/flux/schnell', layout: 'prose',
    size: { kind: 'imageSize', maxEdge: 2048 }, seed: true, numImages: true, outputFormat: true, usdPerImage: 0.004,
  },
  'flux-dev': {
    key: 'flux-dev', provider: 'fal', endpoint: 'fal-ai/flux/dev', layout: 'prose',
    size: { kind: 'imageSize', maxEdge: 2048 }, seed: true, numImages: true, outputFormat: true,
    draft: { num_inference_steps: 20 }, final: { num_inference_steps: 40 }, usdPerImage: 0.03,
  },
  'flux-2': {
    key: 'flux-2', provider: 'fal', endpoint: 'fal-ai/flux-2-flex', layout: 'prose',
    size: { kind: 'imageSize', maxEdge: 2048 }, seed: true, numImages: false, outputFormat: true,
  },
  'flux-ultra': {
    key: 'flux-ultra', provider: 'fal', endpoint: 'fal-ai/flux-pro/v1.1-ultra', layout: 'prose',
    editEndpoint: 'fal-ai/flux-pro/v1.1-ultra', imageField: 'image_url', refsOnTextEndpoint: true,
    size: { kind: 'aspectRatio', ratios: ASPECTS_BFL }, seed: true, numImages: true, outputFormat: true,
  },
  'flux-kontext': {
    key: 'flux-kontext', provider: 'fal', endpoint: 'fal-ai/flux-pro/kontext', editEndpoint: 'fal-ai/flux-pro/kontext',
    imageField: 'image_url', requiresImage: true, layout: 'prose',
    size: { kind: 'aspectRatio', ratios: ASPECTS_BFL }, seed: true, numImages: true, outputFormat: true,
  },
  'nano-banana-2': {
    key: 'nano-banana-2', provider: 'fal', endpoint: 'fal-ai/nano-banana-2', editEndpoint: 'fal-ai/nano-banana-2/edit',
    imageField: 'image_urls', layout: 'labelled',
    size: { kind: 'aspectRatio', ratios: ASPECTS_NANO2 }, seed: true, numImages: true, outputFormat: true,
    draft: { resolution: '1K' }, final: { resolution: '2K' }, usdPerImage: 0.08,
  },
  'gpt-image-2': {
    key: 'gpt-image-2', provider: 'fal', endpoint: 'openai/gpt-image-2', editEndpoint: 'openai/gpt-image-2/edit',
    imageField: 'image_urls', layout: 'labelled', nativeTransparency: true,
    size: { kind: 'imageSize', maxEdge: 3840 }, seed: false, numImages: true, outputFormat: true,
    draft: { quality: 'low' }, final: { quality: 'high' },
  },
  'ideogram-v3': {
    key: 'ideogram-v3', provider: 'fal', endpoint: 'fal-ai/ideogram/v3', layout: 'prose',
    imageField: 'image_urls', refsOnTextEndpoint: true, negativeField: true,
    size: { kind: 'imageSize', maxEdge: 2048 }, seed: true, numImages: true, outputFormat: false,
    draft: { rendering_speed: 'TURBO' }, final: { rendering_speed: 'QUALITY' }, usdPerImage: 0.03,
  },
  'recraft-v3': {
    key: 'recraft-v3', provider: 'fal', endpoint: 'fal-ai/recraft/v3/text-to-image', layout: 'prose',
    size: { kind: 'imageSize', maxEdge: 2048 }, seed: false, numImages: false, outputFormat: false, maxPromptChars: 1000,
    draft: { style: 'digital_illustration' }, final: { style: 'digital_illustration' },
  },
};

export const DEFAULT_MODEL = 'flux-dev';
export const BACKGROUND_REMOVAL_ENDPOINT = 'fal-ai/birefnet';

/** Rule added to the prompt when a model can't make real transparency; the cutout pass removes the white. */
export const CUTOUT_CONSTRAINT = 'Isolated on a plain flat white background with a clean edge, nothing behind the subject, no ground shadow';
export const NATIVE_TRANSPARENT_CONSTRAINT = 'Nothing behind the subject, clean edge';

const ratioValue = (r: string): number => { const [w, h] = r.split(':').map(Number); return w! / h!; };

/** Nearest allowed aspect ratio, compared on a log scale so 2:1 and 1:2 are equally far from 1:1. */
export function nearestRatio(width: number, height: number, ratios: string[]): string {
  const target = Math.log(width / height);
  return ratios.reduce((best, r) => (Math.abs(Math.log(ratioValue(r)) - target) < Math.abs(Math.log(ratioValue(best)) - target) ? r : best));
}

/** Scales to fit maxEdge and rounds both sides to a multiple of 16 (what most models need). */
export function fitSize(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const r16 = (n: number) => Math.max(16, Math.round((n * scale) / 16) * 16);
  return { width: r16(width), height: r16(height) };
}

export interface Translated {
  adapter: ModelAdapter;
  endpoint: string;
  prompt: string;
  input: Record<string, unknown>;
  /** How many requests to send (models without num_images get one request per image). */
  requests: number;
  removeBackground: boolean;
  warnings: string[];
}

/**
 * Translates a spec (already merged with the style lock) for one model.
 * imageUrls are the references, already resolved to https or data: URLs, in spec order.
 */
export function translate(spec: ImageSpec, modelKey: string, imageUrls: string[] = []): Translated {
  const adapter = ADAPTERS[modelKey];
  if (!adapter) throw new Error(`Unknown model "${modelKey}". Known: ${Object.keys(ADAPTERS).join(', ')}`);
  const out = spec.output ?? {};
  const warnings: string[] = [];
  const count = Math.max(1, out.count ?? 1);

  const extra: string[] = [];
  let removeBackground = false;
  if (out.transparent) {
    if (adapter.nativeTransparency) extra.push(NATIVE_TRANSPARENT_CONSTRAINT);
    else { extra.push(CUTOUT_CONSTRAINT); removeBackground = true; }
  }

  // Models with a negative-prompt field get the exclusions there; everyone else gets "No ..." sentences.
  const useNegative = adapter.negativeField && (spec.constraints?.length ?? 0) > 0;
  const promptSpec: ImageSpec = useNegative ? { ...spec, constraints: [] } : spec;
  let prompt = buildPrompt(promptSpec, adapter.layout, extra);
  if (adapter.maxPromptChars && prompt.length > adapter.maxPromptChars) {
    warnings.push(`Prompt is ${prompt.length} chars; ${adapter.key} allows ${adapter.maxPromptChars}. It was cut; shorten the spec.`);
    prompt = prompt.slice(0, adapter.maxPromptChars);
  }

  const input: Record<string, unknown> = { prompt };
  if (useNegative) input.negative_prompt = spec.constraints!.map(c => c.replace(/^no\s+/i, '')).join(', ');

  const w = out.width ?? 1024, h = out.height ?? 1024;
  if (adapter.size.kind === 'imageSize') input.image_size = fitSize(w, h, adapter.size.maxEdge);
  else if (adapter.size.kind === 'aspectRatio') input.aspect_ratio = nearestRatio(w, h, adapter.size.ratios);
  else input.image_size = adapter.size.sizes[0];

  if (out.seed !== undefined) {
    if (adapter.seed) input.seed = out.seed;
    else warnings.push(`${adapter.key} has no seed; results can't be reproduced exactly.`);
  }
  if (adapter.numImages) input.num_images = count;
  else if (count > 1) warnings.push(`${adapter.key} makes one image per request; sending ${count} requests.`);
  if (adapter.outputFormat) input.output_format = 'png';
  if (out.transparent && adapter.nativeTransparency) input.background = 'transparent';
  Object.assign(input, out.quality === 'final' ? adapter.final : adapter.draft);

  let endpoint = adapter.endpoint;
  const refs = imageUrls.filter(Boolean);
  if (adapter.requiresImage && !refs.length) throw new Error(`${adapter.key} only edits images: add the image to edit in references.`);
  if (spec.edit || refs.length) {
    if (!adapter.imageField || (!spec.edit && !adapter.refsOnTextEndpoint && !adapter.editEndpoint)) {
      warnings.push(`${adapter.key} can't take reference images; they were left out.`);
    } else {
      if (spec.edit && !refs.length) throw new Error('An edit needs the image to edit in references.');
      endpoint = spec.edit || !adapter.refsOnTextEndpoint ? (adapter.editEndpoint ?? adapter.endpoint) : adapter.endpoint;
      if (adapter.imageField === 'image_url') {
        input.image_url = refs[0];
        if (refs.length > 1) warnings.push(`${adapter.key} takes one image; only the first reference was sent.`);
      } else input.image_urls = refs;
    }
  }

  Object.assign(input, spec.modelParams);
  return { adapter, endpoint, prompt, input, requests: adapter.numImages ? 1 : count, removeBackground, warnings };
}
