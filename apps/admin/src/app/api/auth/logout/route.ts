import { handleLogout } from '@elkdonis/auth-server';
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@elkdonis/auth-server';

export const POST = handleLogout;

// Support GET for OIDC logout flows (Nextcloud sociallogin uses GET)
export async function GET(req: NextRequest) {
  const supabase = await getServerAuth();
  await supabase.auth.signOut();
  
  // Check for post_logout_redirect_uri
  const redirectUri = req.nextUrl.searchParams.get('post_logout_redirect_uri');
  
  if (redirectUri) {
    return NextResponse.redirect(redirectUri);
  }
  
  // Default redirect to home
  return NextResponse.redirect(new URL('/', req.nextUrl.origin));
}
