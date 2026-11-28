import { adminListActiveCarts } from "@elkdonis/commerce/queries";
import { listHeld, listPayable, getMarketplaceSettings } from "@elkdonis/commerce/server";
import { db } from "@elkdonis/db";
import type { OwedRow } from "./money-panels";

/**
 * What the money console shows: held entries, active carts, who is owed, the marketplace settings and suggested
 * beneficiaries. Shared by /admin/money and the /hub Money popup (hub/frames.ts). The caller gates (requireAdmin).
 */
export async function loadAdminMoney() {
  const [held, carts, payable, settings, suggested] = await Promise.all([
    listHeld({ limit: 50 }).catch(() => []),
    adminListActiveCarts({ limit: 25 }),
    listPayable({ limit: 100 }).catch(() => []),
    getMarketplaceSettings("market"),
    db<Array<{ id: string; name: string; website: string | null; managed_by_org_id: string | null }>>`
      SELECT p.id, p.name, p.website, p.managed_by_org_id
      FROM payee p WHERE p.status = 'suggested' ORDER BY p.created_at ASC
    `.catch(() => []),
  ]);
  const owed: OwedRow[] = payable.map((p) => ({
    partyKind: p.party.kind,
    partyId: p.party.userId ?? p.party.orgId ?? p.party.payeeId ?? "",
    partyName: p.partyName ?? p.party.userId ?? p.party.orgId ?? p.party.payeeId ?? "platform",
    payableMajor: p.payableMinor / 100,
    heldMajor: p.heldMinor / 100,
    currency: p.currency,
    owedSince: p.owedSince,
    payoutMethod: p.payoutMethod,
    payoutEmail: p.payoutEmail,
  }));
  return { held, carts, owed, settings, suggested: [...suggested] };
}
