'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerAuth } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';

export interface BlogConfig {
  orgId: string;
  orgName: string;
  ownerEmails?: string[];
  ownerUserIds?: string[];
  ownerRoles?: Array<'guide' | 'member' | 'viewer'>;
}

export interface BlogAuthContext {
  supabaseUser: {
    id: string;
    email: string | null;
  };
  appUserId: string;
  role: string | null;
}

export async function requireBlogOwner(config: BlogConfig): Promise<BlogAuthContext> {
  const supabase = getServerAuth(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const authEmail = user.email?.toLowerCase() ?? null;
  const ownerEmails = (config.ownerEmails || []).map((email) => email.toLowerCase());
  const ownerIds = config.ownerUserIds || [];

  let membershipRole: string | null = null;

  const isOwnerByConfig =
    (authEmail && ownerEmails.includes(authEmail)) || ownerIds.includes(user.id);

  if (!isOwnerByConfig) {
    const memberships = await db`
      SELECT role
      FROM user_organizations
      WHERE user_id = ${user.id}
        AND org_id = ${config.orgId}
      LIMIT 1
    `;

    if (!memberships.length) {
      redirect('/login?message=unauthorized');
    }

    membershipRole = memberships[0].role;

    if (config.ownerRoles?.length && !config.ownerRoles.includes(membershipRole as any)) {
      redirect('/login?message=unauthorized');
    }
  }

  await ensureAppUserRecord(user.id, authEmail);

  return {
    supabaseUser: {
      id: user.id,
      email: authEmail,
    },
    appUserId: user.id,
    role: membershipRole,
  };
}

async function ensureAppUserRecord(userId: string, email: string | null) {
  // Check if user exists by Supabase ID only (Supabase is source of truth)
  const existing = await db`
    SELECT id
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  if (existing.length) {
    return; // User already exists
  }

  // Create new user record with Supabase-provided ID
  await db`
    INSERT INTO users (id, email, display_name)
    VALUES (${userId}, ${email}, ${email ?? 'Blog Author'})
    ON CONFLICT (id) DO NOTHING
  `;
}
