/**
 * Server-side Auth API Routes
 *
 * These routes handle authentication server-side to avoid CORS issues.
 * Import these in your Next.js app's API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { deriveCookieDomain, resolveSupabasePublicConfig, getSupabaseServer } from './index';

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};


/**
 * Generates a real GoTrue action link and returns it — `generateLink` does NOT
 * send anything, which is why the address arrives inside our own welcome email
 * rather than as a second, plainer message from GoTrue. There is no separate
 * Supabase confirmation email to reconcile: `GOTRUE_MAILER_AUTOCONFIRM` is
 * true and no SMTP credentials are set, so GoTrue's mailer is off entirely.
 *
 * Two things this comment used to claim, which are not true as of 2026-09-16:
 *
 *  - "marks auth.users.email_confirmed_at natively" — AUTOCONFIRM already
 *    does that at creation. All 23 accounts in the database were confirmed
 *    within a second of being created. So clicking the link confirms nothing;
 *    what it actually does is establish a session and land the person in the
 *    app, which is still worth doing but is not what the button said.
 *
 *  - "re-triggers the background-tab Nextcloud provisioning" — the only
 *    handler for `?nc_connect=1` lives in apps/inner-gathering, the retired
 *    app. Nothing in apps/innergathering reads it, and `/feed` is not a route
 *    there (the segment is `[feed]`, for org feeds), so the link 404s. On the
 *    live site both /feed and /general return 404 while /center returns 200.
 *    **Nextcloud provisioning is therefore not being triggered by signup at
 *    all** — that needs a handler in the current app, which is its own piece
 *    of work and is not fixed here.
 *
 * The landing path is now a parameter defaulting to the origin root, which
 * every app has. Pass something better where something better exists.
 */
async function generateConfirmationLink(
  email: string,
  password: string,
  publicOrigin: string,
  landingPath = '/'
): Promise<string | null> {
  try {
    const admin = getSupabaseServer();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: { redirectTo: `${publicOrigin}${landingPath}` },
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

// The welcome email's per-org copy used to be loaded here with `org_id` as a
// hardcoded 'inner_group' literal, so whichever organisation someone signed up
// to, they received inner_group's words. That resolution now lives in
// @elkdonis/email's template store, which picks the right org and also handles
// the layer this file never knew about (an org that laid the email out itself
// in the newsletter editor). Passing `orgId` to sendWelcomeEmail is all that is
// needed — see renderWithOverrides.

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
  /**
   * Where the welcome email's button lands. Defaults to the origin root
   * because that is the only path every app is guaranteed to serve — the
   * previous default, `/feed?nc_connect=1`, 404s on the live site.
   */
  postSignupPath?: string;
}

export async function handleSignup(
  request: NextRequest,
  options: SignupOrgOptions = {}
) {
  try {
    const { email, password, displayName, interests, turnstileToken } = await request.json();

    // The organisation the account is being created with. Declared out here so
    // the welcome email below can name it, resolve its copy and send under its
    // identity — the membership loop that sets it runs in its own try block.
    let signupOrgId: string | undefined;

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
      signupOrgId = defaultOrgs[0]?.id;

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

      const fwdProto = (request.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim();
      const fwdHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
      const publicOrigin = `${fwdProto}://${fwdHost}`;
      const confirmUrl = await generateConfirmationLink(
        email,
        password,
        publicOrigin,
        options.postSignupPath ?? '/'
      );

      await sendWelcomeEmail(email, {
        displayName: resolvedName,
        email,
        orgId: signupOrgId,
        // Confirming email is what triggers Nextcloud provisioning, so the
        // template renders this as its primary button regardless of what else
        // the org has configured.
        ...(confirmUrl ? { confirmUrl } : {}),
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
  /**
   * Where the welcome email's button lands. Defaults to the origin root
   * because that is the only path every app is guaranteed to serve — the
   * previous default, `/feed?nc_connect=1`, 404s on the live site.
   */
  postSignupPath?: string;
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

  // A route handler builds its own URLs, so Next's `basePath` does not apply
  // here the way it does to `redirect()` in a page. An app served under a
  // sub-path (see NEXT_PUBLIC_BASE_PATH) would otherwise send every OAuth
  // error to `<domain>/login` — on a shared domain, a DIFFERENT app's login.
  // Empty for every app that owns its domain, so nothing else changes.
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const redirect = (path: string) => NextResponse.redirect(`${publicOrigin}${basePath}${path}`);

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

    // Declared out here so the welcome email below can name the organisation
    // the account was created with — the membership loop runs in its own try
    // block, and a database hiccup there should not also cost the email its
    // sender identity.
    const defaultOrgs = options.defaultOrgs ?? [
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
      { id: 'inner_group', role: 'viewer' },
    ];

    try {
      const { db } = await import('@elkdonis/db');
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
      // No confirmUrl: Google has already verified the address, so there is
      // nothing to confirm. The template falls back to its own portal link —
      // which is why that default must not be a host that no longer resolves.
      await sendWelcomeEmail(authUser.email, {
        displayName: resolvedName,
        email: authUser.email,
        orgId: defaultOrgs[0]?.id,
      });
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
