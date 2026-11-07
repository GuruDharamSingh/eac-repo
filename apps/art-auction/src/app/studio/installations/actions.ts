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
import { cleanPieces } from "@/lib/installation-input";
import { isVenueId } from "@/lib/installation-venues";

/** The installation, if one of the stores this person acts for owns it. */
async function ownInstallation(id: string): Promise<Installation> {
  const { stores } = await requireStudioStore();
  const installation = await getInstallation(id);
  if (!installation?.storeId || !stores.some((s) => s.id === installation.storeId)) {
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
  const sane = cleanPieces(pieces);
  const hung = await saveInstallationLayout(installation.id, { storeId: installation.storeId! }, sane);
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
