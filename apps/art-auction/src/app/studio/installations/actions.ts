"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudioStore } from "@/lib/marketplace-auth";
import {
  createInstallation,
  deleteInstallation,
  getInstallation,
  saveInstallationLayout,
  saveInstallationScene,
  setInstallationVenue,
  updateInstallation,
  type Installation,
  type InstallationPiece,
  type InstallationStatus,
} from "@/lib/installations";
import { isVenueId } from "@/lib/installation-venues";
// The banner-free entry: the client one marks every export as a client reference.
import { isFrameRatio, normalizeLamp } from "@elkdonis/three/hallway/model";

/** A number within [lo, hi], or the fallback when it is not a number. */
function bound(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}

/** The installation, if one of the stores this person acts for owns it. */
async function ownInstallation(id: string): Promise<Installation> {
  const { stores } = await requireStudioStore();
  const installation = await getInstallation(id);
  if (!installation || !stores.some((s) => s.id === installation.storeId)) {
    throw new Error("That installation is not one of yours.");
  }
  return installation;
}

function cleanTitle(raw: unknown): string {
  const title = String(raw ?? "").trim().slice(0, 140);
  return title || "Untitled collection";
}

export async function createInstallationAction(formData: FormData) {
  const { userId, store } = await requireStudioStore();
  const venue = formData.get("venue");
  const id = await createInstallation(
    store.id,
    cleanTitle(formData.get("title")),
    userId,
    isVenueId(venue) ? venue : "northwest"
  );
  revalidatePath("/studio/installations");
  redirect(`/studio/installations/${id}`);
}

export async function saveLayoutAction(id: string, pieces: InstallationPiece[]) {
  const installation = await ownInstallation(id);
  const sane = pieces
    .filter((p) => typeof p.artworkId === "string" && typeof p.wallId === "string")
    .map((p) => ({
      artworkId: p.artworkId,
      wallId: p.wallId.slice(0, 16),
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      frameId: p.frameId ? String(p.frameId).slice(0, 40) : null,
      scale: Math.min(4, Math.max(0.25, Number(p.scale) || 1)),
      ratio: isFrameRatio(p.ratio) ? p.ratio : "auto",
      crop: {
        x: bound(p.crop?.x, 0, 100, 50),
        y: bound(p.crop?.y, 0, 100, 50),
        zoom: bound(p.crop?.zoom, 1, 3, 1),
      },
      lamp: normalizeLamp(p.lamp),
      sequence: Math.max(1, Math.round(Number(p.sequence) || 1)),
    }));
  const hung = await saveInstallationLayout(installation.id, installation.storeId, sane);
  revalidatePath(`/installations/${id}`);
  return { hung, savedAt: new Date().toISOString() };
}

/** Scene-wide settings (lighting). Bounded in `saveInstallationScene`. */
export async function saveSceneAction(id: string, scene: unknown) {
  const installation = await ownInstallation(id);
  await saveInstallationScene(installation.id, scene);
  revalidatePath(`/installations/${id}`);
  return { savedAt: new Date().toISOString() };
}

export async function renameInstallationAction(id: string, title: string) {
  await ownInstallation(id);
  await updateInstallation(id, { title: cleanTitle(title) });
  revalidatePath("/studio/installations");
}

export async function setInstallationStatusAction(id: string, status: InstallationStatus) {
  await ownInstallation(id);
  await updateInstallation(id, { status: status === "published" ? "published" : "draft" });
  revalidatePath("/studio/installations");
  revalidatePath(`/installations/${id}`);
}

export async function setInstallationVenueAction(id: string, venueId: string) {
  await ownInstallation(id);
  if (!isVenueId(venueId)) throw new Error("Unknown space.");
  await setInstallationVenue(id, venueId);
  revalidatePath(`/studio/installations/${id}`);
  revalidatePath(`/installations/${id}`);
}

export async function deleteInstallationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await ownInstallation(id);
  await deleteInstallation(id);
  revalidatePath("/studio/installations");
  redirect("/studio/installations");
}
