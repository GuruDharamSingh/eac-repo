import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const issuer = req.nextUrl.origin.replace(/\/$/, '');

  return NextResponse.json({
    issuer,
    authorization_endpoint: `${issuer}/api/oidc/authorize`,
    token_endpoint: `${issuer}/api/oidc/token`,
    userinfo_endpoint: `${issuer}/api/oidc/userinfo`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256'],
    scopes_supported: ['openid', 'email', 'profile'],
    claims_supported: ['sub', 'name', 'email', 'email_verified', 'preferred_username', 'nonce'],
  });
}
