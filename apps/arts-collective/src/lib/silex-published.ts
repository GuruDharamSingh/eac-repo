/**
 * The Silex-published file helpers now live in @elkdonis/silex-render (shared
 * with the dedicated per-org apps). Re-exported here so existing
 * `@/lib/silex-published` imports (assets + layout API routes) keep working.
 */
export {
  makeSilexPublishedRef,
  parseSilexPublishedRef,
  joinPublishedAssetPath,
  downloadPublishedFile,
  type SilexPublishedRef,
} from "@elkdonis/silex-render";
