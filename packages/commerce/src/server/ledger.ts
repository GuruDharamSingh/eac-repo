import { db } from "@elkdonis/db";

// ============================================================================
// The payout ledger — what each party is owed, and whether it is payable yet.
//
// Append-only. A balance is derived by summing entries, never stored and
// mutated; a reversal is a new negative entry. That is what makes this
// auditable, which matters as soon as it feeds an NFP's books.
//
// The party is polymorphic — user, org or platform — because an org has no
// connected account and no transfer to receive. Holding a balance here is the
// ONLY way an org's share exists (migration 096). Retrofitting that later
// would have meant rewriting every payout query, which is why the brief
// insisted on it from the start.
//
// Nothing here mutates an entry. A hold is released by a new `release` row
// pointing at the accrual it frees, so "why was this paid" stays answerable
// after the fact.
// ============================================================================

export type PartyKind = "user" | "org" | "platform";
export type EntryType = "accrual" | "release" | "payout" | "adjustment" | "refund";
export type HoldReason =
  | "no_payout_account"
  | "below_threshold"
  | "org_unowned"
  | "dispute_window";

const PARTY_KINDS: PartyKind[] = ["user", "org", "platform"];
const ENTRY_TYPES: EntryType[] = [
  "accrual",
  "release",
  "payout",
  "adjustment",
  "refund",
];

export interface Party {
  kind: PartyKind;
  userId?: string | null;
  orgId?: string | null;
}

export interface LedgerEntry {
  id: string;
  party: Party;
  entryType: EntryType;
  amountMinor: number;
  currency: string;
  orderId: string | null;
  orderLineId: string | null;
  agreementId: string | null;
  holdReason: HoldReason | null;
  releasesEntryId: string | null;
  payoutId: string | null;
  note: string | null;
  createdAt: string;
}

export interface Balance {
  /** Everything accrued less everything paid out. */
  totalMinor: number;
  /** The part that could be paid today. */
  payableMinor: number;
  /** The part still held, by reason. */
  heldMinor: number;
  heldByReason: Record<string, number>;
  currency: string;
}

type Row = Record<string, any>;

function mapEntry(r: Row): LedgerEntry {
  return {
    id: r.id,
    party: {
      kind: r.party_kind,
      userId: r.party_user_id ?? null,
      orgId: r.party_org_id ?? null,
    },
    entryType: r.entry_type,
    amountMinor: Number(r.amount_minor),
    currency: r.currency,
    orderId: r.order_id ?? null,
    orderLineId: r.order_line_id ?? null,
    agreementId: r.agreement_id ?? null,
    holdReason: r.hold_reason ?? null,
    releasesEntryId: r.releases_entry_id ?? null,
    payoutId: r.payout_id ?? null,
    note: r.note ?? null,
    createdAt: r.created_at,
  };
}

function assertParty(p: Party): void {
  if (!PARTY_KINDS.includes(p.kind)) {
    throw new Error(`Unknown party kind: ${p.kind}`);
  }
  if (p.kind === "platform") {
    if (p.userId || p.orgId) throw new Error("The platform party names no id.");
    return;
  }
  if (Boolean(p.userId) === Boolean(p.orgId)) {
    throw new Error("A party is exactly one of a user or an org.");
  }
  if (p.kind === "user" && !p.userId) throw new Error("A user party needs a userId.");
  if (p.kind === "org" && !p.orgId) throw new Error("An org party needs an orgId.");
}

export interface WriteEntryInput {
  party: Party;
  entryType: EntryType;
  amountMinor: number;
  currency: string;
  orderId?: string | null;
  orderLineId?: string | null;
  agreementId?: string | null;
  holdReason?: HoldReason | null;
  releasesEntryId?: string | null;
  payoutId?: string | null;
  note?: string | null;
  createdBy?: string | null;
}

/**
 * Write one entry. The only way anything enters the ledger.
 *
 * `tx` lets an accrual join the transaction that confirmed the payment, so a
 * sale and the money it owes can never half-commit.
 */
export async function writeEntry(
  input: WriteEntryInput,
  tx: typeof db = db
): Promise<LedgerEntry> {
  assertParty(input.party);
  if (!ENTRY_TYPES.includes(input.entryType)) {
    throw new Error(`Unknown entry type: ${input.entryType}`);
  }
  if (input.entryType === "release" && input.amountMinor !== 0) {
    throw new Error("A release changes payability, not the balance.");
  }
  if (!Number.isInteger(input.amountMinor)) {
    throw new Error("Ledger amounts are integer minor units.");
  }

  const rows = (await tx`
    INSERT INTO payout_ledger (
      party_kind, party_user_id, party_org_id,
      entry_type, amount_minor, currency,
      order_id, order_line_id, agreement_id,
      hold_reason, releases_entry_id, payout_id, note, created_by
    ) VALUES (
      ${input.party.kind}, ${input.party.userId ?? null}, ${input.party.orgId ?? null},
      ${input.entryType}, ${input.amountMinor}, ${input.currency},
      ${input.orderId ?? null}, ${input.orderLineId ?? null}, ${input.agreementId ?? null},
      ${input.holdReason ?? null}, ${input.releasesEntryId ?? null},
      ${input.payoutId ?? null}, ${input.note ?? null}, ${input.createdBy ?? null}
    )
    RETURNING *
  `) as unknown as Row[];
  return mapEntry(rows[0]!);
}

/** SQL fragment matching one party, used by every balance and listing query. */
function partyWhere(p: Party, t: typeof db) {
  assertParty(p);
  if (p.kind === "platform") return t`pl.party_kind = 'platform'`;
  return p.userId
    ? t`pl.party_user_id = ${p.userId}`
    : t`pl.party_org_id = ${p.orgId!}`;
}

/**
 * What a party is owed, derived by summing — never read from a stored total.
 *
 * An entry is payable if it was born payable (`hold_reason IS NULL`) or if a
 * later `release` row points at it. That is why releasing does not mutate the
 * accrual: the two facts, "this was held for reason X" and "someone released
 * it", both stay on the record.
 */
export async function getBalance(
  party: Party,
  currency = "CAD"
): Promise<Balance> {
  const rows = (await db`
    WITH entries AS (
      SELECT
        pl.*,
        (
          pl.hold_reason IS NULL
          OR EXISTS (
            SELECT 1 FROM payout_ledger r
            WHERE r.releases_entry_id = pl.id AND r.entry_type = 'release'
          )
        ) AS payable
      FROM payout_ledger pl
      WHERE ${partyWhere(party, db)} AND pl.currency = ${currency}
    )
    SELECT
      COALESCE(SUM(amount_minor), 0)::bigint AS total,
      COALESCE(SUM(amount_minor) FILTER (WHERE payable), 0)::bigint AS payable,
      COALESCE(SUM(amount_minor) FILTER (WHERE NOT payable), 0)::bigint AS held
    FROM entries
  `) as unknown as Row[];

  const byReason = (await db`
    SELECT pl.hold_reason, COALESCE(SUM(pl.amount_minor), 0)::bigint AS amount
    FROM payout_ledger pl
    WHERE ${partyWhere(party, db)}
      AND pl.currency = ${currency}
      AND pl.hold_reason IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM payout_ledger r
        WHERE r.releases_entry_id = pl.id AND r.entry_type = 'release'
      )
    GROUP BY pl.hold_reason
  `) as unknown as Row[];

  return {
    totalMinor: Number(rows[0]?.total ?? 0),
    payableMinor: Number(rows[0]?.payable ?? 0),
    heldMinor: Number(rows[0]?.held ?? 0),
    heldByReason: Object.fromEntries(
      byReason.map((r) => [r.hold_reason as string, Number(r.amount)])
    ),
    currency,
  };
}

/** One party's entries, newest first. */
export async function listEntries(
  party: Party,
  opts: { limit?: number; currency?: string } = {}
): Promise<LedgerEntry[]> {
  const limit = Math.min(opts.limit ?? 100, 500);
  const rows = (await db`
    SELECT pl.* FROM payout_ledger pl
    WHERE ${partyWhere(party, db)}
      ${opts.currency ? db`AND pl.currency = ${opts.currency}` : db``}
    ORDER BY pl.created_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map(mapEntry);
}

/** Everything still held, across all parties — the admin queue. */
export async function listHeld(
  opts: { limit?: number; reason?: HoldReason } = {}
): Promise<Array<LedgerEntry & { partyName: string | null }>> {
  const limit = Math.min(opts.limit ?? 200, 1000);
  const rows = (await db`
    SELECT pl.*, COALESCE(u.display_name, u.email, o.name) AS party_name
    FROM payout_ledger pl
    LEFT JOIN users u ON u.id = pl.party_user_id
    LEFT JOIN organizations o ON o.id = pl.party_org_id
    WHERE pl.hold_reason IS NOT NULL
      ${opts.reason ? db`AND pl.hold_reason = ${opts.reason}` : db``}
      AND NOT EXISTS (
        SELECT 1 FROM payout_ledger r
        WHERE r.releases_entry_id = pl.id AND r.entry_type = 'release'
      )
    ORDER BY pl.created_at ASC
    LIMIT ${limit}
  `) as unknown as Row[];
  return rows.map((r) => ({ ...mapEntry(r), partyName: r.party_name ?? null }));
}

/**
 * Release a held accrual. One of the two things that can (decided 2026-09-05);
 * the other is `releaseOnPayoutAccountReady` below.
 */
export async function releaseHold(input: {
  entryId: string;
  releasedBy: string;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const rows = (await db`
    SELECT * FROM payout_ledger WHERE id = ${input.entryId} LIMIT 1
  `) as unknown as Row[];
  const entry = rows[0];
  if (!entry) return { ok: false, error: "Ledger entry not found." };
  if (!entry.hold_reason) return { ok: false, error: "That entry is not held." };

  const already = (await db`
    SELECT 1 FROM payout_ledger
    WHERE releases_entry_id = ${input.entryId} AND entry_type = 'release' LIMIT 1
  `) as unknown as Row[];
  if (already[0]) return { ok: true };

  await writeEntry({
    party: {
      kind: entry.party_kind,
      userId: entry.party_user_id,
      orgId: entry.party_org_id,
    },
    entryType: "release",
    amountMinor: 0,
    currency: entry.currency,
    orderId: entry.order_id,
    orderLineId: entry.order_line_id,
    releasesEntryId: input.entryId,
    note: input.note ?? `Released by admin (was: ${entry.hold_reason})`,
    createdBy: input.releasedBy,
  });
  return { ok: true };
}

/**
 * Release everything a person was holding for want of a payout account.
 *
 * Called when Stripe reports their connected account payouts-enabled — the
 * only automatic release trigger there is. Deliberately does NOT touch other
 * hold reasons: an amount held for a dispute window is not freed by the payee
 * finishing onboarding.
 */
export async function releaseOnPayoutAccountReady(
  userId: string
): Promise<number> {
  const held = (await db`
    SELECT pl.* FROM payout_ledger pl
    WHERE pl.party_user_id = ${userId}
      AND pl.hold_reason = 'no_payout_account'
      AND NOT EXISTS (
        SELECT 1 FROM payout_ledger r
        WHERE r.releases_entry_id = pl.id AND r.entry_type = 'release'
      )
  `) as unknown as Row[];

  for (const entry of held) {
    await writeEntry({
      party: { kind: "user", userId },
      entryType: "release",
      amountMinor: 0,
      currency: entry.currency,
      orderId: entry.order_id,
      orderLineId: entry.order_line_id,
      releasesEntryId: entry.id,
      note: "Payout account completed onboarding",
    });
  }
  return held.length;
}

// ─── Settling up ─────────────────────────────────────────────────────────────

export interface RecordPayoutInput {
  party: Party;
  /** POSITIVE minor units — the amount handed over. Stored as a negative entry. */
  amountMinor: number;
  currency?: string;
  /** How it was actually sent. 'etransfer' for the Canadian rail. */
  method: string;
  /** The e-Transfer confirmation, wire reference, whatever can be looked up. */
  reference?: string | null;
  actorUserId: string;
  note?: string | null;
}

/**
 * Record money actually handed to someone, outside Stripe.
 *
 * This is the manual tier's other half: `confirmOrderPaid` writes what is
 * owed the moment a sale lands, and this writes that the debt was settled.
 * Both the `payout` row (the audit trail — method, reference, when) and the
 * negative ledger entry are written in ONE transaction, because a payout
 * recorded without the ledger entry would leave the balance still claiming
 * the money is owed, and someone would be paid twice.
 *
 * Refuses to pay more than is payable. Held money is not payable by
 * definition, so an amount sitting under a dispute window or waiting on a
 * payout account cannot be settled by accident — release it first.
 */
export async function recordPayout(
  input: RecordPayoutInput
): Promise<{ ok: boolean; error?: string; payoutId?: string }> {
  assertParty(input.party);
  const currency = input.currency ?? "CAD";
  const amount = Math.round(input.amountMinor);
  if (!(amount > 0)) return { ok: false, error: "A payout has to be a positive amount." };

  const balance = await getBalance(input.party, currency);
  if (amount > balance.payableMinor) {
    return {
      ok: false,
      error:
        balance.heldMinor > 0
          ? `Only ${balance.payableMinor / 100} ${currency} is payable right now; the rest is held.`
          : `That is more than the ${balance.payableMinor / 100} ${currency} owed.`,
    };
  }

  const payoutId = await db.begin(async (tx) => {
    const rows = (await tx`
      INSERT INTO payout (
        artist_user_id, party_org_id, amount_minor, currency,
        method, reference, status, sent_at, notes
      ) VALUES (
        ${input.party.kind === "user" ? input.party.userId! : null},
        ${input.party.kind === "org" ? input.party.orgId! : null},
        ${amount}, ${currency},
        ${input.method}, ${input.reference ?? null},
        'sent', NOW(), ${input.note ?? null}
      )
      RETURNING id
    `) as unknown as Row[];
    const id = rows[0]!.id as string;

    await writeEntry(
      {
        party: input.party,
        entryType: "payout",
        amountMinor: -amount,
        currency,
        payoutId: id,
        note: input.note ?? `Paid by ${input.method}`,
        createdBy: input.actorUserId,
      },
      tx as unknown as typeof db
    );

    return id;
  });

  return { ok: true, payoutId };
}

export interface PayableParty {
  party: Party;
  partyName: string | null;
  payableMinor: number;
  heldMinor: number;
  currency: string;
  /** Oldest unpaid accrual — how long someone has been waiting. */
  owedSince: string | null;
  /** Null for an org: an org is settled internally, never sent money. */
  payoutMethod: string | null;
  payoutEmail: string | null;
  country: string | null;
  stripeOnboardedAt: string | null;
}

/**
 * Everyone the collective currently owes — the settle-up queue.
 *
 * `getBalance` answers for one party, which is the wrong shape for the person
 * doing the paying: they need to know who is waiting, how long, and by what
 * rail before they open their banking app. Payout details are joined in for
 * the same reason — an admin who has to go and look up each artist's email
 * separately will batch it, and batching is how people end up waiting weeks.
 *
 * Held money is reported alongside but is NOT part of `payableMinor`, so the
 * queue can never invite someone to send money that is under a dispute window.
 */
export async function listPayable(
  opts: { currency?: string; limit?: number } = {}
): Promise<PayableParty[]> {
  const currency = opts.currency ?? "CAD";
  const limit = Math.min(opts.limit ?? 100, 500);
  const rows = (await db`
    WITH entries AS (
      SELECT
        pl.*,
        (
          pl.hold_reason IS NULL
          OR EXISTS (
            SELECT 1 FROM payout_ledger r
            WHERE r.releases_entry_id = pl.id AND r.entry_type = 'release'
          )
        ) AS payable
      FROM payout_ledger pl
      WHERE pl.currency = ${currency}
    ),
    totals AS (
      SELECT
        party_kind, party_user_id, party_org_id,
        COALESCE(SUM(amount_minor) FILTER (WHERE payable), 0)::bigint AS payable_minor,
        COALESCE(SUM(amount_minor) FILTER (WHERE NOT payable), 0)::bigint AS held_minor,
        MIN(created_at) FILTER (WHERE payable AND entry_type = 'accrual') AS owed_since
      FROM entries
      GROUP BY party_kind, party_user_id, party_org_id
    )
    SELECT
      t.*,
      COALESCE(u.display_name, u.email, o.name) AS party_name,
      u.payout_method, u.payout_email, u.country, u.stripe_onboarded_at
    FROM totals t
    LEFT JOIN users u         ON u.id = t.party_user_id
    LEFT JOIN organizations o ON o.id = t.party_org_id
    WHERE t.payable_minor > 0
    ORDER BY t.owed_since ASC NULLS LAST
    LIMIT ${limit}
  `) as unknown as Row[];

  return rows.map((r) => ({
    party: {
      kind: r.party_kind as PartyKind,
      userId: (r.party_user_id as string | null) ?? null,
      orgId: (r.party_org_id as string | null) ?? null,
    },
    partyName: (r.party_name as string | null) ?? null,
    payableMinor: Number(r.payable_minor),
    heldMinor: Number(r.held_minor),
    currency,
    owedSince: (r.owed_since as string | null) ?? null,
    payoutMethod: (r.payout_method as string | null) ?? null,
    payoutEmail: (r.payout_email as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    stripeOnboardedAt: (r.stripe_onboarded_at as string | null) ?? null,
  }));
}

export interface EarningsLine {
  entryId: string;
  entryType: EntryType;
  amountMinor: number;
  currency: string;
  createdAt: string;
  /** Held and not yet released — shown to the artist as "not payable yet". */
  held: boolean;
  holdReason: HoldReason | null;
  note: string | null;
  /** What was sold, where the entry came from a sale. */
  orderNumber: string | null;
  description: string | null;
  /** How it was sent, where this line IS a payout. */
  payoutMethod: string | null;
  payoutReference: string | null;
}

/**
 * One party's money, line by line — the statement an artist should be able to
 * read without asking anyone.
 *
 * `getBalance` answers "how much", which is not the same as "why". This joins
 * each entry back to the sale that caused it, and to the payout that settled
 * it, so "owed for this piece, paid on this date by e-Transfer" is legible
 * from the record rather than from someone's memory.
 */
export async function getEarningsStatement(
  party: Party,
  opts: { limit?: number; currency?: string } = {}
): Promise<EarningsLine[]> {
  assertParty(party);
  const limit = Math.min(opts.limit ?? 100, 500);
  const rows = (await db`
    SELECT
      pl.*,
      o.number AS order_number,
      l.description AS line_description,
      p.method AS payout_method,
      p.reference AS payout_reference,
      EXISTS (
        SELECT 1 FROM payout_ledger r
        WHERE r.releases_entry_id = pl.id AND r.entry_type = 'release'
      ) AS released
    FROM payout_ledger pl
    LEFT JOIN commerce_order o      ON o.id = pl.order_id
    LEFT JOIN commerce_order_line l ON l.id = pl.order_line_id
    LEFT JOIN payout p              ON p.id = pl.payout_id
    WHERE ${partyWhere(party, db)}
      ${opts.currency ? db`AND pl.currency = ${opts.currency}` : db``}
      -- A release carries no money; it explains the accrual it points at,
      -- which already shows as payable once released.
      AND pl.entry_type <> 'release'
    ORDER BY pl.created_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];

  return rows.map((r) => ({
    entryId: r.id as string,
    entryType: r.entry_type as EntryType,
    amountMinor: Number(r.amount_minor),
    currency: r.currency as string,
    createdAt: r.created_at as string,
    held: Boolean(r.hold_reason) && !r.released,
    holdReason: (r.hold_reason as HoldReason | null) ?? null,
    note: (r.note as string | null) ?? null,
    orderNumber: (r.order_number as string | null) ?? null,
    description: (r.line_description as string | null) ?? null,
    payoutMethod: (r.payout_method as string | null) ?? null,
    payoutReference: (r.payout_reference as string | null) ?? null,
  }));
}
