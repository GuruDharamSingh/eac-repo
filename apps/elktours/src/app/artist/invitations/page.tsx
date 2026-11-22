import type { Metadata } from "next";
import { InvitationsView, type InvitationRow } from "@/components/mobile/invitations-view";
import { listInvitations } from "@/lib/collaborate";
import { ArtistTabBar } from "@/components/mobile/board-nav";
import { requireOrgMember } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invitations", robots: { index: false, follow: false } };

const fee = (cents: number | null, unit: string, currency: string | null) =>
  cents == null ? null : `${new Intl.NumberFormat("en-GB", { style: "currency", currency: (currency ?? "eur").toUpperCase(), maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100)} ${unit === "per_guest" ? "per guest" : "per run"}`;

/** The artist's own invitations (G7c). listInvitations scopes to the viewer for non-editors. */
export default async function ArtistInvitationsPage() {
  const viewer = await requireOrgMember("/artist/invitations");
  const list = await listInvitations({ artistUserId: viewer.userId, upcomingOnly: true });
  const rows: InvitationRow[] = list.filter((i) => i.status === "proposed" || i.status === "accepted").map((i) => ({
    id: i.id, status: i.status, experienceTitle: i.experience.title, tourTitle: i.tour.title,
    stop: i.stop ? { position: i.stop.number, title: i.stop.title } : null, startsAt: i.startsAt, arrivalAt: i.arrivalAt,
    artistName: i.artist.name, guideName: i.guide?.name ?? null, feeLabel: fee(i.feeCents, i.unit, i.currency), guestsBooked: i.guestsBooked,
  }));
  return <div className="elk-m m-col"><InvitationsView rows={rows} isArtistView home="/artist" /><ArtistTabBar waiting={rows.filter((r) => r.status === "proposed").length} /></div>;
}
