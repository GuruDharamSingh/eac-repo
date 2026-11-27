import type { NextRequest } from 'next/server';
import { handleSignup } from '@elkdonis/auth-server';
import { siteConfig } from '@/config/site';

// Wrapped rather than bare-exported: handleSignup takes an optional second
// (SignupOrgOptions) parameter, which Next 16 type-checks against the route
// handler's `{ params }` context and rejects. `export { handleSignup as POST }`
// passes in dev — which never type-checks routes — and fails `next build`.
//
// A signup here is a viewer of the marketplace (named first: it is the org the
// welcome email speaks as) and of `oad`, the artist directory (developer,
// 2026-11-24; the shared default used to be `inner_group`). Becoming an artist
// of the collective, and so able to claim a store, is the Sell page's "Join the
// collective as an artist" step, which raises the `oad` row to `member`.
export async function POST(request: NextRequest) {
  return handleSignup(request, {
    defaultOrgs: [
      { id: siteConfig.marketplaceOrgId, role: 'viewer' },
      { id: 'oad', role: 'viewer' },
    ],
  });
}
