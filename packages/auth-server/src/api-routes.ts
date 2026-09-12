/**
 * Server-side Auth API Routes
 *
 * These routes handle authentication server-side to avoid CORS issues.
 * Import these in your Next.js app's API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { WelcomeEmailProps } from '@elkdonis/email';
import { deriveCookieDomain, resolveSupabasePublicConfig, getSupabaseServer } from './index';

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function cleanEditableEmailSettings(value: unknown): Partial<WelcomeEmailProps> {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const bodyText = typeof source.bodyText === 'string' && source.bodyText.trim()
    ? source.bodyText.trim()
    : undefined;
  const links = Array.isArray(source.links)
    ? source.links
        .map((item) => {
          const link = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            label: typeof link.label === 'string' ? link.label.trim() : '',
            url: typeof link.url === 'string' ? link.url.trim() : '',
          };
        })
        .filter((item) => item.label && item.url)
    : undefined;
  const media = Array.isArray(source.media)
    ? source.media
        .map((item) => {
          const mediaItem = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            url: typeof mediaItem.url === 'string' ? mediaItem.url.trim() : '',
            alt: typeof mediaItem.alt === 'string' ? mediaItem.alt.trim() : undefined,
            caption: typeof mediaItem.caption === 'string' ? mediaItem.caption.trim() : undefined,
          };
        })
        .filter((item) => item.url)
    : undefined;

  return { bodyText, links, media };
}

/**
 * Generates a real GoTrue email-confirmation link (not a custom token — reuses
 * Nextcloud's own verify/confirm flow, which marks auth.users.email_confirmed_at
 * natively). Landing back on `${publicOrigin}/feed?nc_connect=1` re-triggers the
 * same background-tab Nextcloud provisioning used for the Google-signup path —
 * confirming email is now the only trigger for Nextcloud sync, replacing the
 * immediate on-signup attempt.
 */
async function generateConfirmationLink(
  email: string,
  password: string,
  publicOrigin: string
): Promise<string | null> {
  try {
    const admin = getSupabaseServer();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: { redirectTo: `${publicOrigin}/feed?nc_connect=1` },
    });
    if (error || !data?.properties?.action_link) {
      console.error('[Signup] generateLink failed:', error?.message);
      return null;
    }
    return data.properties.action_link;
  } catch (err) {
    console.error('[Signup] generateConfirmationLink error:', err);
    return null;
  }
}

async function loadWelcomeEmailSettings(): Promise<Partial<WelcomeEmailProps>> {
  try {
    const { db } = await import('@elkdonis/db');
    const [row] = await db`
      SELECT config
      FROM email_template_settings
      WHERE org_id = 'inner_group' AND template_key = 'welcome'
    `;

    return cleanEditableEmailSettings(row?.config);
  } catch (error) {
    console.error('[Signup] Welcome email settings load error:', error);
    return {};
  }
}

/** Exported for handoff.ts, which installs a session the same way login does. */
export function createRouteSupabaseClient(request: NextRequest) {
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
export interface SignupOrgOptions {
  /**
   * Orgs the new user joins. Defaults to the EAC network
   * (elkdonis + inner_group) as `member`. Per-org apps (e.g. hiddenenneagram.com)
   * pass their own org so signups stay scoped to that group.
   */
  defaultOrgs?: { id: string; role: string }[];
}

export async function handleSignup(
  request: NextRequest,
  options: SignupOrgOptions = {}
) {
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

    // Nextcloud provisioning happens when the user confirms their email (see
    // the confirmation-link email below) — that's the one moment Nextcloud's
    // SSO account-creation gate can actually be passed (a live browser
    // session), so there's nothing to trigger here at signup time itself.

    // Assign to orgs + create a draft org_profiles row per org — all soft-fail
    try {
      const { db } = await import('@elkdonis/db');

      // Fallback for the multi-org sites (inner-gathering, arts-collective,
      // the blogs); every single-org site passes its own defaultOrgs.
      //
      // `elkdonis` used to be joined alongside inner_group — it was the
      // legacy Nextcloud group that inner-gathering hosted the collective
      // under. Under the EAC_Network model those people are inner_group
      // members, so signups no longer join elkdonis. Existing elkdonis rows
      // are left alone; every real person in them already holds inner_group.
      // A signup is a follower (viewer role), never a member: membership is
      // something an org grants. CENTER_PAGE_BRIEF_2026-09-09.md, decision 2.
      const defaultOrgs = options.defaultOrgs ?? [
        { id: 'inner_group', role: 'viewer' },
      ];

      for (const org of defaultOrgs) {
        await db`
          INSERT INTO user_organizations (user_id, org_id, role, joined_at)
          VALUES (${data.user.id}, ${org.id}, ${org.role}, NOW())
          ON CONFLICT (user_id, org_id) DO NOTHING
        `;
        // is_public defaults false — same "not on the roster until someone
        // publishes it" behaviour the old is_stub artist_profiles row had,
        // but per-org now instead of capped at one org for life. The
        // public.users row itself already exists (handle_new_user trigger,
        // migration 052), so there's no separate profile row for the
        // identity — just the org's publish switch.
        await db`
          INSERT INTO org_profiles (org_id, user_id)
          VALUES (${org.id}, ${data.user.id})
          ON CONFLICT (org_id, user_id) DO NOTHING
        `;
      }

      console.log(`[Signup] ✅ Org memberships + draft org profiles created for ${email}`);
    } catch (dbError) {
      console.error('[Signup] DB post-signup error:', dbError);
    }

    // Send welcome email (with the real confirm-email link as the primary CTA) — soft-fail
    try {
      const { sendWelcomeEmail } = await import('@elkdonis/email');
      const resolvedName = displayName || email.split('@')[0];
      const welcomeEmailSettings = await loadWelcomeEmailSettings();

      const fwdProto = (request.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim();
      const fwdHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
      const publicOrigin = `${fwdProto}://${fwdHost}`;
      const confirmUrl = await generateConfirmationLink(email, password, publicOrigin);

      await sendWelcomeEmail(email, {
        displayName: resolvedName,
        ...welcomeEmailSettings,
        // Confirming email is what triggers Nextcloud provisioning — this
        // link always wins over any org-customized welcome links.
        ...(confirmUrl
          ? { links: [{ label: 'Confirm Your Email', url: confirmUrl }] }
          : {}),
      });
      console.log(`[Signup] ✅ Welcome/confirmation email sent to ${email}`);
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

/**
 * GET /api/auth/callback
 *
 * Completes a Google (or any GoTrue external provider) PKCE OAuth flow.
 * GoTrue redirects here with ?code=<auth_code> after the provider auth.
 * The server reads the PKCE verifier from the `eac_pkce_cv` cookie, exchanges
 * the code for tokens via GoTrue's /token?grant_type=pkce endpoint, sets the
 * session cookies, then redirects to `eac_pkce_dest` (or /).
 */
export interface OAuthCallbackOptions {
  /**
   * Orgs a FRESH Google signup joins. Defaults to the EAC network
   * (elkdonis + inner_group), same as handleSignup's default — per-org apps
   * (e.g. ifac.com) pass their own org so a first-time Google sign-in scopes
   * to that group instead of the wider network.
   */
  defaultOrgs?: { id: string; role: string }[];
}

export async function handleOAuthCallback(
  request: NextRequest,
  options: OAuthCallbackOptions = {}
): Promise<NextResponse> {
  // Behind NPM the internal request.url is http://0.0.0.0:<port>/..., so we
  // rebuild the public origin from forwarded headers before any redirect.
  const fwdProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const fwdHost  = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const publicOrigin = `${fwdProto.split(',')[0].trim()}://${fwdHost}`;

  const redirect = (path: string) => NextResponse.redirect(`${publicOrigin}${path}`);

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');
  const oauthErrorDesc = url.searchParams.get('error_description');

  if (oauthError) {
    const msg = encodeURIComponent(oauthErrorDesc ?? oauthError);
    return redirect(`/login?error=${msg}`);
  }
  if (!code) {
    return redirect('/login?error=missing_code');
  }

  const verifier = request.cookies.get('eac_pkce_cv')?.value;
  if (!verifier) {
    return redirect('/login?error=missing_pkce_verifier');
  }

  // Exchange the auth code for tokens via GoTrue's PKCE endpoint.
  // Server-side SUPABASE_URL is the internal Docker URL (no /auth/v1 prefix on GoTrue).
  const gotrueBase = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!gotrueBase) {
    console.error('[oauth] SUPABASE_URL is not set');
    return redirect('/login?error=server_config');
  }

  let tokenData: { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
  try {
    const tokenRes = await fetch(`${gotrueBase}/token?grant_type=pkce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    });
    const raw = await tokenRes.text();
    console.log('[oauth] token exchange status:', tokenRes.status, 'body:', raw.slice(0, 300));
    tokenData = JSON.parse(raw) as typeof tokenData;
  } catch (err) {
    console.error('[oauth] PKCE token exchange fetch failed:', err);
    return redirect('/login?error=token_exchange_failed');
  }

  if (tokenData.error || !tokenData.access_token || !tokenData.refresh_token) {
    const msg = encodeURIComponent(tokenData.error_description ?? tokenData.error ?? 'auth_failed');
    console.error('[oauth] Token exchange error:', tokenData.error, tokenData.error_description);
    return redirect(`/login?error=${msg}`);
  }

  // Install the session in supabase-ssr cookies.
  const { supabase, applyCookies } = createRouteSupabaseClient(request);
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
  });
  if (sessionError) {
    console.error('[oauth] setSession error:', sessionError.message);
    return redirect('/login?error=session_failed');
  }

  // GoTrue sets created_at and last_sign_in_at to (near) the same instant
  // only on a brand-new account's very first session — a reliable "this is
  // a fresh signup" signal without a separate public.users lookup.
  const authUser = sessionData?.session?.user;
  const isNewSignup =
    !!authUser?.created_at &&
    !!authUser?.last_sign_in_at &&
    Math.abs(new Date(authUser.created_at).getTime() - new Date(authUser.last_sign_in_at).getTime()) < 10_000;

  // Fresh Google signup — mirror what handleSignup does for password signups
  // (org memberships, a stub profile, a welcome email). Google already
  // verifies the email, so there's no confirm-gate: Nextcloud sync fires
  // unconditionally below via nc_connect.
  if (isNewSignup && authUser?.email) {
    const resolvedName =
      (authUser.user_metadata?.display_name as string | undefined) ||
      (authUser.user_metadata?.full_name as string | undefined) ||
      (authUser.user_metadata?.name as string | undefined) ||
      authUser.email.split('@')[0];

    try {
      const { db } = await import('@elkdonis/db');
      // Fallback for the multi-org sites (inner-gathering, arts-collective,
      // the blogs); every single-org site passes its own defaultOrgs.
      //
      // `elkdonis` used to be joined alongside inner_group — it was the
      // legacy Nextcloud group that inner-gathering hosted the collective
      // under. Under the EAC_Network model those people are inner_group
      // members, so signups no longer join elkdonis. Existing elkdonis rows
      // are left alone; every real person in them already holds inner_group.
      // A signup is a follower (viewer role), never a member: membership is
      // something an org grants. CENTER_PAGE_BRIEF_2026-09-09.md, decision 2.
      const defaultOrgs = options.defaultOrgs ?? [
        { id: 'inner_group', role: 'viewer' },
      ];
      for (const org of defaultOrgs) {
        await db`
          INSERT INTO user_organizations (user_id, org_id, role, joined_at)
          VALUES (${authUser.id}, ${org.id}, ${org.role}, NOW())
          ON CONFLICT (user_id, org_id) DO NOTHING
        `;
        await db`
          INSERT INTO org_profiles (org_id, user_id)
          VALUES (${org.id}, ${authUser.id})
          ON CONFLICT (org_id, user_id) DO NOTHING
        `;
      }
      console.log(`[oauth] ✅ Org memberships + draft org profiles created for ${authUser.email}`);
    } catch (dbError) {
      console.error('[oauth] DB post-signup error:', dbError);
    }

    try {
      const { sendWelcomeEmail } = await import('@elkdonis/email');
      const welcomeEmailSettings = await loadWelcomeEmailSettings();
      await sendWelcomeEmail(authUser.email, { displayName: resolvedName, ...welcomeEmailSettings });
      console.log(`[oauth] ✅ Welcome email sent to ${authUser.email}`);
    } catch (emailError) {
      console.error('[oauth] Welcome email error:', emailError);
    }
  }

  const rawDest = request.cookies.get('eac_pkce_dest')?.value;
  // Default new signups to /feed (inside the (app) layout, where the
  // nc_connect handler is actually mounted) instead of the marketing root —
  // landing on "/" silently drops nc_connect since that page doesn't render it.
  const dest = rawDest ? decodeURIComponent(rawDest) : isNewSignup ? '/feed' : '/';
  const destUrl = new URL(dest.startsWith('http') ? dest : `${publicOrigin}${dest}`);
  if (isNewSignup) {
    destUrl.searchParams.set('nc_connect', '1');
  }

  const response = NextResponse.redirect(destUrl.toString());
  response.cookies.set('eac_pkce_cv', '', { maxAge: 0, path: '/' });
  response.cookies.set('eac_pkce_dest', '', { maxAge: 0, path: '/' });
  await applyCookies(response);
  return response;
}
