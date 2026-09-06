import { handleSignup } from '@elkdonis/auth-server';
import type { NextRequest } from 'next/server';

/**
 * Wrapped rather than bare-exported.
 *
 * `export { handleSignup as POST }` type-checks in dev but fails `next build`:
 * handleSignup's optional second parameter (SignupOrgOptions) is structurally
 * incompatible with the `{ params }` context Next passes to a route handler,
 * so the route violates RouteHandlerConfig. Dev never type-checks routes, which
 * is why this only surfaced when switching to production mode.
 *
 * Same fix already applied to handleOAuthCallback in this app.
 */
export async function POST(request: NextRequest) {
  return handleSignup(request);
}
