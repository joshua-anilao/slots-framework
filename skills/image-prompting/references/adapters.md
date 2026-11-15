# Model adapters

How the one prompt spec is translated per model. The code is `tools/imagegen/adapters.ts`; this file
explains the choices. Schemas checked on fal.ai model pages, 2026-11-12. Re-check a model's
`fal.ai/models/<endpoint>/api` page if a request is rejected.

## Quick pick for slot art

| Need | First choice | Why |
|---|---|---|
| Cheap exploration, many ideas | `flux-schnell` | ~$0.003 per image, 4 steps, fast |
| Symbols and backgrounds, final | `flux-dev` or `nano-banana-2` | Strong illustration; Nano Banana 2 follows long prompts and references well |
| Anything with words (logo, WILD, SCATTER, banners) | `ideogram-v3` or `gpt-image-2` | Best text rendering |
| Real transparent PNG with no cutout pass | `gpt-image-2` | Only model with `background: transparent` |
| Keep a set consistent from a hero image | `nano-banana-2` (edit) or `flux-kontext` | Take reference images |
| Small fix on an existing image | `flux-kontext` or `nano-banana-2` edit | One change, rest kept |
| Flat UI / vector-like pieces | `recraft-v3` | Vector-style output, colour control |

## Adapter table (fal.ai)

| Key | Endpoint | Prompt layout | Size param | Negative field | Seed | Count | Transparency | References |
|---|---|---|---|---|---|---|---|---|
| `flux-schnell` | `fal-ai/flux/schnell` | prose | `image_size {w,h}` | no | yes | `num_images` | cutout pass | no |
| `flux-dev` (default) | `fal-ai/flux/dev` | prose | `image_size {w,h}` | no | yes | `num_images` | cutout pass | no |
| `flux-2` | `fal-ai/flux-2-flex` | prose | `image_size {w,h}` | no | yes | one per request | cutout pass | no |
| `flux-ultra` | `fal-ai/flux-pro/v1.1-ultra` | prose | `aspect_ratio` | no | yes | `num_images` | cutout pass | 1 image (`image_url`, style hint) |
| `flux-kontext` | `fal-ai/flux-pro/kontext` | prose | `aspect_ratio` | no | yes | `num_images` | cutout pass | required, 1 image (edit only) |
| `nano-banana-2` | `fal-ai/nano-banana-2` (+`/edit`) | labelled | `aspect_ratio` + `resolution` | no | yes | `num_images` | cutout pass | `image_urls` (edit endpoint) |
| `gpt-image-2` | `openai/gpt-image-2` (+`/edit`) | labelled | `image_size {w,h}` (x16, max 3840) | no | **no** | `num_images` | **native** | `image_urls` (edit endpoint) |
| `ideogram-v3` | `fal-ai/ideogram/v3` | prose | `image_size {w,h}` | **yes** | yes | `num_images` | cutout pass | `image_urls` (style refs) |
| `recraft-v3` | `fal-ai/recraft/v3/text-to-image` | prose, max 1000 chars | `image_size {w,h}` | no | no | one per request | cutout pass | no |

Cutout pass = `fal-ai/birefnet` background removal, run automatically when `output.transparent` is true.

Draft vs final (`--final`): flux-dev 20 vs 40 steps, nano-banana-2 1K vs 2K, gpt-image-2 low vs high
quality, ideogram TURBO vs QUALITY.

## Model quirks (how to write for each)

- **FLUX (schnell/dev/2/ultra):** plain descriptive sentences, most important thing first. No
  negative prompt, so exclusions are short "No ..." sentences at the end; if FLUX keeps drawing the
  excluded thing, describe the wanted alternative instead ("a plain cream background" beats
  "no busy background"). Keyword lists and weights do nothing. Text is decent for 1-2 short words.
- **FLUX Kontext:** editing only. Start with the change, then what stays. One change per run.
- **Nano Banana 2 (Gemini image):** follows long labelled prompts and multi-image roles well. Best
  for "make this symbol in the same style as image 1". Supports extreme ratios (4:1 banners).
- **GPT Image 2:** this is the model the OpenArt guide was written for. Labelled sections, quoted
  text, explicit "keep" lists in edits. No seed, so save every good result.
- **Ideogram v3:** the exclusion list goes to `negative_prompt` (the tool strips the leading "No").
  `expand_prompt` is on by default and rewrites your prompt; set `"modelParams": {"expand_prompt": false}`
  when you need exact control.
- **Recraft v3:** keep prompts short (1000 chars). Pick `style` in `modelParams`
  (e.g. `vector_illustration`, `digital_illustration`).

## Prices seen (fal connector, 2026-11-12)

nano-banana-2 $0.08/image, flux-schnell $0.003/MP, flux-dev $0.025/MP (~$0.03 per 1 MP image), ideogram-v3 $0.03
(listed), nano-banana-pro $0.15, birefnet ~$0.0006 per compute second (a fraction of a cent per cutout),
gpt-image-2 price unclear ("$1 per unit"). Check `get_pricing` before a batch; tell Josh the total first.

## Outside fal.ai (for later)

The spec still applies; only the last step changes. Add an adapter with a new `provider` when needed.

| Target | How the spec maps |
|---|---|
| ChatGPT app (GPT Image) | Paste the labelled prompt from `--dry-run --model gpt-image-2`. Say the shape in words ("tall portrait image, about 5:6") because the app has no size controls. For edits, say the change, then the keep list, every turn. |
| OpenAI API direct | Same as `gpt-image-2`, but `size` is a string like `"1024x1536"` and `background: "transparent"` needs `output_format: "png"`. |
| Midjourney | Prose prompt, then parameters: `--ar 5:6`, `--no text, watermark`, `--seed 7`, `--sref <hero url>` for set consistency. Drop the labels. |
| Stable Diffusion / SDXL / ComfyUI | Shorter comma phrases work better; exclusions go to the negative prompt; width/height must suit the checkpoint (e.g. 832x1216). |
| fal models not listed (Seedream 5, FLUX 3, Nano Banana Pro, Ideogram 4) | Read the model's `/api` page, copy the closest adapter, and adjust size, negative and image fields. |
