"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  StoreTeamPanel,
  BeneficiariesPanel,
  type StoreTeamMember,
  type BeneficiaryItem,
} from "@elkdonis/cms-ui/store";
import {
  openIfacStoreAction,
  addIfacStoreMemberAction,
  removeIfacStoreMemberAction,
  addIfacCharityAction,
  addIfacOrgBeneficiaryAction,
  removeIfacBeneficiaryAction,
  approveIfacPayeeAction,
} from "@/lib/cms/store-actions";

/**
 * The shared store panels bound to IFAC's actions. The panels are the same
 * ones the network hub mounts (@elkdonis/cms-ui/store); only the actions
 * differ, which is the point of keeping the panels in a package.
 */
export function StorePanels({
  members,
  beneficiaries,
  suggested,
  addableOrgs,
  selfUserId,
}: {
  members: StoreTeamMember[];
  beneficiaries: BeneficiaryItem[];
  suggested: BeneficiaryItem[];
  addableOrgs: BeneficiaryItem[];
  selfUserId: string;
}) {
  const router = useRouter();
  const after = <T extends { ok: boolean }>(p: Promise<T>) =>
    p.then((r) => {
      if (r.ok) router.refresh();
      return r;
    });

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <StoreTeamPanel
        members={members}
        canEdit
        selfUserId={selfUserId}
        heading="Store team — who may list and sell for IFAC"
        onAdd={(email, role) => after(addIfacStoreMemberAction(email, role))}
        onRemove={(userId) => after(removeIfacStoreMemberAction(userId))}
      />
      <BeneficiariesPanel
        items={beneficiaries}
        suggested={suggested}
        addableOrgs={addableOrgs}
        canEdit
        heading="Beneficiaries — where a listing's money may go"
        intro="Charities and organisations a listing can be marked for, and that a buyer may choose at checkout. A charity a buyer suggests waits here until approved."
        onAddCharity={(input) => after(addIfacCharityAction(input))}
        onAddOrg={(id) => after(addIfacOrgBeneficiaryAction(id))}
        onRemove={(id) => after(removeIfacBeneficiaryAction(id))}
        onApprove={(id) => after(approveIfacPayeeAction(id))}
      />
    </div>
  );
}

export function OpenStoreButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <p>
      <button
        type="button"
        className="btn-link"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await openIfacStoreAction();
          setBusy(false);
          if (!r.ok) setError(r.error ?? "Could not open the store.");
          else router.refresh();
        }}
      >
        {busy ? "Opening…" : "Open IFAC's store"}
      </button>
      {error && <span style={{ marginLeft: "0.75rem", color: "var(--eac-danger, #9b2d1f)" }}>{error}</span>}
    </p>
  );
}
