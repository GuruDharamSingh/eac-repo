/**
 * Server-side Auth API Routes
 *
 * These routes handle authentication server-side to avoid CORS issues.
 * Import these in your Next.js app's API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from './index';
import { db } from '@elkdonis/db';

/**
 * POST /api/auth/login
 * Handle email/password login server-side
 */
export async function handleLogin(request: NextRequest) {
  try {
    console.log('[AUTH] Login request received');
    console.log('[AUTH] Environment check:', {
      supabaseUrl: process.env.SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    });

    const body = await request.text();
    console.log('[AUTH] Raw request body:', body);

    const { email, password } = JSON.parse(body);
    console.log('[AUTH] Parsed credentials:', { email, passwordLength: password?.length });

    if (!email || !password) {
      console.log('[AUTH] Missing email or password');
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    console.log('[AUTH] Creating Supabase client...');
    const supabase = getSupabaseServer();

    console.log('[AUTH] Calling Supabase signInWithPassword...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log('[AUTH] Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    console.log('[AUTH] Login successful:', { userId: data.user?.id });

    if (!data.session) {
      return NextResponse.json(
        { error: 'No session created' },
        { status: 401 }
      );
    }

    // Create response with session
    const response = NextResponse.json({
      user: data.user,
      session: data.session,
    });

    // Set session cookie
    response.cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: data.session.expires_in,
    });

    response.cookies.set('sb-refresh-token', data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('[AUTH] Login error:', error);
    console.error('[AUTH] Error stack:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/signup
 * Handle user registration server-side
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

    const supabase = getSupabaseServer();

    // Create auth user
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

    // Create database user record
    await db`
      INSERT INTO users (
        id,
        email,
        display_name,
        nextcloud_synced
      ) VALUES (
        ${data.user.id},
        ${email},
        ${displayName || email.split('@')[0]},
        false
      )
      ON CONFLICT (id) DO NOTHING
    `;

    return NextResponse.json({
      user: data.user,
      message: 'Signup successful',
    });
  } catch (error: any) {
    console.error('Signup error:', error);
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
    const supabase = getSupabaseServer();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Clear cookies
    const response = NextResponse.json({ message: 'Logged out' });
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');

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
    const accessToken = request.cookies.get('sb-access-token')?.value;
    const refreshToken = request.cookies.get('sb-refresh-token')?.value;

    if (!accessToken) {
      return NextResponse.json({ user: null, session: null });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      // Try to refresh if we have a refresh token
      if (refreshToken) {
        const { data: refreshData, error: refreshError } =
          await supabase.auth.refreshSession({ refresh_token: refreshToken });

        if (refreshError || !refreshData.session) {
          return NextResponse.json({ user: null, session: null });
        }

        // Update cookies with new tokens
        const response = NextResponse.json({
          user: refreshData.user,
          session: refreshData.session,
        });

        response.cookies.set('sb-access-token', refreshData.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: refreshData.session.expires_in,
        });

        return response;
      }

      return NextResponse.json({ user: null, session: null });
    }

    return NextResponse.json({
      user: data.user,
    });
  } catch (error: any) {
    console.error('Get session error:', error);
    return NextResponse.json({ user: null, session: null });
  }
}
