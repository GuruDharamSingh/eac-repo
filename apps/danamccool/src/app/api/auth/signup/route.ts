import type { NextRequest } from 'next/server';
import { handleSignup } from '@elkdonis/auth-server';
import { siteConfig } from '@/config/site';

// Wrapped rather than bare-exported: handleSignup takes an optional second
// (SignupOrgOptions) parameter, which Next 16 type-checks against the route
// handler's `{ params }` context and rejects. `export { handleSignup as POST }`
// passes in dev — which never type-checks routes — and fails `next build`.
//
// A signup on this site is a viewer of this site's org (2026-11-24; the shared
// default enrolled it in `inner_group`, now `oad`).
export async function POST(request: NextRequest) {
  return handleSignup(request, {
    defaultOrgs: [{ id: siteConfig.orgId, role: 'viewer' }],
  });
}
