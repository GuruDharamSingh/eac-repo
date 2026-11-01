/**
 * Meta data deletion callback (2026-10-29).
 *
 * Facebook POSTs `signed_request=<envelope>` (form-encoded) when a person
 * removes the app or asks Facebook to delete their data. The app must answer
 * with JSON `{ url, confirmation_code }`: a page where the person can follow
 * the request, and a code to quote. Meta's dashboard "Test" button sends the
 * same shape.
 *
 * This factory verifies the envelope with the app secret and hands the
 * app-scoped user id to `record`, which stores the request and returns the
 * code and status page. It has no opinion about storage.
 * https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */

import { parseSignedRequest } from './signed-request';

export interface DeletionCallbackOptions {
  /** Defaults to META_APP_SECRET. The route answers 503 when it is unset. */
  appSecret?: string;
  record: (input: { userId: string; issuedAt: number | null }) => Promise<{ confirmationCode: string; statusUrl: string }>;
}

export function createDataDeletionCallback(opts: DeletionCallbackOptions) {
  return async function POST(req: Request): Promise<Response> {
    const secret = opts.appSecret ?? process.env.META_APP_SECRET ?? '';
    if (!secret) {
      return Response.json({ error: 'the app secret is not configured' }, { status: 503 });
    }

    let signed: string | null = null;
    const type = req.headers.get('content-type') ?? '';
    try {
      if (type.includes('application/json')) {
        const body = (await req.json()) as { signed_request?: string };
        signed = body?.signed_request ?? null;
      } else {
        const form = await req.formData();
        const v = form.get('signed_request');
        signed = typeof v === 'string' ? v : null;
      }
    } catch {
      signed = null;
    }
    if (!signed) return Response.json({ error: 'signed_request missing' }, { status: 400 });

    const payload = parseSignedRequest(signed, secret);
    if (!payload || !payload.user_id) {
      return Response.json({ error: 'invalid signed_request' }, { status: 400 });
    }

    const { confirmationCode, statusUrl } = await opts.record({
      userId: String(payload.user_id),
      issuedAt: typeof payload.issued_at === 'number' ? payload.issued_at : null,
    });
    return Response.json({ url: statusUrl, confirmation_code: confirmationCode });
  };
}
