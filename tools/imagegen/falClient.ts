/**
 * Minimal fal.ai client using the queue REST API (no SDK):
 *   1. POST https://queue.fal.run/<endpoint> with the input JSON   -> { status_url, response_url }
 *   2. GET status_url until status is COMPLETED
 *   3. GET response_url                                             -> the model output, e.g. { images: [{ url }] }
 * The key is sent as "Authorization: Key <FAL_KEY>" and is never logged.
 */

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean; status: number; json(): Promise<any>; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer>;
  headers: { get(name: string): string | null };
}>;

export interface FalOptions {
  key: string;
  fetchImpl?: FetchLike;
  pollMs?: number;
  timeoutMs?: number;
  log?: (msg: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

const QUEUE = 'https://queue.fal.run';

async function check(res: Awaited<ReturnType<FetchLike>>, what: string): Promise<any> {
  if (res.ok) return res.json();
  const body = (await res.text()).slice(0, 500);
  const hint = res.status === 401 || res.status === 403 ? ' Check FAL_KEY (see docs/FAL_AI_SETUP.md).' : '';
  throw new Error(`fal.ai ${what} failed (${res.status}).${hint} ${body}`);
}

/** Runs one request through the fal queue and returns the model's output JSON. */
export async function runFal(endpoint: string, input: Record<string, unknown>, opts: FalOptions): Promise<any> {
  const f = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  const log = opts.log ?? (() => {});
  const headers = { Authorization: `Key ${opts.key}`, 'Content-Type': 'application/json' };

  const submitted = await check(await f(`${QUEUE}/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(input) }), 'submit');
  log(`  queued ${endpoint} (request ${submitted.request_id})`);

  const deadline = Date.now() + (opts.timeoutMs ?? 300_000);
  let last = '';
  for (;;) {
    const st = await check(await f(submitted.status_url, { headers }), 'status');
    if (st.status !== last) { log(`  ${st.status}${st.queue_position !== undefined ? ` (position ${st.queue_position})` : ''}`); last = st.status; }
    if (st.status === 'COMPLETED') {
      if (st.error) throw new Error(`fal.ai ${endpoint} failed: ${st.error_type ?? ''} ${st.error}`);
      break;
    }
    if (Date.now() > deadline) throw new Error(`fal.ai ${endpoint} timed out; request ${submitted.request_id} may still finish.`);
    await sleep(opts.pollMs ?? 1500);
  }
  return check(await f(submitted.response_url, { headers }), 'result');
}

/** Image URLs from a model output. Most models return images[]; background removal returns image. */
export function imageUrlsOf(output: any): string[] {
  if (Array.isArray(output?.images)) return output.images.map((i: { url: string }) => i.url);
  if (output?.image?.url) return [output.image.url];
  return [];
}

/** Downloads one image. fal may return https URLs or data: URIs. */
export async function download(url: string, fetchImpl?: FetchLike): Promise<{ bytes: Buffer; ext: string }> {
  if (url.startsWith('data:')) {
    const m = /^data:image\/(\w+);base64,(.*)$/s.exec(url);
    if (!m) throw new Error('Unsupported data URI from fal.ai');
    return { bytes: Buffer.from(m[2]!, 'base64'), ext: m[1] === 'jpeg' ? 'jpg' : m[1]! };
  }
  const f = fetchImpl ?? (fetch as unknown as FetchLike);
  const res = await f(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const type = res.headers.get('content-type') ?? '';
  const ext = /jpe?g/.test(type) ? 'jpg' : /webp/.test(type) ? 'webp' : 'png';
  return { bytes: Buffer.from(await res.arrayBuffer()), ext };
}
