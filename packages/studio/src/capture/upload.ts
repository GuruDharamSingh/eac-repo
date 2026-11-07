// Send a recording in parts while it records: MediaRecorder blobs are
// gathered until a part is big enough, then posted in order. The host's
// route does the storage (Nextcloud chunking v2: parts of at least 5 MB except
// the last). Two route shapes use it: the signed-in recordings route
// (start → id) and the phone route (/api/capture/<code>, the code in the URL).

export interface ChunkedUpload {
  push(blob: Blob): void;
  /** Send what is left and assemble; resolves with the stored path. */
  finish(extra?: Record<string, string>): Promise<{ path: string }>;
  abort(): Promise<void>;
  readonly sent: number;
  readonly failed: string | null;
}

const PART = 8_000_000;

async function post(url: string, body?: BodyInit, json = false) {
  const res = await fetch(url, { method: 'POST', body, headers: json ? { 'Content-Type': 'application/json' } : undefined });
  const j = (await res.json().catch(() => ({}))) as { error?: string; id?: string; path?: string };
  if (!res.ok) throw new Error(j.error ?? `Upload failed (${res.status})`);
  return j;
}

/**
 * `base` is the route; `idParam` is the upload id once started (signed-in
 * route) or empty (phone route, where the code in the URL identifies it).
 */
export async function startChunkedUpload(
  base: string,
  start: { body?: Record<string, unknown>; query?: Record<string, string> },
  onProgress?: (sent: number) => void
): Promise<ChunkedUpload> {
  const join = (q: Record<string, string>) => `${base}${base.includes('?') ? '&' : '?'}${new URLSearchParams(q)}`;
  const first = await post(join({ op: 'start', ...(start.query ?? {}) }), start.body ? JSON.stringify(start.body) : undefined, Boolean(start.body));
  const id = first.id ?? '';
  const withId = (q: Record<string, string>) => join(id ? { ...q, id } : q);
  let pending: Blob[] = [];
  let size = 0;
  let index = 1;
  let sent = 0;
  let failed: string | null = null;
  let chain = Promise.resolve();

  const flush = (force: boolean) => {
    if ((!force && size < PART) || pending.length === 0) return;
    const blob = new Blob(pending);
    pending = [];
    size = 0;
    const n = index++;
    chain = chain
      .then(async () => {
        if (failed) return;
        await post(withId({ op: 'part', index: String(n) }), blob);
        sent += blob.size;
        onProgress?.(sent);
      })
      .catch((e) => {
        failed = (e as Error).message;
      });
  };

  return {
    push(blob) {
      if (!blob.size) return;
      pending.push(blob);
      size += blob.size;
      flush(false);
    },
    async finish(extra) {
      flush(true);
      await chain;
      if (failed) throw new Error(failed);
      const r = await post(withId({ op: 'finish', ...(extra ?? {}) }));
      return { path: r.path! };
    },
    async abort() {
      failed ??= 'stopped';
      await post(withId({ op: 'abort' })).catch(() => {});
    },
    get sent() {
      return sent;
    },
    get failed() {
      return failed;
    },
  };
}

export function pickRecordingMime(): string {
  const options = ['video/mp4;codecs=avc1,mp4a', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

export const extFor = (mime: string) => (mime.startsWith('video/mp4') ? 'mp4' : 'webm');
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
