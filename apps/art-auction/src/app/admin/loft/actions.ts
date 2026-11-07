"use server";

import { revalidatePath } from "next/cache";
import { getPagesEditor } from "@/lib/puck/auth";
import { siteConfig } from "@/config/site";
import { cleanPieces } from "@/lib/installation-input";
import { getInstallation, saveInstallationLayout, saveInstallationScene, type InstallationPiece } from "@/lib/installations";
import { isLandingInstallation, publishLanding, revertLanding } from "@/lib/landing-loft";

// The landing loft's editor actions (/admin/loft). Each checks that the caller
// edits the site's pages and that the id is the landing installation itself,
// so these cannot write another installation.

async function landing(id: string) {
  if (!(await getPagesEditor())) throw new Error("Only the site's owners can change the landing page.");
  if (!(await isLandingInstallation(id))) throw new Error("That is not the landing loft.");
  const installation = await getInstallation(id);
  if (!installation) throw new Error("The landing loft is missing.");
  return installation;
}

export async function saveLandingLayoutAction(id: string, pieces: InstallationPiece[]) {
  const installation = await landing(id);
  const hung = await saveInstallationLayout(installation.id, { orgId: siteConfig.marketplaceOrgId }, cleanPieces(pieces));
  return { hung, savedAt: new Date().toISOString() };
}

export async function saveLandingSceneAction(id: string, scene: unknown) {
  const installation = await landing(id);
  await saveInstallationScene(installation.id, scene);
  return { savedAt: new Date().toISOString() };
}

/** "Put on the landing page". */
export async function publishLandingAction(id: string): Promise<{ ok: boolean; at?: string; error?: string }> {
  try {
    const installation = await landing(id);
    const snapshot = await publishLanding(installation);
    revalidatePath("/");
    revalidatePath("/admin/pages");
    return { ok: true, at: snapshot.at };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not publish." };
  }
}

/** "Go back to what visitors see". */
export async function revertLandingAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const installation = await landing(id);
    return (await revertLanding(installation)) ? { ok: true } : { ok: false, error: "Nothing has been put on the page yet." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not go back." };
  }
}
