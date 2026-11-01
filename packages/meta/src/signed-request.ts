/**
 * Meta "signed requests" — the envelope Facebook uses for its server-to-server
 * callbacks (data deletion, deauthorize). Written 2026-10-29 for the data
 * deletion callback on elkdonis-arts.org.
 *
 * Shape: `<base64url signature>.<base64url payload>`. The signature is
 * HMAC-SHA256 of the payload string under the app secret; the payload is JSON
 * with at least `algorithm: "HMAC-SHA256"`, `issued_at` and `user_id`.
 * https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignedRequestPayload {
  algorithm: string;
  issued_at?: number;
  user_id?: string;
  [key: string]: unknown;
}

function fromBase64Url(s: string): Buffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64');
}

/**
 * Verifies and decodes a signed request. Returns null when the envelope is
 * malformed, the algorithm is not HMAC-SHA256, or the signature does not match
 * `appSecret`: a caller must treat null as "not from Meta".
 */
export function parseSignedRequest(signedRequest: string, appSecret: string): SignedRequestPayload | null {
  if (typeof signedRequest !== 'string' || !appSecret) return null;
  const dot = signedRequest.indexOf('.');
  if (dot <= 0) return null;
  const sig = fromBase64Url(signedRequest.slice(0, dot));
  const payloadPart = signedRequest.slice(dot + 1);

  let payload: SignedRequestPayload;
  try {
    payload = JSON.parse(fromBase64Url(payloadPart).toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (String(payload.algorithm ?? '').toUpperCase() !== 'HMAC-SHA256') return null;

  const expected = createHmac('sha256', appSecret).update(payloadPart).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  return payload;
}
