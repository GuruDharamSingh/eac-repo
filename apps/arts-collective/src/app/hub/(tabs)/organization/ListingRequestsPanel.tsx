"use client";

import { ListingRequests, type ListingRequestItem } from "@elkdonis/cms-ui/center";
import { decideListingRequestAction } from "./listing-actions";

/** Binds the shared panel to this org's server action. */
export function ListingRequestsPanel({
  orgId,
  orgName,
  requests,
}: {
  orgId: string;
  orgName: string;
  requests: ListingRequestItem[];
}) {
  return (
    <ListingRequests
      orgName={orgName}
      requests={requests}
      decide={(id, decision) => decideListingRequestAction(orgId, id, decision)}
    />
  );
}
