"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormTop, whenLabel } from "./board-bits";
import { roman } from "./roman";
import { respondInvitationAction } from "@/lib/collaborate-actions";

// The artist's own invitations (Board screen 30, Invitations + Coming up), G7b. Accept or decline per date. The fee is
// shown for information only: it is what the experience asked for, nothing here changes it.

export interface InvitationRow {
  id: string;
  status: "proposed" | "accepted" | "declined" | "cancelled" | "completed";
  experienceTitle: string;
  tourTitle: string;
  stop: { position: number; title: string } | null;
  startsAt: string;
  arrivalAt: string | null;
  artistName: string | null;
  /** The guide who asked (their name), for the "{Guide} invites you" headline. */
  guideName?: string | null;
  feeLabel: string | null;
  guestsBooked: number;
}

export function InvitationsView({ rows, isArtistView, home = "/manage" }: { rows: InvitationRow[]; isArtistView: boolean; home?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const asked = rows.filter((r) => r.status === "proposed");
  const coming = rows.filter((r) => r.status === "accepted");

  function answer(id: string, a: "accept" | "decline") {
    setBusy(id);
    start(async () => {
      const r = await respondInvitationAction(id, a);
      setBusy(null);
      if (!r.ok) return void toast.error(r.error);
      toast.success(a === "accept" ? "Accepted. The guide sees it on Collaborate." : "Declined.");
      router.refresh();
    });
  }

  const line = (r: InvitationRow) =>
    `${r.stop ? `Stop ${roman(r.stop.position)} · ${r.stop.title} · ` : ""}${whenLabel(r.arrivalAt ?? r.startsAt)}`;

  return (
    <div className="bf">
      <FormTop href={home} kicker="Board" title="Invitations" />
      <div className="bf-body">
        <div className="bf-field">
          <span className="bf-label">Invitations ({asked.length})</span>
          {asked.length === 0 && <p className="bf-note">Nothing waiting for an answer.</p>}
          {asked.map((r) => (
            <div key={r.id} className="bf-card">
              <h3>{r.guideName ? `${r.guideName} invites you` : "You are invited"}</h3>
              <p>{r.tourTitle}</p>
              <p>{line(r)}</p>
              <p className="bf-meta">{r.experienceTitle}{r.feeLabel ? ` · ${r.feeLabel}` : ""}{!isArtistView && r.artistName ? ` · ${r.artistName}` : ""}</p>
              {isArtistView && (
                <div className="bf-actions">
                  <button type="button" className="bf-btn-fill" disabled={pending && busy === r.id} onClick={() => answer(r.id, "accept")}>Accept</button>
                  <button type="button" className="bf-btn-line" disabled={pending && busy === r.id} onClick={() => answer(r.id, "decline")}>Decline</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="bf-field">
          <span className="bf-label">Coming up ({coming.length})</span>
          {coming.length === 0 && <p className="bf-note">No accepted dates yet.</p>}
          {coming.map((r) => (
            <div key={r.id} className="bf-card">
              <h3>{r.tourTitle}</h3>
              <p>{line(r)}</p>
              <p className="bf-meta">{r.experienceTitle} · {r.guestsBooked} {r.guestsBooked === 1 ? "guest" : "guests"} booked so far{r.feeLabel ? ` · ${r.feeLabel}` : ""}</p>
            </div>
          ))}
        </div>
        <p className="bf-note">The fee is what the experience asked for. It is shown here for information only.</p>
      </div>
    </div>
  );
}
