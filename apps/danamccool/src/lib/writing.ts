import { canEditProfile } from "@elkdonis/services";
import { getSiteOwnerUserId, getViewer } from "./auth";

/** Whose blog, and may the viewer write on it. Server only. */
export async function blogContext() {
  const [authorId, viewer] = await Promise.all([getSiteOwnerUserId(), getViewer()]);
  const canWrite = Boolean(authorId && viewer && (await canEditProfile(viewer.userId, authorId)));
  return { authorId, canWrite };
}
