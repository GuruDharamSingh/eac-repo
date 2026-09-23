// ============================================================================
// The server half of the library.
//
// Separate entry point on purpose: a page that only DISPLAYS blocks imports
// from "@elkdonis/blocks" and never pulls @elkdonis/db into its graph. Only a
// caller that wants a block to fetch for itself reaches in here.
// ============================================================================

export {
  ThreadFeedBlock,
  loadThreadFeed,
  type ThreadFeedBlockProps,
  type LoadThreadFeedOptions,
} from "./server/thread-feed.server";

export {
  ProfileGalleryBlock,
  loadProfileGallery,
  type ProfileGalleryBlockProps,
  type LoadProfileGalleryOptions,
} from "./server/profile.server";

export {
  ProfileStoreBlock,
  loadProfileStore,
  type ProfileStoreBlockProps,
  type LoadProfileStoreOptions,
} from "./server/profile.server";

export {
  loadGalleryGridData,
  loadNestedGalleries,
  type LoadGalleryGridOptions,
} from "./server/gallery-grid.server";

export { storePanelServerResolvers } from "./server/store-panel.server";

export {
  ProfileFeedBlock,
  loadProfileFeed,
  ProfileGalleriesBlock,
  loadProfileGalleries,
  type ProfileFeedBlockProps,
  type LoadProfileFeedOptions,
  type ProfileGalleriesBlockProps,
  type LoadProfileGalleriesOptions,
} from "./server/profile.server";
