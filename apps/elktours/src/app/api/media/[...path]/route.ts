import { mediaRoutes } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";

/**
 * Serves files out of Nextcloud: `mediaRoutes` in @elkdonis/services (viewer
 * check, range passthrough, `nosniff`, inline-vs-attachment, the cache rule
 * for private bytes, and `?w=` downscaled variants). This was a hand-rolled
 * proxy, a copy of six others. What stays here is who is asking.
 *
 * The whole network tree: a page here can show files from other owners, and
 * canReadMedia decides access for `Private/` and workshop paths.
 * docs/open/MEDIA_OWNERSHIP_AND_PLACEMENT_2026-11-11.md
 */
export const { GET } = mediaRoutes({
  viewerId: async () => (await getViewer())?.userId ?? null,
});
