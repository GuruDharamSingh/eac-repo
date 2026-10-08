/**
 * Device tokens: how the network's own apps sign in (migrations 194, 197).
 *
 * A person already signed in on the web links a device (elastrocal
 * /link-device), which mints a token and hands it to the app through its URL
 * scheme. The app sends `Authorization: Bearer eacd_…` on every request.
 *
 * A token is scoped to the app it was linked for: getServerSession accepts it
 * only when the caller passes that app as `deviceApp` (today only elastrocal's
 * getViewer, for 'jerusalem'), and elastrocal's proxy accepts it only on
 * /api/mobile/. Every other app on the network treats it as no session.
 *
 * Only the SHA-256 of a token is stored. A token expires after
 * DEVICE_TOKEN_IDLE_DAYS without use (each use, noted at most hourly, pushes
 * the expiry forward) and in any case DEVICE_TOKEN_MAX_DAYS after it was
 * minted. The app keeps itself linked by exchanging its token for a new one
 * (POST /api/mobile/v1/token); once a token has lapsed, the person links the
 * device again. Revoking sets revoked_at. Browsers never send this header by
 * themselves, so accepting it adds no cross-site request risk.
 */

import { createHash, randomBytes } from 'node:crypto';
import { headers } from 'next/headers';

export const DEVICE_TOKEN_PREFIX = 'eacd_';
export const DEVICE_TOKEN_IDLE_DAYS = 30;
export const DEVICE_TOKEN_MAX_DAYS = 180;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const newToken = () => DEVICE_TOKEN_PREFIX + randomBytes(32).toString('base64url');

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
  const token = newToken();
  await db`
    INSERT INTO device_tokens (user_id, app, label, token_hash, expires_at)
    VALUES (${userId}, ${app}, ${label.slice(0, 80)}, ${hashToken(token)},
            now() + make_interval(days => ${DEVICE_TOKEN_IDLE_DAYS}))
  `;
  return token;
}

export interface DeviceTokenRow {
  id: string;
  app: string;
  label: string;
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date;
}

export async function listDeviceTokens(userId: string): Promise<DeviceTokenRow[]> {
  const { db } = await import('@elkdonis/db');
  return db<DeviceTokenRow[]>`
    SELECT id, app, label, created_at, last_used_at, expires_at
    FROM device_tokens
    WHERE user_id = ${userId} AND revoked_at IS NULL AND expires_at > now()
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

/** The device token on this request, or null when there is none. */
async function requestDeviceToken(): Promise<string | null> {
  let authorization: string | null = null;
  try {
    authorization = (await headers()).get('authorization');
  } catch {
    return null; // outside a request scope
  }
  if (!authorization?.startsWith(`Bearer ${DEVICE_TOKEN_PREFIX}`)) return null;
  return authorization.slice('Bearer '.length).trim();
}

/** Revoke the token this request carries (the app's "Unlink"). */
export async function revokeRequestDeviceToken(): Promise<boolean> {
  const token = await requestDeviceToken();
  if (!token) return false;
  const { db } = await import('@elkdonis/db');
  const rows = await db`
    UPDATE device_tokens SET revoked_at = now()
    WHERE token_hash = ${hashToken(token)} AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Exchange the live token this request carries for a new one for the same
 * user, app and device, and revoke the old one. Returns null when the token
 * is missing, for another app, revoked or expired (the device must be linked
 * again).
 */
export async function refreshRequestDeviceToken(app: string): Promise<{ token: string; expiresAt: Date } | null> {
  const token = await requestDeviceToken();
  if (!token) return null;
  const { db } = await import('@elkdonis/db');
  const fresh = newToken();
  const rows = await db.begin(async (tx) => {
    const [old] = await tx<{ id: string; user_id: string; label: string }[]>`
      UPDATE device_tokens SET revoked_at = now()
      WHERE token_hash = ${hashToken(token)} AND app = ${app}
        AND revoked_at IS NULL AND expires_at > now()
      RETURNING id, user_id, label
    `;
    if (!old) return [];
    return tx<{ expires_at: Date }[]>`
      INSERT INTO device_tokens (user_id, app, label, token_hash, expires_at)
      VALUES (${old.user_id}, ${app}, ${old.label}, ${hashToken(fresh)},
              now() + make_interval(days => ${DEVICE_TOKEN_IDLE_DAYS}))
      RETURNING expires_at
    `;
  });
  const [row] = rows as { expires_at: Date }[];
  return row ? { token: fresh, expiresAt: row.expires_at } : null;
}

/**
 * The user behind this request's device token.
 *   undefined: no device token on the request (fall through to cookies)
 *   null:      a device token that is unknown, revoked, expired, or linked
 *              for an app other than `app` (or `app` not given)
 */
export async function deviceTokenUser(app?: string): Promise<DeviceTokenUser | null | undefined> {
  const token = await requestDeviceToken();
  if (!token) return undefined;
  if (!app) return null;

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
      WHERE t.token_hash = ${hashToken(token)} AND t.app = ${app}
        AND t.revoked_at IS NULL AND t.expires_at > now()
    `;
  } catch (err) {
    console.error('[auth-server] device token lookup failed', err);
    return null;
  }
  if (!row) return null;

  // Note use at most hourly, sliding the idle expiry forward up to the hard
  // limit; never block the request on it.
  db`
    UPDATE device_tokens
    SET last_used_at = now(),
        expires_at = least(now() + make_interval(days => ${DEVICE_TOKEN_IDLE_DAYS}),
                           created_at + make_interval(days => ${DEVICE_TOKEN_MAX_DAYS}))
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
