import { getStoreForUser } from "@elkdonis/commerce/queries";
import { canActForStore } from "@elkdonis/commerce/server";
import type { Store } from "@elkdonis/commerce/types";
import { getApiEditor, getSiteOwnerUserId, requireOrgEditor, type Viewer } from "@/lib/auth";

// ============================================================================
// The /manage console's two gates, in one place.
//
//   SITE role  (user_organizations, org `katie-the-potter`): owner or guide may
//              open /manage and edit pages. Checked by requireOrgEditor in the
//              layout AND again here, on every page and every server action.
//   STORE role (the store's owner or member roll in the marketplace): what
//              lets someone list, price and settle. Katie is the store's
//              owner; a site guide who is not on the store's team can look but
//              not change, and is told why.
//
// A client component is not an authorisation boundary, so nothing here is
// decided in the browser.
// ============================================================================

export interface ManageCtx {
  viewer: Viewer;
  /** The site owner's marketplace store, in any status; null before one exists. */
  store: Store | null;
  ownerUserId: string | null;
  /** The viewer owns the store itself. */
  isStoreOwner: boolean;
  /** The viewer may act for the store (owner, or on its team) and the store is open. */
  canAct: boolean;
}

/** For pages: gate on the site role (redirecting to /login), then load the store and what the viewer may do with it. */
export async function loadManageCtx(returnTo = "/manage"): Promise<ManageCtx> {
  const viewer = await requireOrgEditor(returnTo);
  const ownerUserId = await getSiteOwnerUserId();
  const store = ownerUserId ? await getStoreForUser(ownerUserId).catch(() => null) : null;
  const isStoreOwner = Boolean(store && store.ownerUserId === viewer.userId);
  const onTeam = store ? isStoreOwner || (await canActForStore(viewer.userId, store.id).catch(() => false)) : false;
  return { viewer, store, ownerUserId, isStoreOwner, canAct: Boolean(store && store.status === "active" && onTeam) };
}

export type StoreGuard = { ok: true; viewer: Viewer; store: Store } | { ok: false; message: string };

/** For server actions: the same two gates, returning a message rather than redirecting or throwing. */
export async function guardStore(): Promise<StoreGuard> {
  const viewer = await getApiEditor();
  if (!viewer) return { ok: false, message: "Please sign in as an editor of this site." };
  const ownerUserId = await getSiteOwnerUserId();
  const store = ownerUserId ? await getStoreForUser(ownerUserId).catch(() => null) : null;
  if (!store) return { ok: false, message: "This site has no store yet, so there is nothing to change." };
  if (store.status !== "active") {
    return { ok: false, message: "The store is still waiting for approval. Pieces and orders open once it is active." };
  }
  const isOwner = store.ownerUserId === viewer.userId;
  if (!isOwner && !(await canActForStore(viewer.userId, store.id).catch(() => false))) {
    return {
      ok: false,
      message: `You are signed in as ${viewer.role ?? "an editor"} of the site, but only the store's owner (or someone on its team) can change pieces and orders. Sign in as the store owner, or ask her to add you.`,
    };
  }
  return { ok: true, viewer, store };
}
