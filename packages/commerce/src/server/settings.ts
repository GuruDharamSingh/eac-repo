import { db } from "@elkdonis/db";
import { jsonb } from "./map-order";

// ============================================================================
// Marketplace settings (migration 209): the flat commission, the bid
// increment ladder, the soft-close minutes and the payment window, one row
// per marketplace org. Edited from the art-auction admin.
// ============================================================================

export interface IncrementStep {
  /** Upper bound of the band in minor units; the last step has none. */
  upTo?: number;
  step: number;
}

export interface MarketplaceSettings {
  orgId: string;
  defaultCommissionRate: number;
  incrementLadder: IncrementStep[];
  softCloseMinutes: number;
  paymentWindowHours: number;
  updatedAt: string;
}

type Row = Record<string, unknown>;

const DEFAULT_LADDER: IncrementStep[] = [
  { upTo: 9999, step: 500 },
  { upTo: 49999, step: 1000 },
  { upTo: 99999, step: 2500 },
  { upTo: 499999, step: 10000 },
  { step: 25000 },
];

function mapSettings(r: Row): MarketplaceSettings {
  const ladder = Array.isArray(r.increment_ladder) ? (r.increment_ladder as IncrementStep[]) : DEFAULT_LADDER;
  return {
    orgId: r.org_id as string,
    defaultCommissionRate: Number(r.default_commission_rate),
    incrementLadder: ladder,
    softCloseMinutes: Number(r.soft_close_minutes),
    paymentWindowHours: Number(r.payment_window_hours),
    updatedAt: String(r.updated_at),
  };
}

export async function getMarketplaceSettings(orgId = "market"): Promise<MarketplaceSettings> {
  const [row] = (await db`SELECT * FROM marketplace_settings WHERE org_id = ${orgId} LIMIT 1`) as unknown as Row[];
  if (row) return mapSettings(row);
  return {
    orgId,
    defaultCommissionRate: 5,
    incrementLadder: DEFAULT_LADDER,
    softCloseMinutes: 5,
    paymentWindowHours: 72,
    updatedAt: new Date(0).toISOString(),
  };
}

/** Admin only; the caller checks. Changes the default for new stores and the auction defaults. */
export async function updateMarketplaceSettings(input: {
  orgId?: string;
  actorUserId: string;
  defaultCommissionRate?: number;
  incrementLadder?: IncrementStep[];
  softCloseMinutes?: number;
  paymentWindowHours?: number;
  /** Also set every store in this marketplace that still carries the old default. */
  applyToStores?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const orgId = input.orgId ?? "market";
  const pct = input.defaultCommissionRate;
  if (pct != null && !(pct >= 0 && pct <= 100)) return { ok: false, error: "Commission must be 0–100%." };
  const ladder = input.incrementLadder;
  if (ladder && (!Array.isArray(ladder) || ladder.some((s) => !(s.step > 0)))) {
    return { ok: false, error: "Every ladder step needs a positive increment." };
  }
  await db.begin(async (tx) => {
    const [before] = (await tx`SELECT default_commission_rate FROM marketplace_settings WHERE org_id = ${orgId}`) as unknown as Row[];
    await tx`
      INSERT INTO marketplace_settings (org_id, updated_by)
      VALUES (${orgId}, ${input.actorUserId})
      ON CONFLICT (org_id) DO NOTHING
    `;
    await tx`
      UPDATE marketplace_settings SET
        default_commission_rate = COALESCE(${pct ?? null}, default_commission_rate),
        increment_ladder = COALESCE(${ladder ? jsonb(ladder) : null}, increment_ladder),
        soft_close_minutes = COALESCE(${input.softCloseMinutes ?? null}, soft_close_minutes),
        payment_window_hours = COALESCE(${input.paymentWindowHours ?? null}, payment_window_hours),
        updated_by = ${input.actorUserId},
        updated_at = NOW()
      WHERE org_id = ${orgId}
    `;
    if (pct != null && input.applyToStores) {
      const old = before ? Number(before.default_commission_rate) : null;
      await tx`
        UPDATE store SET commission_rate = ${pct}
        WHERE org_id = ${orgId}
          AND owner_user_id IS NOT NULL
          ${old != null ? tx`AND commission_rate = ${old}` : tx``}
      `;
    }
  });
  return { ok: true };
}
