import { db } from '@elkdonis/db';
import { EMAIL_FONTS } from './components/EmailShell';
import type { EmailChrome } from './components/EmailShell';

// ============================================================================
// Who an organisation is, when it sends mail.
//
// Every app on this network used to answer that question from environment
// variables, in five different naming conventions (EAC_OWNER_EMAIL,
// AMRIT_CANADA_OWNER_EMAIL, NEXT_PUBLIC_IFAC_OWNER_EMAIL, ...), and none of
// them covered the From address at all — so IFAC's mail went out named
// "Elkdonis Arts Collective". Identity is per-organisation data, so it lives
// in `site_config` under the key `email:identity`, the same per-org key/value
// table Puck pages and newsletters use. No migration needed, and one org can
// never read another's because org_id is half the primary key.
// ============================================================================

export const EMAIL_IDENTITY_KEY = 'email:identity';

export type EmailKind =
  | 'rsvp'
  | 'reminder'
  | 'newsletter'
  | 'notification'
  | 'welcome'
  | 'contact'
  | 'order';

export interface OrgEmailIdentity {
  orgId: string;
  /** Envelope/header From. Always on an authenticated domain — see below. */
  fromEmail: string;
  /** The name a recipient actually reads. Free to be the org's own, today. */
  fromName: string;
  /** Where a human reply lands. Free to be the org's own address, today. */
  replyTo?: string;
  /** Who gets owner notifications (RSVPs, contact forms). */
  ownerEmails: string[];
  /** SendGrid ASM group, so an unsubscribe from this org is scoped to it. */
  asmGroupId?: number;
  /** Prefix for SendGrid categories, so stats split per org. */
  categoryPrefix: string;
  /**
   * The org's own accent, used for its name in the email header once it sends
   * from its own domain. A hex colour; anything else is ignored rather than
   * passed through into a style attribute.
   */
  accentColor?: string;
  /**
   * The org's palette for its own mail. Three roles, because an email is a
   * dark card on a light page and one colour cannot carry it: `accent` is the
   * org's colour, `onAccent` the ink that sits ON it, `ink` the body text.
   * Every value is a literal hex or absent — these land in style attributes.
   *
   * Absent means the network's gold-and-navy house style, which is the right
   * default: an org that has never chosen a colour should look like it belongs
   * to the collective, not like a broken stylesheet.
   */
  palette?: EmailPalette;
  /**
   * Whether replies to this org's mail are routed into its hub inbox rather
   * than to a person's own address.
   *
   * Off by default and deliberately so: turning it on silently redirects mail
   * that someone is currently receiving in Gmail, and that is a decision for
   * the org to make rather than one to inherit.
   */
  inboundReplies: boolean;
  /**
   * False when `fromEmail` fell back to the network default because the org's
   * own domain is not authenticated yet. Surfaced so an admin screen can say
   * so rather than leaving someone to wonder why their setting did nothing.
   */
  fromIsOrgDomain: boolean;
}

/** An org's three colour roles for email. See `OrgEmailIdentity.palette`. */
export interface EmailPalette {
  /** The org's colour: rules, the header name, button fills. */
  accent?: string;
  /** Ink that sits ON the accent. Must clear 4.5:1 against it. */
  onAccent?: string;
  /** Body text on the card. */
  ink?: string;
  /**
   * Which body face this org's mail is set in, by id — see EMAIL_FONTS.
   *
   * An ID, never a stack. The value beside it is a hex allow-list for exactly
   * this reason: both land in a `style` attribute, so the code owns every
   * string that can appear there and the org picks one by name.
   */
  bodyFont?: string;
  /**
   * The org's own masthead image, shown at the top of every letter instead of
   * the collective's navy-and-gold wordmark.
   *
   * An absolute `https://` URL and nothing else — see `sanitizeBanner`. It is
   * normally the same image the org's website leads with, which is the point:
   * a letter and the site it came from should be recognisably one thing.
   */
  bannerUrl?: string;
  /** Alt text for the banner, for the inboxes that block images. */
  bannerAlt?: string;
  /** The rule around the card. Hex; absent means the collective's gold. */
  frameColor?: string;
  /** Its thickness, 1–4px. Absent means 1. */
  frameWidth?: number;
}

/** The shape stored in site_config — every field optional, all overrides. */
interface StoredIdentity {
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  ownerEmails?: string[];
  asmGroupId?: number;
  accentColor?: string;
  palette?: EmailPalette;
  inboundReplies?: boolean;
}

/** Only a literal hex colour. This value lands in a style attribute. */
const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

/**
 * Only an absolute https URL with no quote, angle bracket or whitespace in it.
 *
 * This value lands in a `src` attribute in HTML that is mailed out, so the
 * same posture as the hex allow-list above: an allow-list, not an escape.
 * `https` and not `http` because a mail client that is willing to load an
 * image over plain HTTP from inside a letter is a mail client showing the
 * reader a mixed-content warning at best.
 */
const IMAGE_URL = /^https:\/\/[^\s"'<>]+$/i;

function sanitizeBanner(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const url = value.trim();
  return IMAGE_URL.test(url) ? url : undefined;
}

/**
 * Keep only literal hex values, drop everything else.
 *
 * Not a validation nicety: every one of these is interpolated into a `style`
 * attribute in an email template. `red; background:url(javascript:…)` is the
 * shape of the problem, and an allow-list of one regex is the whole defence.
 * A dropped value falls back to the house palette rather than failing.
 */
function sanitizePalette(input: EmailPalette | undefined): EmailPalette | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const out: EmailPalette = {};
  for (const role of ['accent', 'onAccent', 'ink'] as const) {
    const value = input[role];
    if (typeof value === 'string' && HEX.test(value.trim())) out[role] = value.trim();
  }
  // Checked against the registry rather than pattern-matched: an id is only
  // meaningful if it names a stack we ship, and an unknown one falls back to
  // the default face rather than reaching a style attribute.
  const font = typeof input.bodyFont === 'string' ? input.bodyFont.trim() : '';
  if (font && font in EMAIL_FONTS) out.bodyFont = font;

  // The masthead image and the frame around the card. Same posture as the
  // three colours above: anything that does not pass is dropped, and a
  // dropped value falls back to the house style rather than failing the save.
  const banner = sanitizeBanner(input.bannerUrl);
  if (banner) out.bannerUrl = banner;
  const alt = typeof input.bannerAlt === 'string' ? input.bannerAlt.trim().slice(0, 140) : '';
  if (alt) out.bannerAlt = alt;
  if (typeof input.frameColor === 'string' && HEX.test(input.frameColor.trim())) {
    out.frameColor = input.frameColor.trim();
  }
  const width = Number(input.frameWidth);
  if (Number.isInteger(width) && width >= 1 && width <= 4) out.frameWidth = width;

  return Object.keys(out).length ? out : undefined;
}

// ── The authenticated-domain guard ──────────────────────────────────────────

/**
 * Sending domains that have completed SPF+DKIM authentication in SendGrid.
 *
 * This guard exists because of a real, verified trap. As of 2026-09-16 the
 * SendGrid account has exactly ONE valid authenticated domain
 * (em6860.elkdonis-arts.org); ifacgroup.com, amritcanada.ca and
 * hiddenenneagram.com have none. Setting `From: info@ifacgroup.com` before
 * that domain is authenticated does not merely look wrong — it fails SPF and
 * DKIM, and Gmail and Yahoo now reject unauthenticated mail outright. That is
 * strictly worse than the wrong-but-aligned sender we have today.
 *
 * So a From address on an unauthenticated domain is refused and falls back,
 * loudly. Add each domain here (via the env var) as its DNS is completed.
 */
function authenticatedDomains(): string[] {
  const configured = (process.env.EMAIL_AUTHENTICATED_DOMAINS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  // The domain of EMAIL_FROM is authenticated by definition — it is the
  // address the account was set up to send from.
  const fallbackDomain = networkFromEmail().split('@')[1]?.toLowerCase();
  if (fallbackDomain && !configured.includes(fallbackDomain)) {
    configured.push(fallbackDomain);
  }
  return configured;
}

function isAuthenticatedSender(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return authenticatedDomains().some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`)
  );
}

function networkFromEmail(): string {
  return process.env.EMAIL_FROM ?? 'info@em6860.elkdonis-arts.org';
}

// ── Owner addresses: the env names that already exist ───────────────────────

/**
 * Per-org owner addresses were env vars before this file existed, and some of
 * them are still the only place the address is written down. Read them as a
 * fallback so nothing regresses on the day this ships; a site_config value
 * overrides them, and once every org has one these can be deleted.
 */
const LEGACY_OWNER_ENV: Record<string, string[]> = {
  ifac: ['NEXT_PUBLIC_IFAC_OWNER_EMAIL', 'IFAC_OWNER_EMAIL'],
  amrit_canada: ['AMRIT_CANADA_OWNER_EMAIL'],
  inner_group: ['INNERGATHERING_OWNER_EMAIL', 'EAC_OWNER_EMAIL'],
  elkdonis: ['EAC_OWNER_EMAIL'],
  danamccool: ['NEXT_PUBLIC_DANAMCCOOL_OWNER_EMAIL'],
};

function legacyOwnerEmails(orgId: string): string[] {
  for (const name of LEGACY_OWNER_ENV[orgId] ?? []) {
    const value = process.env[name];
    if (value) return [value];
  }
  const generic = process.env.EAC_OWNER_EMAIL;
  return generic ? [generic] : [];
}

// ── Resolution ──────────────────────────────────────────────────────────────

/**
 * Cached per process. Identity changes when someone edits an admin screen,
 * which is rare; a send hitting the database for it every time is not.
 */
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; identity: OrgEmailIdentity }>();

export function clearEmailIdentityCache(orgId?: string): void {
  if (orgId) cache.delete(orgId);
  else cache.clear();
}

export async function getOrgEmailIdentity(orgId: string): Promise<OrgEmailIdentity> {
  const hit = cache.get(orgId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.identity;

  let stored: StoredIdentity = {};
  let orgName: string | null = null;

  try {
    const [row] = await db<Array<{ value: StoredIdentity | null; name: string | null }>>`
      SELECT sc.value, o.name
      FROM organizations o
      LEFT JOIN site_config sc
        ON sc.org_id = o.id AND sc.key = ${EMAIL_IDENTITY_KEY}
      WHERE o.id = ${orgId}
      LIMIT 1
    `;
    stored = row?.value ?? {};
    orgName = row?.name ?? null;
  } catch (err) {
    // A database that is down must not stop a transactional email going out.
    // Fall through to the env defaults — degraded, but delivered.
    console.error(`[email] identity lookup failed for ${orgId}:`, err);
  }

  const requestedFrom = stored.fromEmail?.trim();
  const fromIsOrgDomain = !!requestedFrom && isAuthenticatedSender(requestedFrom);
  if (requestedFrom && !fromIsOrgDomain) {
    console.warn(
      `[email] ${orgId}: From "${requestedFrom}" is not on an authenticated ` +
        `domain — falling back to ${networkFromEmail()}. Authenticate the ` +
        `domain in SendGrid and add it to EMAIL_AUTHENTICATED_DOMAINS.`
    );
  }

  const identity: OrgEmailIdentity = {
    orgId,
    fromEmail: fromIsOrgDomain ? requestedFrom! : networkFromEmail(),
    // The name needs no DNS, so an org can be itself in the inbox today even
    // while the address still belongs to the network.
    fromName:
      stored.fromName?.trim() ||
      orgName ||
      process.env.EMAIL_FROM_NAME ||
      'Elkdonis Arts Collective',
    replyTo: stored.replyTo?.trim() || undefined,
    ownerEmails:
      stored.ownerEmails?.filter((e) => typeof e === 'string' && e.includes('@')) ??
      legacyOwnerEmails(orgId),
    asmGroupId: typeof stored.asmGroupId === 'number' ? stored.asmGroupId : undefined,
    categoryPrefix: orgId,
    accentColor: typeof stored.accentColor === 'string' && HEX.test(stored.accentColor.trim())
      ? stored.accentColor.trim()
      : undefined,
    palette: sanitizePalette(stored.palette),
    inboundReplies: stored.inboundReplies === true,
    fromIsOrgDomain,
  };

  cache.set(orgId, { at: Date.now(), identity });
  return identity;
}

/**
 * An org's stored look → the chrome every letter wears.
 *
 * ONE reader for it, used by the send path and by the preview alike. They had
 * drifted before over a smaller thing than this — the preview rendered the
 * network's default copy while the send path rendered the org's — and a
 * preview showing a different masthead than the letter that leaves is the
 * same bug with a bigger picture attached.
 */
export function emailChromeFor(identity: OrgEmailIdentity): EmailChrome {
  const p = identity.palette ?? {};
  return {
    bannerUrl: p.bannerUrl,
    // The org's own name is the sensible alt text when nobody wrote one: a
    // reader whose client blocks images should still see whose letter this is.
    bannerAlt: p.bannerAlt ?? identity.fromName,
    frameColor: p.frameColor,
    frameWidth: p.frameWidth,
  };
}

/**
 * Write an org's identity, MERGING with what is stored.
 *
 * Merge and not replace, and that is the whole point of this function's shape.
 * It previously built the payload from the input alone, so a form that saved
 * only a palette would have silently erased the From address, the reply-to and
 * the owner list — every identity this network has, wiped by somebody picking
 * a colour. A partial save must mean "change this field", because that is what
 * every caller means by it.
 *
 * A field set to `null` is CLEARED; a field left `undefined` is untouched.
 * Clearing has to be expressible or an org can never undo a wrong reply-to.
 */
export async function saveOrgEmailIdentity(
  orgId: string,
  input: Partial<Record<keyof StoredIdentity, unknown>>
): Promise<{ ok: boolean; error?: string }> {
  let current: StoredIdentity = {};
  try {
    const [row] = await db<Array<{ value: StoredIdentity | null }>>`
      SELECT value FROM site_config WHERE org_id = ${orgId} AND key = ${EMAIL_IDENTITY_KEY}
    `;
    current = row?.value ?? {};
  } catch (err) {
    // Refuse rather than overwrite. Writing a partial identity on top of one we
    // could not read is exactly the data loss this function exists to prevent.
    console.error(`[email] saveOrgEmailIdentity(${orgId}) could not read current:`, err);
    return { ok: false, error: 'Could not read the current settings' };
  }

  const payload: StoredIdentity = { ...current };

  const setOrClear = <K extends keyof StoredIdentity>(
    key: K,
    value: unknown,
    coerce: (v: unknown) => StoredIdentity[K] | undefined
  ) => {
    if (value === undefined) return;
    if (value === null || value === '') {
      delete payload[key];
      return;
    }
    const next = coerce(value);
    if (next === undefined) return;
    payload[key] = next;
  };

  setOrClear('fromEmail', input.fromEmail, (v) =>
    typeof v === 'string' ? v.trim().toLowerCase() : undefined
  );
  setOrClear('fromName', input.fromName, (v) =>
    typeof v === 'string' ? v.trim().slice(0, 100) : undefined
  );
  setOrClear('replyTo', input.replyTo, (v) =>
    typeof v === 'string' ? v.trim().toLowerCase() : undefined
  );
  setOrClear('ownerEmails', input.ownerEmails, (v) =>
    Array.isArray(v)
      ? v
          .map((e) => String(e).trim().toLowerCase())
          .filter((e) => e.includes('@'))
      : undefined
  );
  setOrClear('asmGroupId', input.asmGroupId, (v) =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined
  );
  setOrClear('accentColor', input.accentColor, (v) =>
    typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : undefined
  );
  // MERGED, one role at a time — not replaced.
  //
  // The same argument this function's own header makes about the identity as
  // a whole now applies one level down. The palette used to be written whole,
  // which was harmless while the Look tab had a single "Save colours" button
  // that always sent all four values. It stopped being harmless the moment
  // that tab grew a second button: saving a masthead image would have sent
  // `{ bannerUrl }` alone and silently erased the org's three colours and its
  // chosen face. A partial save means "change these fields" here too.
  if (input.palette !== undefined) {
    if (input.palette === null) {
      delete payload.palette;
    } else {
      const next = sanitizePalette(input.palette as EmailPalette);
      // Only the keys the caller actually sent are considered — a value that
      // failed sanitising is dropped, and a key that was never mentioned is
      // left exactly as it was.
      const sent = input.palette as Record<string, unknown>;
      const merged: EmailPalette = { ...(payload.palette ?? {}) };
      for (const key of Object.keys(sent) as Array<keyof EmailPalette>) {
        const value = next?.[key];
        // An explicit empty/null CLEARS that one role, which is how an org
        // takes a banner back off without also losing its colours.
        if (sent[key] === null || sent[key] === '') delete merged[key];
        else if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
      }
      if (Object.keys(merged).length) payload.palette = merged;
      else delete payload.palette;
    }
  }
  if (input.inboundReplies !== undefined) {
    payload.inboundReplies = input.inboundReplies === true;
  }

  try {
    await db`
      INSERT INTO site_config (org_id, key, value)
      VALUES (${orgId}, ${EMAIL_IDENTITY_KEY}, ${db.json(payload as never)})
      ON CONFLICT (org_id, key) DO UPDATE
        SET value = ${db.json(payload as never)}, updated_at = NOW()
    `;
    clearEmailIdentityCache(orgId);
    return { ok: true };
  } catch (err) {
    console.error(`[email] saveOrgEmailIdentity(${orgId}):`, err);
    return { ok: false, error: 'Could not save' };
  }
}
