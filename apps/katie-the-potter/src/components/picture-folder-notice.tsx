import { Notice } from "@elkdonis/cms-ui/manage";
import { pictureFolderStatus } from "@/lib/site-store";
import { PictureFolderButton } from "@/components/picture-folder-button";

/**
 * On the Overview: shown only when the artist's picture folder is missing
 * (a new account whose set-up after the claim did not finish). The button
 * runs gainSpace again (claim-actions.ts finishPictureFolderAction).
 * Added 2026-11-06 for the onboarding.
 */
export async function PictureFolderNotice({ userId }: { userId: string }) {
  const folder = await pictureFolderStatus(userId);
  if (folder.ready) return null;
  return (
    <Notice>
      <b>Your picture folder isn&rsquo;t set up yet.</b> Pictures for your pieces are kept there, so finish it before adding a piece.{" "}
      <PictureFolderButton />
    </Notice>
  );
}
