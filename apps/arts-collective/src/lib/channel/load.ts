import "server-only";
import { loadChannelModel as loadShared, outletName, type LoadParams, type ChannelViewer } from "@elkdonis/channel/load";
import type { ChannelModel } from "@elkdonis/channel/model";
import { getOrgHomeUrl } from "@/lib/org-url";

// Shim (2026-11-12): the loader moved to packages/channel; this passes
// arts-collective's org URL builder so existing call sites are unchanged.
export { outletName };
export type { LoadParams, ChannelViewer };

export function loadChannelModel(user: ChannelViewer, params: LoadParams): Promise<ChannelModel> {
  return loadShared(user, params, { getOrgHomeUrl });
}
