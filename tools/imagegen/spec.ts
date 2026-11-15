/**
 * The model-agnostic image prompt spec and the prompt builder.
 * Field order follows the image-prompting skill: purpose, subject, composition, style, lighting,
 * palette, text, constraints. Output settings (size, transparency, count, seed) are never written
 * into the prompt text; adapters send them as model parameters.
 */

export interface ImageReference {
  /** Local path (relative to the spec file) or https URL. */
  image: string;
  /** What to take from it, e.g. "style only", "the product", "the image to edit". */
  role: string;
}

export interface ImageOutput {
  width?: number;
  height?: number;
  transparent?: boolean;
  count?: number;
  seed?: number;
  /** draft = cheap/fast settings, final = best settings the model offers. */
  quality?: 'draft' | 'final';
}

export interface ImageSpec {
  /** Frame name from the art contract, e.g. sym_H1. Used for the output folder. */
  asset: string;
  /** Adapter key from adapters.ts, e.g. flux-dev, nano-banana-2, gpt-image-2. */
  model?: string;
  purpose?: string;
  subject?: string;
  composition?: string;
  style?: string;
  lighting?: string;
  palette?: string;
  /** Exact words to render, with placement. Empty means the image has no text. */
  text?: string;
  constraints?: string[];
  references?: ImageReference[];
  /** Edit mode: change one thing on the first reference whose role mentions "edit". */
  edit?: { change: string; keep: string };
  output?: ImageOutput;
  /** Raw parameters passed straight to the model, overriding the adapter's choices. */
  modelParams?: Record<string, unknown>;
  /** Free notes for humans (why this prompt, what was tried). Never sent to the model. */
  notes?: string;
}

/** The shared look of one game, from games/<id>/theme/style.json. Any spec field except asset. */
export type StyleLock = Partial<Omit<ImageSpec, 'asset'>>;

/** Merges the game's style lock under an asset spec. Asset fields win; constraints are combined. */
export function applyStyleLock(spec: ImageSpec, style: StyleLock | undefined): ImageSpec {
  if (!style) return spec;
  const constraints = [...(style.constraints ?? []), ...(spec.constraints ?? [])];
  return {
    ...style,
    ...spec,
    constraints: [...new Set(constraints)],
    output: { ...style.output, ...spec.output },
    modelParams: { ...style.modelParams, ...spec.modelParams },
  };
}

export type PromptLayout = 'labelled' | 'prose';

const FIELDS = ['purpose', 'subject', 'composition', 'style', 'lighting', 'palette', 'text'] as const;

const sentence = (s: string): string => {
  const t = s.trim();
  return /[.!?"]$/.test(t) ? t : `${t}.`;
};

/** Builds the prompt text. extraConstraints come from the adapter (e.g. the white-background cutout rule). */
export function buildPrompt(spec: ImageSpec, layout: PromptLayout, extraConstraints: string[] = []): string {
  const constraints = [...(spec.constraints ?? []), ...extraConstraints];
  if (!spec.text?.trim() && !constraints.some(c => /\bno (other )?text\b/i.test(c))) constraints.unshift('No text');
  if (spec.text?.trim()) constraints.unshift('No other text');

  const lines: [string, string][] = [];
  if (spec.edit) {
    lines.push(['change', `Change only this: ${spec.edit.change}`]);
    lines.push(['keep', `Keep exactly as it is: ${spec.edit.keep}`]);
  }
  const refs = spec.references ?? [];
  if (refs.length) lines.push(['references', refs.map((r, i) => `Use image ${i + 1} for ${r.role}`).join('. ')]);
  for (const f of FIELDS) {
    const v = spec[f]?.trim();
    if (v) lines.push([f, v]);
  }
  if (constraints.length) lines.push(['constraints', constraints.map(sentence).join(' ')]);

  if (layout === 'labelled') return lines.map(([k, v]) => `${k.toUpperCase()}: ${sentence(v)}`).join('\n');
  return lines.map(([, v]) => sentence(v)).join(' ');
}
