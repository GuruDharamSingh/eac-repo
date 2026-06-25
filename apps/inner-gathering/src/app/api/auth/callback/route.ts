import { handleOAuthCallback } from '@elkdonis/auth-server';
import { type NextRequest, NextResponse } from 'next/server';

// Behind NPM the internal request.url is http://0.0.0.0:3004/...
// Proxy the NextRequest to return the public URL so handleOAuthCallback
// builds correct redirect URLs while keeping .cookies intact.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const fwdProto = (request.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim();
  const fwdHost  = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const internalUrl = new URL(request.url);
  const publicUrl   = `${fwdProto}://${fwdHost}${internalUrl.pathname}${internalUrl.search}`;

  const proxied = new Proxy(request, {
    get(target, prop) {
      if (prop === 'url') return publicUrl;
      const val = (target as unknown as Record<string, unknown>)[prop as string];
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });

  return handleOAuthCallback(proxied as NextRequest);
}
