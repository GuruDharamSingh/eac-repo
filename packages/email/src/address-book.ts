import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

// ============================================================================
// Everyone an organisation can actually reach.
//
// `contacts` (migration 020) was built for exactly one thing: a visitor who
// filled in a form. So an org with 31 members and 4 form submissions was being
// shown a "contact list" of 4 — and the newsletter, which sends to `contacts`,
// could not reach its own membership.
//
// The fix is a READ, not a copy. Members live in `user_organizations` and
// guests in `thread_rsvps`; they are joined here at query time and marked with
// where they came from. Nothing is duplicated into `contacts`, so nobody has a
// stale second copy of their own address and an org that loses a member loses
// them from the list on the same day.
//
// Manual entry is the one thing that does write, and it writes to `contacts`
// with `source = 'manual'`.
//
// ── Unsubscribe crosses every source ───────────────────────────────────────
//
// An unsubscribe is a statement about being emailed, not about a row. Somebody
// who unsubscribed as a contact and is also a member has still unsubscribed,
// so the suppression is resolved once, by address, and applied to every entry
// regardless of which table it came from. Getting this backwards is how a
// network mails someone who asked it not to.
// ============================================================================

export type AddressSource = 'contact' | 'manual' | 'member' | 'guest';

export interface AddressEntry {
  /** The `contacts` row id when there is one; otherwise `user:<uuid>`. */
  id: string;
  email: string;
  name: string | null;
  /** Every place this address is known from, not just the first one found. */
  sources: AddressSource[];
  /** From `contacts.status`; members and guests with no contact row are 'new'. */
  status: 'new' | 'contacted' | 'joined' | 'unsubscribed';
  /** The org role, when this person is a member. */
  role: string | null;
  tags: string[];
  notes: string | null;
  /** True when this address may be included in a send. */
  mailable: boolean;
  addedAt: string | null;
}

interface RawRow {
  email: string;
  name: string | null;
  source: AddressSource;
  contact_id: string | null;
  user_id: string | null;
  status: string | null;
  role: string | null;
  tags: string[] | null;
  notes: string | null;
  added_at: Date | null;
}

/**
 * The whole list, deduplicated by address.
 *
 * One query per source rather than a UNION with casts, because the three have
 * genuinely different shapes and a UNION would need every column nulled out in
 * two of the three branches — which is the same merge, written less legibly.
 */
export async function listAddressBook(orgId: string): Promise<AddressEntry[]> {
  const [contacts, members, guests] = await Promise.all([
    db`
      SELECT email, name,
             CASE WHEN source = 'manual' THEN 'manual' ELSE 'contact' END AS source,
             id AS contact_id, user_id, status, NULL AS role,
             tags, notes, created_at AS added_at
      FROM contacts WHERE org_id = ${orgId}
    `,
    db`
      SELECT u.email, u.display_name AS name, 'member' AS source,
             NULL AS contact_id, u.id AS user_id, NULL AS status, uo.role,
             NULL AS tags, NULL AS notes, uo.joined_at AS added_at
      FROM user_organizations uo
      JOIN users u ON u.id = uo.user_id
      WHERE uo.org_id = ${orgId} AND u.email IS NOT NULL AND u.email <> ''
    `,
    // Guests of this org's threads. DISTINCT because one person RSVPs to many
    // meetings and is one entry in an address book, not twelve.
    db`
      SELECT DISTINCT u.email, u.display_name AS name, 'guest' AS source,
             NULL AS contact_id, u.id AS user_id, NULL AS status, NULL AS role,
             NULL AS tags, NULL AS notes, NULL::timestamptz AS added_at
      FROM thread_rsvps r
      JOIN threads t ON t.id = r.thread_id
      JOIN users u ON u.id = r.user_id
      WHERE t.org_id = ${orgId} AND u.email IS NOT NULL AND u.email <> ''
    `,
  ]);

  const rows = [...contacts, ...members, ...guests] as unknown as RawRow[];

  // Resolved first and across all sources — see the header.
  const unsubscribed = new Set(
    contacts
      .filter((c) => (c as unknown as RawRow).status === 'unsubscribed')
      .map((c) => (c as unknown as RawRow).email.toLowerCase())
  );

  const byEmail = new Map<string, AddressEntry>();

  for (const row of rows) {
    const key = row.email.toLowerCase();
    const existing = byEmail.get(key);

    if (!existing) {
      byEmail.set(key, {
        id: row.contact_id ?? `user:${row.user_id}`,
        email: row.email,
        name: row.name,
        sources: [row.source],
        status: (row.status as AddressEntry['status']) ?? 'new',
        role: row.role,
        tags: row.tags ?? [],
        notes: row.notes,
        mailable: !unsubscribed.has(key),
        addedAt: row.added_at ? row.added_at.toISOString() : null,
      });
      continue;
    }

    if (!existing.sources.includes(row.source)) existing.sources.push(row.source);
    // A contact row is the editable one, so its id wins over a synthetic
    // `user:` id — otherwise the address book shows an entry whose tags and
    // notes cannot be saved.
    if (row.contact_id) existing.id = row.contact_id;
    existing.name ??= row.name;
    existing.role ??= row.role;
    if (row.tags?.length) existing.tags = row.tags;
    existing.notes ??= row.notes;
    if (row.status && row.status !== 'new') existing.status = row.status as AddressEntry['status'];
    existing.addedAt ??= row.added_at ? row.added_at.toISOString() : null;
  }

  return [...byEmail.values()].sort((a, b) =>
    (a.name ?? a.email).localeCompare(b.name ?? b.email)
  );
}

/** Just the addresses a send may go to. The one query a sender should use. */
export async function listMailable(orgId: string): Promise<Array<{ email: string; name: string | null }>> {
  const all = await listAddressBook(orgId);
  return all.filter((e) => e.mailable).map((e) => ({ email: e.email, name: e.name }));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedAddress {
  email: string;
  name: string | null;
}

/**
 * Read a pasted block into addresses.
 *
 * Accepts the three shapes people actually paste: a bare address per line,
 * `Name <addr>`, and comma- or tab-separated `Name, addr` out of a
 * spreadsheet. Anything that does not contain a plausible address is returned
 * as a rejection rather than dropped, because silently discarding four of
 * someone's sixty pasted lines is worse than refusing all sixty.
 */
export function parseAddressList(text: string): {
  addresses: ParsedAddress[];
  rejected: string[];
} {
  const addresses: ParsedAddress[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/[\n\r]+/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let email = '';
    let name: string | null = null;

    const angled = line.match(/^(.*?)<([^>]+)>\s*$/);
    if (angled) {
      name = angled[1].trim().replace(/^["']|["']$/g, '') || null;
      email = angled[2].trim();
    } else {
      // Take the field that looks like an address; whatever is left is a name.
      const fields = line.split(/[,;\t]+/).map((f) => f.trim()).filter(Boolean);
      const found = fields.find((f) => EMAIL_RE.test(f));
      if (found) {
        email = found;
        name = fields.filter((f) => f !== found).join(' ').trim() || null;
      } else {
        email = line;
      }
    }

    if (!EMAIL_RE.test(email)) {
      rejected.push(line);
      continue;
    }
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    addresses.push({ email, name });
  }

  return { addresses, rejected };
}

export interface AddAddressesResult {
  added: number;
  updated: number;
  /** Already present and unsubscribed — deliberately left alone. See below. */
  skippedUnsubscribed: number;
  rejected: string[];
}

/**
 * Add addresses by hand.
 *
 * An address already on the list is updated, never duplicated (the unique
 * index from migration 134 is what makes that safe). An address that has
 * UNSUBSCRIBED is left exactly as it is: re-adding it would quietly resurrect
 * consent that the person withdrew, which is the single thing CASL is least
 * forgiving about. It is reported back so the person pasting knows it happened
 * rather than wondering why their count is short.
 */
export async function addAddresses(input: {
  orgId: string;
  text: string;
  addedBy?: string | null;
  tags?: string[];
}): Promise<AddAddressesResult> {
  const { addresses, rejected } = parseAddressList(input.text);
  let added = 0;
  let updated = 0;
  let skippedUnsubscribed = 0;

  for (const { email, name } of addresses) {
    const [existing] = await db`
      SELECT id, status FROM contacts
      WHERE org_id = ${input.orgId} AND lower(email) = ${email.toLowerCase()}
      LIMIT 1
    `;

    if (existing?.status === 'unsubscribed') {
      skippedUnsubscribed++;
      continue;
    }

    if (existing) {
      // COALESCE and not assignment: a paste fills a name that is MISSING, and
      // must not overwrite the one an org typed by hand with whatever a
      // spreadsheet column happened to hold.
      await db`
        UPDATE contacts
        SET name = COALESCE(name, ${name}),
            tags = ${input.tags?.length ? input.tags : db`tags`},
            updated_at = NOW()
        WHERE id = ${existing.id}
      `;
      updated++;
      continue;
    }

    await db`
      INSERT INTO contacts (id, org_id, email, name, status, source, added_by, tags)
      VALUES (${nanoid()}, ${input.orgId}, ${email}, ${name}, 'new', 'manual',
              ${input.addedBy ?? null}, ${input.tags ?? []})
    `;
    added++;
  }

  return { added, updated, skippedUnsubscribed, rejected };
}

/**
 * Edit what the org keeps about someone. Only ever a `contacts` row.
 *
 * A field left `undefined` is untouched and a field set to `null` is cleared,
 * which the dynamic SET distinguishes and a COALESCE could not — clearing a
 * name someone mistyped has to be possible.
 */
export async function updateContact(input: {
  orgId: string;
  contactId: string;
  name?: string | null;
  tags?: string[];
  notes?: string | null;
}): Promise<boolean> {
  const sets: Record<string, unknown> = {};
  if (input.name !== undefined) sets.name = input.name?.trim() || null;
  if (input.tags !== undefined) sets.tags = input.tags;
  if (input.notes !== undefined) sets.notes = input.notes?.trim() || null;
  if (Object.keys(sets).length === 0) return true;
  sets.updated_at = new Date();

  const rows = await db`
    UPDATE contacts SET ${db(sets as never)}
    WHERE org_id = ${input.orgId} AND id = ${input.contactId}
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Unsubscribe somebody the org was asked, off-channel, to stop mailing.
 *
 * Writes a `contacts` row when none exists, because that row IS the
 * suppression record — a member or RSVP guest has nowhere else for the fact to
 * live, and `listAddressBook` resolves unsubscription by address across all
 * three sources precisely so that this works for them too.
 */
export async function suppressAddress(input: {
  orgId: string;
  email: string;
  addedBy?: string | null;
}): Promise<void> {
  await db`
    INSERT INTO contacts (id, org_id, email, status, source, added_by)
    VALUES (${nanoid()}, ${input.orgId}, ${input.email}, 'unsubscribed', 'manual',
            ${input.addedBy ?? null})
    ON CONFLICT (org_id, lower(email))
    DO UPDATE SET status = 'unsubscribed', updated_at = NOW()
  `;
}

/**
 * Take a manually-added address off the list.
 *
 * Only removes the `contacts` row. Somebody who is also a member stays in the
 * address book as a member, which is correct — they are still reachable and
 * still in the org — and the UI says so rather than appearing to fail.
 */
export async function removeContact(orgId: string, contactId: string): Promise<boolean> {
  const rows = await db`
    DELETE FROM contacts WHERE org_id = ${orgId} AND id = ${contactId} RETURNING id
  `;
  return rows.length > 0;
}
