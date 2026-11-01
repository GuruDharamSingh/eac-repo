import { db } from "@elkdonis/db";
import type { Payee } from "../types";

// ============================================================================
// Payees: where a listing's money can be directed (migration 209).
//
// A payee is an org on the network or an outside charity. Each org keeps an
// ordered list of the payees it offers on its listings and at checkout
// (`org_beneficiaries`). A buyer may suggest a charity; it sits `suggested`
// until an owner or guide of the managing org approves it, and money
// earmarked to it is held meanwhile (ORG_STORE_BRIEF D5, D6, R2).
//
// Money never moves to a payee from here: the ledger records what is owed and
// a person pays it out, as for orgs.
// ============================================================================

type Row = Record<string, unknown>;

function mapPayee(r: Row): Payee {
  return {
    id: r.id as string,
    kind: r.kind as Payee["kind"],
    orgId: (r.org_id as string | null) ?? null,
    name: r.name as string,
    registrationNo: (r.registration_no as string | null) ?? null,
    website: (r.website as string | null) ?? null,
    blurb: (r.blurb as string | null) ?? null,
    receipting: r.receipting as Payee["receipting"],
    status: r.status as Payee["status"],
    suggestedBy: (r.suggested_by as string | null) ?? null,
    managedByOrgId: (r.managed_by_org_id as string | null) ?? null,
    createdAt: String(r.created_at),
  };
}

/** The payees an org offers, in its chosen order. Active ones only. */
export async function listOrgBeneficiaries(orgId: string): Promise<Payee[]> {
  const rows = (await db`
    SELECT p.* FROM org_beneficiaries ob
    JOIN payee p ON p.id = ob.payee_id
    WHERE ob.org_id = ${orgId} AND p.status = 'active'
    ORDER BY ob.position ASC, p.name ASC
  `) as unknown as Row[];
  return rows.map(mapPayee);
}

/** Every active payee on the network, orgs first. For admin pickers. */
export async function listActivePayees(): Promise<Payee[]> {
  const rows = (await db`
    SELECT * FROM payee WHERE status = 'active'
    ORDER BY (kind = 'org') DESC, name ASC
  `) as unknown as Row[];
  return rows.map(mapPayee);
}

/** Payees waiting for an org's approval. */
export async function listSuggestedPayees(orgId: string): Promise<Payee[]> {
  const rows = (await db`
    SELECT * FROM payee WHERE status = 'suggested' AND managed_by_org_id = ${orgId}
    ORDER BY created_at ASC
  `) as unknown as Row[];
  return rows.map(mapPayee);
}

/** Whether this person may edit an org's beneficiary list: owner, guide, or a network admin. */
async function canManagePayees(userId: string, orgId: string): Promise<boolean> {
  const [row] = (await db`
    SELECT 1 FROM user_organizations
    WHERE user_id = ${userId} AND org_id = ${orgId} AND role IN ('owner', 'guide')
    UNION ALL
    SELECT 1 FROM users WHERE id = ${userId} AND is_admin = true
    LIMIT 1
  `) as unknown as Row[];
  return Boolean(row);
}

/**
 * Add an outside charity to an org's list, creating the payee if the name is
 * new to that org. Owner or guide only.
 */
export async function addCharityPayee(input: {
  orgId: string;
  actorUserId: string;
  name: string;
  registrationNo?: string | null;
  website?: string | null;
  blurb?: string | null;
}): Promise<{ ok: boolean; payee?: Payee; error?: string }> {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Give the charity a name." };
  if (!(await canManagePayees(input.actorUserId, input.orgId))) {
    return { ok: false, error: "Only an owner or admin can edit beneficiaries." };
  }
  const payee = await db.begin(async (tx) => {
    const existing = (await tx`
      SELECT * FROM payee
      WHERE kind = 'charity' AND managed_by_org_id = ${input.orgId}
        AND lower(name) = lower(${name})
      LIMIT 1
    `) as unknown as Row[];
    let row = existing[0];
    if (row) {
      const updated = (await tx`
        UPDATE payee SET
          status = 'active',
          registration_no = COALESCE(${input.registrationNo?.trim() || null}, registration_no),
          website = COALESCE(${input.website?.trim() || null}, website),
          blurb = COALESCE(${input.blurb?.trim() || null}, blurb),
          updated_at = NOW()
        WHERE id = ${row.id as string}
        RETURNING *
      `) as unknown as Row[];
      row = updated[0];
    } else {
      const inserted = (await tx`
        INSERT INTO payee (kind, name, registration_no, website, blurb, status, managed_by_org_id)
        VALUES ('charity', ${name}, ${input.registrationNo?.trim() || null},
                ${input.website?.trim() || null}, ${input.blurb?.trim() || null},
                'active', ${input.orgId})
        RETURNING *
      `) as unknown as Row[];
      row = inserted[0];
    }
    await tx`
      INSERT INTO org_beneficiaries (org_id, payee_id, position, added_by)
      VALUES (${input.orgId}, ${row!.id as string},
              (SELECT COALESCE(MAX(position), 0) + 1 FROM org_beneficiaries WHERE org_id = ${input.orgId}),
              ${input.actorUserId})
      ON CONFLICT (org_id, payee_id) DO NOTHING
    `;
    return mapPayee(row!);
  });
  return { ok: true, payee };
}

/** Put an existing active payee (an org, say) on an org's list. */
export async function addOrgBeneficiary(
  orgId: string,
  payeeId: string,
  actorUserId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManagePayees(actorUserId, orgId))) {
    return { ok: false, error: "Only an owner or admin can edit beneficiaries." };
  }
  await db`
    INSERT INTO org_beneficiaries (org_id, payee_id, position, added_by)
    VALUES (${orgId}, ${payeeId},
            (SELECT COALESCE(MAX(position), 0) + 1 FROM org_beneficiaries WHERE org_id = ${orgId}),
            ${actorUserId})
    ON CONFLICT (org_id, payee_id) DO NOTHING
  `;
  return { ok: true };
}

export async function removeOrgBeneficiary(
  orgId: string,
  payeeId: string,
  actorUserId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManagePayees(actorUserId, orgId))) {
    return { ok: false, error: "Only an owner or admin can edit beneficiaries." };
  }
  await db`DELETE FROM org_beneficiaries WHERE org_id = ${orgId} AND payee_id = ${payeeId}`;
  return { ok: true };
}

/**
 * A buyer names a charity that is not on the list. Recorded as `suggested`
 * under the org that will approve it; money directed to it is held until
 * then (hold reason `pending_beneficiary`, phase C).
 */
export async function suggestPayee(input: {
  orgId: string;
  userId: string | null;
  name: string;
  website?: string | null;
}): Promise<Payee> {
  const name = input.name.trim().slice(0, 200);
  const rows = (await db`
    INSERT INTO payee (kind, name, website, status, suggested_by, managed_by_org_id)
    VALUES ('charity', ${name}, ${input.website?.trim() || null}, 'suggested',
            ${input.userId}, ${input.orgId})
    RETURNING *
  `) as unknown as Row[];
  return mapPayee(rows[0]!);
}

/** Owner or guide approves a suggested charity and puts it on the list. */
export async function approvePayee(
  payeeId: string,
  actorUserId: string,
  patch: { registrationNo?: string | null; website?: string | null; blurb?: string | null } = {}
): Promise<{ ok: boolean; error?: string }> {
  const [row] = (await db`
    SELECT managed_by_org_id FROM payee WHERE id = ${payeeId} AND status = 'suggested'
  `) as unknown as Row[];
  if (!row) return { ok: false, error: "No such suggestion." };
  const orgId = row.managed_by_org_id as string;
  if (!(await canManagePayees(actorUserId, orgId))) {
    return { ok: false, error: "Only an owner or admin can approve beneficiaries." };
  }
  await db.begin(async (tx) => {
    await tx`
      UPDATE payee SET
        status = 'active',
        registration_no = COALESCE(${patch.registrationNo?.trim() || null}, registration_no),
        website = COALESCE(${patch.website?.trim() || null}, website),
        blurb = COALESCE(${patch.blurb?.trim() || null}, blurb),
        updated_at = NOW()
      WHERE id = ${payeeId}
    `;
    await tx`
      INSERT INTO org_beneficiaries (org_id, payee_id, position, added_by)
      VALUES (${orgId}, ${payeeId},
              (SELECT COALESCE(MAX(position), 0) + 1 FROM org_beneficiaries WHERE org_id = ${orgId}),
              ${actorUserId})
      ON CONFLICT (org_id, payee_id) DO NOTHING
    `;
  });
  return { ok: true };
}

/**
 * After a beneficiary has been paid out: send each buyer whose purchase fed
 * that payee the follow-up proceeds statement (ORG_STORE_BRIEF R2), once per
 * order. Non-blocking for the caller; errors are logged.
 */
export async function sendPaidProceedsStatements(payeeId: string): Promise<void> {
  try {
    const rows = (await db`
      SELECT o.number, o.customer_email, o.customer_name, l.description, l.currency,
             l.beneficiary_share_minor - l.processor_fee_minor AS amount_minor, p.name, p.website
      FROM commerce_order_line l
      JOIN commerce_order o ON o.id = l.order_id
      JOIN payee p ON p.id = l.beneficiary_payee_id
      WHERE l.beneficiary_payee_id = ${payeeId}
        AND o.status IN ('paid', 'fulfilled', 'completed')
        AND NOT COALESCE((o.metadata->>'proceedsPaidNotified')::boolean, false)
    `) as unknown as Row[];
    if (rows.length === 0) return;
    const { sendProceedsStatementEmail } = await import("@elkdonis/email");
    const paidOn = new Date().toLocaleDateString("en-CA");
    const byOrder = new Map<string, Row[]>();
    for (const r of rows) {
      const k = r.number as string;
      byOrder.set(k, [...(byOrder.get(k) ?? []), r]);
    }
    for (const [number, lines] of byOrder) {
      await sendProceedsStatementEmail(lines[0]!.customer_email as string, {
        orderNumber: number,
        customerName: (lines[0]!.customer_name as string | null) ?? null,
        paidOn,
        items: lines.map((l) => ({
          description: l.description as string,
          amountMinor: Number(l.amount_minor),
          currency: l.currency as string,
          beneficiaryName: l.name as string,
          beneficiaryWebsite: (l.website as string | null) ?? null,
        })),
      });
      // Merged, not assigned: other features write keys into order metadata.
      await db`
        UPDATE commerce_order
        SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"proceedsPaidNotified": true}'::jsonb
        WHERE number = ${number}
      `;
    }
  } catch (err) {
    console.error("[commerce] sendPaidProceedsStatements:", err);
  }
}
