import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Meta webhooks (Facebook Pages, Instagram, Threads share one shape):
 *
 *   GET  ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
 *        Meta's one-time handshake when the callback URL is saved in the
 *        dashboard. Answer the challenge in plain text when the token matches.
 *   POST a JSON body `{ object, entry: [...] }`, signed in
 *        `X-Hub-Signature-256: sha256=<hmac of the raw body with the app secret>`.
 *        Answer 200 quickly; Meta retries anything else.
 *
 * Framework-free: the handlers take and return Web Request/Response, so a
 * Next route re-exports them. The signature is checked over the raw bytes,
 * never over re-serialised JSON.
 */

export interface WebhookEvent {
  /** "page", "instagram", "threads", "user", "permissions"… */
  object: string;
  entry: Array<Record<string, unknown>>;
}

export interface WebhookOptions {
  /** The string entered as "Verify token" in the dashboard. */
  verifyToken: string | undefined;
  appSecret: string | undefined;
  /** Called once per delivery after the signature checks out. Errors are logged, not returned. */
  onEvent: (event: WebhookEvent, raw: string) => Promise<void> | void;
}

export function verifyHubSignature(raw: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(raw, 'utf8').digest('hex');
  const given = header.slice('sha256='.length);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

export function createWebhookHandlers(opts: WebhookOptions) {
  return {
    async GET(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (!opts.verifyToken) return new Response('verify token not configured', { status: 503 });
      if (mode !== 'subscribe' || token !== opts.verifyToken || !challenge) {
        return new Response('forbidden', { status: 403 });
      }
      return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
    },
    async POST(request: Request): Promise<Response> {
      if (!opts.appSecret) return new Response('app secret not configured', { status: 503 });
      const raw = await request.text();
      if (!verifyHubSignature(raw, request.headers.get('x-hub-signature-256'), opts.appSecret)) {
        return new Response('bad signature', { status: 401 });
      }
      let event: WebhookEvent;
      try {
        event = JSON.parse(raw) as WebhookEvent;
      } catch {
        return new Response('bad json', { status: 400 });
      }
      try {
        await opts.onEvent(event, raw);
      } catch (err) {
        console.error('[meta webhook] onEvent:', err);
      }
      return new Response('ok', { status: 200 });
    },
  };
}
