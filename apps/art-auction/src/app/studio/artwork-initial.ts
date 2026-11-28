import type { ArtworkFormInitial } from "./_components/artwork-form";

/** The artwork as getArtworkForEdit returns it (commerce queries). */
type EditableArtwork = NonNullable<Awaited<ReturnType<typeof import("@elkdonis/commerce/queries").getArtworkForEdit>>>;

/**
 * The artwork form's `initial` for an existing piece. Shared by /studio/artworks/<id>/edit and the /center
 * artwork popup (center/frames.ts), so both edit the same fields the same way.
 */
export function artworkFormInitial(artwork: EditableArtwork): ArtworkFormInitial {
  const defaultVariant = artwork.variants?.[0];
  const donation = (artwork.provenance ?? []).find((p) => p.kind === "donated") ?? null;
  return {
    id: artwork.id,
    creditedArtistUserId: artwork.creditedArtistUserId ?? null,
    creditedArtistName: artwork.creditedArtistName ?? null,
    creditStatus: artwork.creditStatus,
    estimateLow: artwork.estimateLowMinor != null ? artwork.estimateLowMinor / 100 : null,
    estimateHigh: artwork.estimateHighMinor != null ? artwork.estimateHighMinor / 100 : null,
    donation: donation
      ? {
          fromUserId: donation.fromUserId ?? null,
          fromName: donation.fromName ?? null,
          fromText: donation.fromText ?? null,
          toOrgId: donation.toOrgId ?? null,
          occurredOn: donation.occurredOn ?? null,
          note: donation.note ?? null,
        }
      : null,
    beneficiaryPayeeId: defaultVariant?.beneficiaryPayeeId ?? null,
    beneficiaryScope: defaultVariant?.beneficiaryScope ?? null,
    title: artwork.title,
    descriptionHtml: artwork.descriptionHtml ?? "",
    kind: artwork.kind,
    yearCreated: artwork.yearCreated,
    medium: artwork.medium,
    style: artwork.style,
    subject: artwork.subject,
    heightCm: artwork.heightCm,
    widthCm: artwork.widthCm,
    depthCm: artwork.depthCm,
    certificateOfAuthenticity: artwork.certificateOfAuthenticity,
    provenanceNotes: artwork.provenanceNotes,
    price: defaultVariant ? defaultVariant.priceMinor / 100 : 0,
    currency: (defaultVariant?.currency ?? "CAD") as "CAD" | "USD" | "EUR",
    inventoryQty: defaultVariant?.inventoryQty ?? 1,
    status: artwork.status,
    images: (artwork.media ?? []).map((m) => ({
      id: m.id,
      url: m.url,
      path: m.nextcloudPath ?? undefined,
      nextcloudFileId: m.nextcloudFileId ?? undefined,
      alt: m.alt ?? "",
    })),
  };
}
