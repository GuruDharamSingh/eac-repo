/**
 * Server-side Auth API Routes
 *
 * These routes handle authentication server-side to avoid CORS issues.
 * Import these in your Next.js app's API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { deriveCookieDomain, resolveSupabasePublicConfig } from './index';

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

  async function applyCookies(response: NextResponse) {
    const domain = await deriveCookieDomain(request.headers.get('host'));
    cookiesToSet.forEach(({ name, value, options }) => {
      const finalOpts = domain ? { ...options, domain } : options;
      response.cookies.set(name, value, finalOpts);
    });
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
    await applyCookies(response);

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
    const { email, password, displayName, interests, turnstileToken } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    // Verify Turnstile token if secret key is configured
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      if (!turnstileToken) {
        return NextResponse.json(
          { error: 'Bot verification required. Please complete the challenge.' },
          { status: 400 }
        );
      }
      const verifyRes = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body: new URLSearchParams({
            secret: turnstileSecret,
            response: turnstileToken,
          }),
        }
      );
      const verifyData = await verifyRes.json() as { success: boolean };
      if (!verifyData.success) {
        return NextResponse.json(
          { error: 'Bot verification failed. Please try again.' },
          { status: 403 }
        );
      }
    }

    const cleanInterests: string[] | undefined = Array.isArray(interests)
      ? interests.filter((i) => typeof i === 'string' && i.length > 0).slice(0, 12)
      : undefined;

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
          ...(cleanInterests && cleanInterests.length > 0
            ? { interests: cleanInterests }
            : {}),
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

    // Provision in Nextcloud
    try {
      const { handleUserProvisioning } = await import('@elkdonis/services');
      const provisionResult = await handleUserProvisioning(
        data.user.id,
        email,
        displayName || email.split('@')[0]
      );

      if (!provisionResult.success) {
        console.warn(`[Signup] Nextcloud provisioning failed for ${email}:`, provisionResult.error);
      } else {
        console.log(`[Signup] ✅ Nextcloud provisioned for ${email}`);
      }
    } catch (provisionError) {
      console.error('[Signup] Provisioning error:', provisionError);
    }

    // Assign to default orgs + create stub artist profile — all soft-fail
    try {
      const { db } = await import('@elkdonis/db');
      const resolvedName = displayName || email.split('@')[0];

      await db`
        INSERT INTO user_organizations (user_id, org_id, role, joined_at)
        VALUES
          (${data.user.id}, 'elkdonis',    'member', NOW()),
          (${data.user.id}, 'inner_group', 'member', NOW())
        ON CONFLICT (user_id, org_id) DO NOTHING
      `;

      await db`
        INSERT INTO artist_profiles (user_id, org_id, display_name, is_stub)
        VALUES (${data.user.id}, 'elkdonis', ${resolvedName}, true)
        ON CONFLICT (user_id) DO NOTHING
      `;

      console.log(`[Signup] ✅ Org memberships + stub profile created for ${email}`);
    } catch (dbError) {
      console.error('[Signup] DB post-signup error:', dbError);
    }

    // Send welcome email — soft-fail
    try {
      const { sendWelcomeEmail } = await import('@elkdonis/email');
      const resolvedName = displayName || email.split('@')[0];
      await sendWelcomeEmail(email, { displayName: resolvedName });
      console.log(`[Signup] ✅ Welcome email sent to ${email}`);
    } catch (emailError) {
      console.error('[Signup] Welcome email error:', emailError);
    }

    const response = NextResponse.json({
      user: data.user,
      session: data.session,
      message: 'Signup successful',
    });
    await applyCookies(response);
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
    await applyCookies(response);

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
    await applyCookies(response);
    return response;
  } catch (error: any) {
    console.error('Get session error:', error);
    return NextResponse.json({ user: null, session: null });
  }
}
