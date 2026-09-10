import type { NextRequest } from 'next/server';
import { handleSignup } from '@elkdonis/auth-server';

// Wrapped rather than bare-exported: handleSignup takes an optional second
// (SignupOrgOptions) parameter, which Next 16 type-checks against the route
// handler's `{ params }` context and rejects. `export { handleSignup as POST }`
// passes in dev — which never type-checks routes — and fails `next build`.
export async function POST(request: NextRequest) {
  return handleSignup(request);
}
