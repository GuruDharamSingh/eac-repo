// Cloudflare Turnstile check for forms that take input without an account
// (guest RSVP). Added 2026-11-17 after a Tor-routed headless bot filled the
// guest RSVP form on elkdonis-arts.org. Same rule as /api/auth/signup
// (packages/auth-server/src/api-routes.ts): enforced only when the app has
// TURNSTILE_SECRET_KEY, so an app without the widget keeps working.

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult = { ok: true } | { ok: false; status: 400 | 403; error: string };

export async function verifyTurnstile(token: unknown, remoteIp: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true };
  if (typeof token !== 'string' || !token) {
    return { ok: false, status: 400, error: 'Bot verification required. Please complete the challenge.' };
  }
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  try {
    const res = await fetch(SITEVERIFY, { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    if (data.success) return { ok: true };
  } catch (err) {
    console.error('[turnstile] siteverify failed:', err);
  }
  return { ok: false, status: 403, error: 'Bot verification failed. Please try again.' };
}
