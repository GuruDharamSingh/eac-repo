"use server";

import { getArtworkForEdit, getStore } from "@elkdonis/commerce/queries";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { contentHost } from "@/lib/content-host";
import { listingContext } from "@/app/studio/listing-context";
import { artworkFormInitial } from "@/app/studio/artwork-initial";
import type { ArtworkFormInitial, BeneficiaryOption, OrgOption } from "@/app/studio/_components/artwork-form";

export type EditArtworkData =
  | { error: string }
  | {
      error?: undefined;
      initial: ArtworkFormInitial;
      allowMakerChoice: boolean;
      beneficiaries: BeneficiaryOption[];
      orgOptions: OrgOption[];
      sources: Array<{ key: string; label: string }>;
    };

/**
 * What the artwork form needs, for the hub card's in-stack Edit. The viewer is the session. Same rule as the edit
 * page: getArtworkForEdit (the store's owner or a member of its roll). updateArtwork enforces the same on save, so a
 * keeper who is not on the store's roll cannot edit here (they hide/show from the card instead).
 */
export async function loadEditArtworkData(artworkId: string): Promise<EditArtworkData> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Sign in first." };
  const artwork = await getArtworkForEdit(String(artworkId), userId).catch(() => null);
  if (!artwork) return { error: "That piece is not one of your store’s." };
  const store = await getStore(artwork.storeId).catch(() => null);
  if (!store) return { error: "That piece’s store could not be found." };
  const [ctx, fileSources] = await Promise.all([
    listingContext(store),
    (contentHost.fileSources?.({ userId }) ?? Promise.resolve([])).catch(() => []),
  ]);
  return {
    initial: artworkFormInitial(artwork),
    allowMakerChoice: store.ownerKind === "org",
    beneficiaries: ctx.beneficiaries,
    orgOptions: ctx.orgOptions,
    sources: fileSources.map((x) => ({ key: x.key, label: x.label })),
  };
}
