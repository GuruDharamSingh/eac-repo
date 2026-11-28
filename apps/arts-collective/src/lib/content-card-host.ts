import {
  getStorageSlug,
  listUserMemberships,
  orgStorageRoot,
  userStorageRoot,
} from "@elkdonis/services";
import type { ContentHost } from "@elkdonis/content/host";
import { contentHost } from "@/lib/content-host";

/**
 * The Content card's host: the app's ContentHost plus `fileSources`, so the library's Files view and its
 * upload route know where this person's files are. Everything is built from the SESSION's memberships:
 *   mine         the person's own folder, Private/ included (it is theirs)
 *   org:<id>     the team folder of every org where they are a member or above (a follower, role "viewer",
 *                has none: the old team-folder route refused them too). Owners and guides see Private/ there,
 *                a member does not.
 * Writing to `org:<id>` is the upload route's own check (mayManageOrg: owners and guides only).
 */
export const contentCardHost: ContentHost = {
  ...contentHost,
  fileSources: async (viewer) => {
    const out: Array<{ key: string; label: string; root: string; showPrivate?: boolean }> = [];
    const slug = await getStorageSlug(viewer.userId);
    if (slug) out.push({ key: "mine", label: "My files", root: userStorageRoot(slug), showPrivate: true });
    try {
      for (const m of await listUserMemberships(viewer.userId)) {
        if (m.role === "viewer") continue;
        out.push({
          key: `org:${m.orgId}`,
          label: `${m.orgName} team folder`,
          root: orgStorageRoot(m.orgId),
          showPrivate: m.role === "owner" || m.role === "guide",
        });
      }
    } catch (err) {
      console.error("[content-card-host] org file sources:", err);
    }
    return out;
  },
};
