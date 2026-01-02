/**
 * Server-side Auth API Routes
 *
 * These routes handle authentication server-side to avoid CORS issues.
 * Import these in your Next.js app's API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { resolveSupabasePublicConfig } from './index';

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function createRouteSupabaseClient(request: NextRequest) {
  const cookiesToSet: CookieToSet[] = [];
  const { supabaseUrl, supabaseAnonKey, storageKey, fetch } = resolveSupabasePublicConfig();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(newCookies) {
        cookiesToSet.push(...newCookies);
      },
    },
    auth: {
      storageKey,
    },
    global: {
      fetch,
    },
  });

  function applyCookies(response: NextResponse) {
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  }

  return { supabase, applyCookies };
}

/**
 * POST /api/auth/login
 * Handle email/password login server-side
 */
export async function handleLogin(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    const { supabase, applyCookies } = createRouteSupabaseClient(request);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      user: data.user,
      session: data.session,
    });
    applyCookies(response);

    return response;
  } catch (error: any) {
    console.error('[AUTH] Login error:', error);
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/signup
 * Handle user registration server-side
 * Automatically provisions user in Nextcloud after signup
 */
export async function handleSignup(request: NextRequest) {
  try {
    const { email, password, displayName } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    const { supabase, applyCookies } = createRouteSupabaseClient(request);

    // If a user is already logged in, sign them out first so the new signup
    // reliably results in a session for the newly created user (prevents
    // accidental actions under the previous account).
    try {
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        await supabase.auth.signOut();
      }
    } catch (_err) {
      // Best-effort; continue with signup.
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email.split('@')[0],
        },
      },
    });

    if (error) {
      console.error('[Signup] Auth error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 400 }
      );
    }

    console.log(`[Signup] User created: ${data.user.id} (${email})`);

    // Now provision in Nextcloud
    try {
      const { handleUserProvisioning } = await import('@elkdonis/services');
      const provisionResult = await handleUserProvisioning(
        data.user.id,
        email,
        displayName || email.split('@')[0]
      );

      if (!provisionResult.success) {
        console.warn(`[Signup] Nextcloud provisioning failed for ${email}:`, provisionResult.error);
        // Don't fail signup if Nextcloud provisioning fails
        // User can still use the app, just won't have Nextcloud access yet
      } else {
        console.log(`[Signup] ✅ Nextcloud provisioned for ${email}`);
      }
    } catch (provisionError) {
      console.error('[Signup] Provisioning error:', provisionError);
      // Again, don't fail signup
    }

    const response = NextResponse.json({
      user: data.user,
      session: data.session,
      message: 'Signup successful',
    });
    applyCookies(response);
    return response;
  } catch (error: any) {
    console.error('[Signup] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Signup failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/logout
 * Handle logout server-side
 */
export async function handleLogout(request: NextRequest) {
  try {
    const { supabase, applyCookies } = createRouteSupabaseClient(request);
    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const response = NextResponse.json({ message: 'Logged out' });
    applyCookies(response);

    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: error.message || 'Logout failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/session
 * Get current session server-side
 */
export async function handleGetSession(request: NextRequest) {
  try {
    const { supabase, applyCookies } = createRouteSupabaseClient(request);
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      return NextResponse.json({ user: null, session: null });
    }

    const response = NextResponse.json({
      user: data.session.user,
      session: data.session,
    });
    applyCookies(response);
    return response;
  } catch (error: any) {
    console.error('Get session error:', error);
    return NextResponse.json({ user: null, session: null });
  }
}
