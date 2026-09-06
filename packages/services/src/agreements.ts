import { db } from '@elkdonis/db';

// ============================================================================
// Org agreements — the terms a collective offers its members, and the record
// of who accepted which version.
//
// This exists because of one rule (decided 2026-09-05): **an org may take a
// cut of a sale only where the artist has accepted an agreement with that
// org.** No accepted agreement means no claim — the artist takes 100%, and the
// store log still shows the org presented the work.
//
// So this module is not paperwork around the edge of commerce; it is the only
// thing that authorises a split. `resolveOrgShare` below is what settlement
// calls, and everything else here exists to make its answer trustworthy:
//
//   * Agreements are **versioned**, and an acceptance binds to ONE version.
//     An org cannot change a percentage under someone who already agreed —
//     new terms mean a new version and a fresh acceptance.
//   * Revocation is recorded, not deleted, so a sale settled while an
//     agreement was live stays explained by it afterwards.
//
// Org-agnostic on purpose. Any org site can author agreements and ask its
// members to accept them; nothing here is specific to a marketplace, and the
// same records govern workshops, services and anything else sold through an
// org's front.
// ============================================================================

export type AgreementStatus = 'draft' | 'active' | 'retired';

export interface OrgAgreement {
  id: string;
  orgId: string;
  key: string;
  version: number;
  title: string;
  summary: string | null;
  bodyHtml: string | null;
  /** The ORG's cut, 0-100. 0 means the org takes nothing. */
  revenueSharePercent: number;
  terms: Record<string, unknown>;
  status: AgreementStatus;
  requiresAcceptance: boolean;
  createdBy: string | null;
  createdAt: string;
  publishedAt: string | null;
  retiredAt: string | null;
}

export interface AgreementAcceptance {
  agreementId: string;
  userId: string;
  acceptedAt: string;
  revokedAt: string | null;
}

/** An agreement plus this person's standing on it — for a member-facing list. */
export interface AgreementForMember extends OrgAgreement {
  acceptedAt: string | null;
  revokedAt: string | null;
  /** True only for the live version they currently stand behind. */
  isAccepted: boolean;
}

type Row = Record<string, any>;

const STATUSES: AgreementStatus[] = ['draft', 'active', 'retired'];

function mapAgreement(r: Row): OrgAgreement {
  return {
    id: r.id,
    orgId: r.org_id,
    key: r.key,
    version: Number(r.version),
    title: r.title,
    summary: r.summary ?? null,
    bodyHtml: r.body_html ?? null,
    revenueSharePercent: Number(r.revenue_share_percent),
    terms: (r.terms ?? {}) as Record<string, unknown>,
    status: r.status,
    requiresAcceptance: Boolean(r.requires_acceptance),
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
    publishedAt: r.published_at ?? null,
    retiredAt: r.retired_at ?? null,
  };
}

// ─── Authoring ──────────────────────────────────────────────────────────────

export interface DraftAgreementInput {
  orgId: string;
  key: string;
  title: string;
  summary?: string | null;
  bodyHtml?: string | null;
  revenueSharePercent?: number;
  terms?: Record<string, unknown>;
  requiresAcceptance?: boolean;
  createdBy: string;
}

/**
 * Start a new draft of an agreement.
 *
 * Always a NEW version when the key already exists — editing a live agreement
 * in place would silently move the terms under everyone who accepted it, which
 * is the exact thing versioning is here to prevent.
 */
export async function draftAgreement(
  input: DraftAgreementInput
): Promise<OrgAgreement> {
  const share = input.revenueSharePercent ?? 0;
  if (share < 0 || share > 100) {
    throw new Error('Revenue share must be between 0 and 100 percent.');
  }

  const [existing] = await db<Array<{ max: number | null }>>`
    SELECT MAX(version) AS max FROM org_agreements
    WHERE org_id = ${input.orgId} AND key = ${input.key}
  `;
  const version = Number(existing?.max ?? 0) + 1;

  const [row] = await db<Row[]>`
    INSERT INTO org_agreements (
      org_id, key, version, title, summary, body_html,
      revenue_share_percent, terms, status, requires_acceptance, created_by
    ) VALUES (
      ${input.orgId}, ${input.key}, ${version}, ${input.title},
      ${input.summary ?? null}, ${input.bodyHtml ?? null},
      ${share}, ${JSON.stringify(input.terms ?? {})}::jsonb,
      'draft', ${input.requiresAcceptance ?? true}, ${input.createdBy}
    )
    RETURNING *
  `;
  return mapAgreement(row!);
}

/** Edit a draft. Refuses once published — publish a new version instead. */
export async function updateDraftAgreement(
  agreementId: string,
  patch: Partial<Omit<DraftAgreementInput, 'orgId' | 'key' | 'createdBy'>>
): Promise<void> {
  if (
    patch.revenueSharePercent != null &&
    (patch.revenueSharePercent < 0 || patch.revenueSharePercent > 100)
  ) {
    throw new Error('Revenue share must be between 0 and 100 percent.');
  }
  const rows = await db<Row[]>`
    UPDATE org_agreements SET
      title = COALESCE(${patch.title ?? null}, title),
      summary = ${patch.summary !== undefined ? patch.summary : db`summary`},
      body_html = ${patch.bodyHtml !== undefined ? patch.bodyHtml : db`body_html`},
      revenue_share_percent =
        COALESCE(${patch.revenueSharePercent ?? null}, revenue_share_percent),
      terms = ${patch.terms !== undefined ? db`${JSON.stringify(patch.terms)}::jsonb` : db`terms`},
      requires_acceptance =
        COALESCE(${patch.requiresAcceptance ?? null}, requires_acceptance)
    WHERE id = ${agreementId} AND status = 'draft'
    RETURNING id
  `;
  if (!rows[0]) {
    throw new Error('Only a draft can be edited. Publish a new version instead.');
  }
}

/**
 * Publish a draft, retiring whatever version was live under the same key.
 *
 * Retiring the old one does not revoke anybody's acceptance of it: people who
 * agreed to v1 are still on v1 until they accept v2, which is what stops a
 * republish from quietly re-rating existing artists.
 */
export async function publishAgreement(agreementId: string): Promise<OrgAgreement> {
  return db.begin(async (tx) => {
    const [draft] = await tx<Row[]>`
      SELECT * FROM org_agreements WHERE id = ${agreementId} LIMIT 1
    `;
    if (!draft) throw new Error('Agreement not found.');
    if (draft.status !== 'draft') throw new Error('That agreement is not a draft.');

    await tx`
      UPDATE org_agreements SET status = 'retired', retired_at = now()
      WHERE org_id = ${draft.org_id} AND key = ${draft.key} AND status = 'active'
    `;
    const [row] = await tx<Row[]>`
      UPDATE org_agreements SET status = 'active', published_at = now()
      WHERE id = ${agreementId}
      RETURNING *
    `;
    return mapAgreement(row!);
  });
}

export async function retireAgreement(agreementId: string): Promise<void> {
  await db`
    UPDATE org_agreements SET status = 'retired', retired_at = now()
    WHERE id = ${agreementId} AND status = 'active'
  `;
}

// ─── Reading ────────────────────────────────────────────────────────────────

export async function getAgreement(agreementId: string): Promise<OrgAgreement | null> {
  const [row] = await db<Row[]>`
    SELECT * FROM org_agreements WHERE id = ${agreementId} LIMIT 1
  `;
  return row ? mapAgreement(row) : null;
}

/** Every agreement an org has authored, newest version of each key first. */
export async function listOrgAgreements(
  orgId: string,
  opts: { status?: AgreementStatus } = {}
): Promise<OrgAgreement[]> {
  if (opts.status && !STATUSES.includes(opts.status)) {
    throw new Error(`Unknown agreement status: ${opts.status}`);
  }
  const rows = await db<Row[]>`
    SELECT * FROM org_agreements
    WHERE org_id = ${orgId}
      ${opts.status ? db`AND status = ${opts.status}` : db``}
    ORDER BY key ASC, version DESC
  `;
  return rows.map(mapAgreement);
}

/**
 * What an org is currently asking its members to accept, and where this person
 * stands on each — the member-facing list an org site renders.
 */
export async function listAgreementsForMember(
  orgId: string,
  userId: string
): Promise<AgreementForMember[]> {
  const rows = await db<Row[]>`
    SELECT a.*, ac.accepted_at, ac.revoked_at
    FROM org_agreements a
    LEFT JOIN org_agreement_acceptances ac
      ON ac.agreement_id = a.id AND ac.user_id = ${userId}
    WHERE a.org_id = ${orgId} AND a.status = 'active'
    ORDER BY a.title ASC
  `;
  return rows.map((r) => ({
    ...mapAgreement(r),
    acceptedAt: r.accepted_at ?? null,
    revokedAt: r.revoked_at ?? null,
    isAccepted: Boolean(r.accepted_at) && !r.revoked_at,
  }));
}

/** Who has accepted a given agreement — the org's own roster view. */
export async function listAcceptances(
  agreementId: string
): Promise<Array<AgreementAcceptance & { displayName: string | null; email: string }>> {
  const rows = await db<Row[]>`
    SELECT ac.*, u.display_name, u.email
    FROM org_agreement_acceptances ac
    JOIN users u ON u.id = ac.user_id
    WHERE ac.agreement_id = ${agreementId}
    ORDER BY ac.accepted_at ASC
  `;
  return rows.map((r) => ({
    agreementId: r.agreement_id,
    userId: r.user_id,
    acceptedAt: r.accepted_at,
    revokedAt: r.revoked_at ?? null,
    displayName: r.display_name ?? null,
    email: r.email,
  }));
}

// ─── Accepting ──────────────────────────────────────────────────────────────

/**
 * A member accepts an agreement.
 *
 * Only an `active` version can be accepted — accepting a draft would let an
 * org collect signatures on terms it can still edit. Re-accepting after a
 * revocation clears the revocation rather than creating a second row.
 */
export async function acceptAgreement(
  agreementId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const [agreement] = await db<Row[]>`
    SELECT id, status FROM org_agreements WHERE id = ${agreementId} LIMIT 1
  `;
  if (!agreement) return { ok: false, error: 'Agreement not found.' };
  if (agreement.status !== 'active') {
    return { ok: false, error: 'That agreement is not open for acceptance.' };
  }
  await db.begin(async (tx) => {
    // Accepting a version supersedes any other version of the SAME agreement
    // this person still stands behind. Without this they would hold two live
    // acceptances of one contract at different rates, and which one governed
    // would come down to tie-break order.
    await tx`
      UPDATE org_agreement_acceptances ac SET revoked_at = now()
      FROM org_agreements a, org_agreements target
      WHERE ac.agreement_id = a.id
        AND target.id = ${agreementId}
        AND a.org_id = target.org_id
        AND a.key = target.key
        AND a.id <> target.id
        AND ac.user_id = ${userId}
        AND ac.revoked_at IS NULL
    `;
    await tx`
      INSERT INTO org_agreement_acceptances (agreement_id, user_id)
      VALUES (${agreementId}, ${userId})
      ON CONFLICT (agreement_id, user_id)
      DO UPDATE SET revoked_at = NULL, accepted_at = now()
    `;
  });
  return { ok: true };
}

/**
 * A member withdraws.
 *
 * Recorded rather than deleted: order lines already settled reference the
 * agreement that authorised their split, and that history has to keep making
 * sense. Future sales stop splitting from this moment.
 */
export async function revokeAcceptance(
  agreementId: string,
  userId: string
): Promise<void> {
  await db`
    UPDATE org_agreement_acceptances SET revoked_at = now()
    WHERE agreement_id = ${agreementId} AND user_id = ${userId}
      AND revoked_at IS NULL
  `;
}

// ─── The one question settlement asks ───────────────────────────────────────

export interface ResolvedShare {
  /** The org's cut, 0-100. Zero whenever nothing authorises a split. */
  orgSharePercent: number;
  /** The agreement that authorised it, or null when there is none. */
  agreementId: string | null;
}

/**
 * What cut, if any, this org may take of this person's sale.
 *
 * The whole money model reduces to this call. It returns zero — not a default
 * rate, not the org's asking price — whenever the artist has not accepted a
 * live agreement with that org, because a split on terms nobody agreed to is
 * not a split, it is a deduction.
 *
 * Deliberately does NOT require the agreement to still be `active`. An
 * acceptance binds to a version and that version governs until the person
 * accepts another or withdraws — so publishing v2 does not silently re-rate,
 * or un-rate, everyone who agreed to v1. Retirement stops NEW acceptances
 * (see `acceptAgreement`); it cannot void one already given, any more than
 * either side can void a signed contract by discarding their own copy.
 *
 * Where an org holds several *different* accepted agreements with one person,
 * the one taking the SMALLEST cut wins. That is deliberate: if the org's own
 * records are ambiguous, the artist should not be the one who pays for it.
 */
export async function resolveOrgShare(
  userId: string,
  orgId: string
): Promise<ResolvedShare> {
  const [row] = await db<Row[]>`
    SELECT a.id, a.revenue_share_percent
    FROM org_agreement_acceptances ac
    JOIN org_agreements a ON a.id = ac.agreement_id
    WHERE ac.user_id = ${userId}
      AND ac.revoked_at IS NULL
      AND a.org_id = ${orgId}
    ORDER BY a.revenue_share_percent ASC
    LIMIT 1
  `;
  if (!row) return { orgSharePercent: 0, agreementId: null };
  return {
    orgSharePercent: Number(row.revenue_share_percent),
    agreementId: row.id as string,
  };
}
