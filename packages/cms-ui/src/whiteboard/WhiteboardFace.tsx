import { SurfaceCard } from "../surface/SurfaceCard";

/**
 * The whiteboard tile.
 *
 * `size: "full"` because a canvas with a toolbar down one side and a shape
 * library down the other has nothing to give back at `standard` width — this
 * is the one surface in the network that genuinely wants the whole dialog.
 *
 * The glyph is a drawn mark rather than the ✏️ emoji the first version used:
 * an emoji renders in the system's own colour and shape on every platform,
 * which is the one thing a face's glyph must not do — it sits in a medallion
 * tinted with the kind's accent, and a full-colour pencil in it reads as a
 * foreign object on a page of monochrome marks.
 */
export function WhiteboardFace({
  title = "Whiteboard",
  blurb = "A shared canvas — sketch something out together.",
  surfaceTitle = "Whiteboard",
  pageHref = "/hub/whiteboard",
}: {
  title?: string;
  blurb?: string;
  surfaceTitle?: string;
  /**
   * The dedicated page (`fullPage` WhiteboardSurface) the card also links
   * to, beside the popup: a URL to send round or leave open on a second
   * screen. `null` drops the link for a host without the page.
   */
  pageHref?: string | null;
} = {}) {
  return (
    <SurfaceCard
      kind="neutral"
      glyph="✎"
      title={title}
      blurb={blurb}
      surface={{
        type: "custom",
        key: "whiteboard",
        title: surfaceTitle,
        kind: "neutral",
        size: "full",
      }}
      preview={
        pageHref ? (
          // The one live control on the face; the card itself still opens
          // the popup. Not `tools`, which would drop the glyph and the cue.
          <a className="eac-face-live eac-preview-action" href={pageHref}>
            Open as a page
          </a>
        ) : undefined
      }
    />
  );
}
