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
  openStoreAction,
  addMemberAction,
  removeMemberAction,
  addCharityAction,
  addOrgBeneficiaryAction,
  removeBeneficiaryAction,
  approvePayeeAction,
} from "./actions";

export function HubStorePanels({
  orgId,
  orgName,
  members,
  beneficiaries,
  suggested,
  addableOrgs,
  selfUserId,
}: {
  orgId: string;
  orgName: string;
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
    <div className="space-y-6">
      <StoreTeamPanel
        members={members}
        canEdit
        selfUserId={selfUserId}
        heading={`Store team — who may list and sell for ${orgName}`}
        onAdd={(email, role) => after(addMemberAction(orgId, email, role))}
        onRemove={(userId) => after(removeMemberAction(orgId, userId))}
      />
      <BeneficiariesPanel
        items={beneficiaries}
        suggested={suggested}
        addableOrgs={addableOrgs}
        canEdit
        heading="Beneficiaries — where a listing's money may go"
        intro="Charities and organisations a listing can be marked for, and that a buyer may choose at checkout. A charity a buyer suggests waits here until approved."
        onAddCharity={(input) => after(addCharityAction(orgId, input))}
        onAddOrg={(id) => after(addOrgBeneficiaryAction(orgId, id))}
        onRemove={(id) => after(removeBeneficiaryAction(orgId, id))}
        onApprove={(id) => after(approvePayeeAction(orgId, id))}
      />
    </div>
  );
}

export function OpenStoreButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await openStoreAction(orgId);
          setBusy(false);
          if (!r.ok) setError(r.error ?? "Could not open the store.");
          else router.refresh();
        }}
      >
        {busy ? "Opening…" : `Open ${orgName}'s store`}
      </button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
