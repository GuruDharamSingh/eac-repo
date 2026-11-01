import "server-only";
import { db } from "@elkdonis/db";
import { listOrgBeneficiaries } from "@elkdonis/commerce/server";
import type { Store } from "@elkdonis/commerce/types";
import type { BeneficiaryOption, OrgOption } from "./_components/artwork-form";

/**
 * What the artwork form needs from the store it is listing in (migration
 * 209): the beneficiary list of the store's org (a person's store uses the
 * marketplace org's list), and the orgs a donation may be recorded "to".
 */
export async function listingContext(
  store: Store
): Promise<{ beneficiaries: BeneficiaryOption[]; orgOptions: OrgOption[] }> {
  const listOrg = store.ownerOrgId ?? store.orgId;
  const [payees, orgs] = await Promise.all([
    listOrgBeneficiaries(listOrg).catch(() => []),
    db<Array<{ id: string; name: string }>>`
      SELECT id, name FROM organizations
      WHERE id = ANY(${[listOrg, store.orgId].filter((v, i, a) => a.indexOf(v) === i)})
      ORDER BY (id = ${listOrg}) DESC, name
    `.catch(() => []),
  ]);
  return {
    beneficiaries: payees.map((p) => ({ id: p.id, name: p.name, kind: p.kind, blurb: p.blurb })),
    orgOptions: orgs,
  };
}
