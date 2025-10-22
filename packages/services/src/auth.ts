import { createClient } from '@supabase/supabase-js';
import { db } from '@elkdonis/db';
import type { User } from '@elkdonis/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Create a new user with Supabase auth and database record
 */
export async function createUser(
  email: string,
  password: string,
  displayName: string,
  orgId?: string
): Promise<User | null> {
  try {
    // Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError);
      return null;
    }

    // Create database user record
    const [user] = await db`
      INSERT INTO users (
        id,
        email,
        display_name,
        org_id,
        role,
        status
      ) VALUES (
        ${authData.user.id},
        ${email},
        ${displayName},
        ${orgId || null},
        'member',
        'active'
      )
      RETURNING *
    `;

    return mapUserFromDb(user);
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const [user] = await db`
    SELECT u.*, o.name as org_name
    FROM users u
    LEFT JOIN organizations o ON u.org_id = o.id
    WHERE u.id = ${id}
  `;

  return user ? mapUserFromDb(user) : null;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const [user] = await db`
    SELECT u.*, o.name as org_name
    FROM users u
    LEFT JOIN organizations o ON u.org_id = o.id
    WHERE u.email = ${email}
  `;

  return user ? mapUserFromDb(user) : null;
}

/**
 * Update user profile
 */
export async function updateUser(
  id: string,
  data: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    orgId?: string;
  }
): Promise<User | null> {
  const updates: any = {};

  if (data.displayName !== undefined) updates.display_name = data.displayName;
  if (data.bio !== undefined) updates.bio = data.bio;
  if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl;
  if (data.orgId !== undefined) updates.org_id = data.orgId;

  const [user] = await db`
    UPDATE users
    SET ${db(updates)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return user ? mapUserFromDb(user) : null;
}

/**
 * Get users by organization
 */
export async function getUsersByOrg(orgId: string): Promise<User[]> {
  const users = await db`
    SELECT * FROM users
    WHERE org_id = ${orgId}
      AND status = 'active'
    ORDER BY display_name
  `;

  return users.map(mapUserFromDb);
}

/**
 * Map database row to User type
 */
function mapUserFromDb(row: any): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio || undefined,
    isAdmin: row.is_admin ?? false,
    nextcloudUserId: row.nextcloud_user_id || undefined,
    nextcloudSynced: row.nextcloud_synced ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    organizations: undefined,
    meetings: undefined,
    meetingAttendances: undefined,
  };
}
