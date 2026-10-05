/**
 * Device tokens: how the network's own apps sign in (migration 194).
 *
 * A person already signed in on the web links a device (elastrocal
 * /link-device), which mints a token and hands it to the app through its URL
 * scheme. The app sends `Authorization: Bearer eacd_…` on every request and
 * getServerSession accepts it in place of a session cookie, so existing routes
 * need no change to serve the app.
 *
 * Only the SHA-256 of a token is stored. A token never expires on its own; it
 * is revoked by setting revoked_at. Browsers never send this header by
 * themselves, so accepting it adds no cross-site request risk.
 */

import { createHash, randomBytes } from 'node:crypto';
import { headers } from 'next/headers';

export const DEVICE_TOKEN_PREFIX = 'eacd_';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface DeviceTokenUser {
  id: string;
  auth_user_id: string;
  db_user_id: string;
  email: string;
  nextcloud_user_id?: string;
  nextcloud_app_password?: string;
}

/** Mint a token for a user and device. The token is returned once and never stored. */
export async function createDeviceToken(userId: string, app: string, label: string): Promise<string> {
  const { db } = await import('@elkdonis/db');
  const token = DEVICE_TOKEN_PREFIX + randomBytes(32).toString('base64url');
  await db`
    INSERT INTO device_tokens (user_id, app, label, token_hash)
    VALUES (${userId}, ${app}, ${label.slice(0, 80)}, ${hashToken(token)})
  `;
  return token;
}

export interface DeviceTokenRow {
  id: string;
  app: string;
  label: string;
  created_at: Date;
  last_used_at: Date | null;
}

export async function listDeviceTokens(userId: string): Promise<DeviceTokenRow[]> {
  const { db } = await import('@elkdonis/db');
  return db<DeviceTokenRow[]>`
    SELECT id, app, label, created_at, last_used_at
    FROM device_tokens
    WHERE user_id = ${userId} AND revoked_at IS NULL
    ORDER BY created_at DESC
  `;
}

export async function revokeDeviceToken(userId: string, id: string): Promise<boolean> {
  const { db } = await import('@elkdonis/db');
  const rows = await db`
    UPDATE device_tokens SET revoked_at = now()
    WHERE id = ${id} AND user_id = ${userId} AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

/** Revoke the token this request carries (the app's "Unlink"). */
export async function revokeRequestDeviceToken(): Promise<boolean> {
  let authorization: string | null = null;
  try {
    authorization = (await headers()).get('authorization');
  } catch {
    return false;
  }
  if (!authorization?.startsWith(`Bearer ${DEVICE_TOKEN_PREFIX}`)) return false;
  const { db } = await import('@elkdonis/db');
  const rows = await db`
    UPDATE device_tokens SET revoked_at = now()
    WHERE token_hash = ${hashToken(authorization.slice('Bearer '.length).trim())} AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * The user behind this request's device token.
 *   undefined: no device token on the request (fall through to cookies)
 *   null:      a device token that is unknown or revoked
 */
export async function deviceTokenUser(): Promise<DeviceTokenUser | null | undefined> {
  let authorization: string | null = null;
  try {
    authorization = (await headers()).get('authorization');
  } catch {
    return undefined; // outside a request scope
  }
  if (!authorization?.startsWith(`Bearer ${DEVICE_TOKEN_PREFIX}`)) return undefined;
  const token = authorization.slice('Bearer '.length).trim();

  const { db } = await import('@elkdonis/db');
  type Row = {
    token_id: string;
    id: string;
    auth_user_id: string | null;
    email: string | null;
    nextcloud_user_id: string | null;
    nextcloud_app_password: string | null;
  };
  let row: Row | undefined;
  try {
    [row] = await db<Row[]>`
      SELECT t.id AS token_id, u.id, u.auth_user_id, u.email, u.nextcloud_user_id, u.nextcloud_app_password
      FROM device_tokens t
      JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ${hashToken(token)} AND t.revoked_at IS NULL
    `;
  } catch (err) {
    console.error('[auth-server] device token lookup failed', err);
    return null;
  }
  if (!row) return null;

  // Note use at most hourly; never block the request on it.
  db`
    UPDATE device_tokens SET last_used_at = now()
    WHERE id = ${row.token_id} AND (last_used_at IS NULL OR last_used_at < now() - interval '1 hour')
  `.catch(() => {});

  return {
    id: row.auth_user_id ?? row.id,
    auth_user_id: row.auth_user_id ?? row.id,
    db_user_id: row.id,
    email: row.email ?? '',
    nextcloud_user_id: row.nextcloud_user_id ?? undefined,
    nextcloud_app_password: row.nextcloud_app_password ?? undefined,
  };
}
