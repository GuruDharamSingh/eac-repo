"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { decideInvitationAction } from "../actions";

type Invitation = { seriesId: string; seriesSlug: string; seriesTitle: string; orgId: string; orgName: string; invitedByName: string | null; invitedAt: string };

export function InvitationList({ invitations, currentSlug }: { invitations: Invitation[]; currentSlug: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  async function decide(i: Invitation, accept: boolean) {
    setBusy(`${i.seriesId}:${i.orgId}`);
    const r = await decideInvitationAction(currentSlug, i.seriesId, i.orgId, accept);
    setBusy(null);
    if (!r.ok) return toast.error(r.error ?? "Could not record your answer.");
    toast.success(accept ? `${i.orgName} is taking part in ${i.seriesTitle}.` : `Declined for ${i.orgName}.`);
    router.refresh();
  }
  if (invitations.length === 0) return <p className="sw-card sw-muted">No open invitations for the organisations you run.</p>;
  return (
    <ul className="sw-list">
      {invitations.map((i) => (
        <li key={`${i.seriesId}:${i.orgId}`} className="sw-card" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <span>
            <strong>{i.orgName}</strong> is invited to take part in <a href={`/series/${i.seriesSlug}`}>{i.seriesTitle}</a>
            <span className="sw-muted" style={{ display: "block" }}>
              {i.invitedByName ? `Asked by ${i.invitedByName} · ` : ""}{new Date(i.invitedAt).toLocaleDateString("en-CA", { dateStyle: "medium" })}.
              Taking part opens the organisation&rsquo;s media folder to the series desk and names it among the partners. Nothing is sold on its behalf.
            </span>
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" className="sw-btn" disabled={busy !== null} onClick={() => decide(i, true)}>Accept</button>
            <button type="button" className="sw-btn is-quiet" disabled={busy !== null} onClick={() => decide(i, false)}>Decline</button>
          </span>
        </li>
      ))}
    </ul>
  );
}
