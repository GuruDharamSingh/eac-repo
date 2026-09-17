import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// A video, from a link.
//
// Dana's site has a Vimeo page, and the honest way to put a film on a page is
// a link the author already has — the one in the browser bar — rather than an
// embed code pasted from a provider's share dialog. Pasted embed code is HTML
// from a third party, and a block library that accepts it is a block library
// that renders arbitrary markup on a public page.
//
// So: a URL goes in, and this recognises the two hosts these sites actually
// use and builds the player address itself. Anything else renders as a plain
// link, which is a working answer rather than a blank rectangle.
// ============================================================================

const props = [
  {
    name: "url",
    kind: "url",
    label: "Video link",
    description: "The address from the browser bar — Vimeo or YouTube.",
    required: true,
  },
  { name: "title", kind: "string", label: "Title", description: "Named for screen readers and shown if the video cannot load.", default: "" },
  { name: "caption", kind: "string", label: "Caption", default: "" },
  {
    name: "width",
    kind: "select",
    label: "Width",
    default: "measure",
    options: [
      { value: "measure", label: "Text width" },
      { value: "wide", label: "Wider than the text" },
      { value: "full", label: "Full width" },
    ],
  },
] as const;

export type VideoProps = PropsOf<typeof props>;

/**
 * Turn a page address into a player address.
 *
 * Returns null for anything unrecognised, which the component treats as "show
 * a link" rather than guessing. Guessing here would mean building an iframe
 * src from arbitrary author input, and an iframe src is a place you do not
 * want a surprise.
 */
export function embedUrlFor(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const host = parsed.hostname.replace(/^www\./, "");

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    // /1234567, /1234567/abcdef (an unlisted video's hash), /channels/x/1234567
    const id = parsed.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
    if (!id) return null;
    const hash = parsed.pathname.split("/").filter(Boolean).pop();
    const unlisted = hash && hash !== id ? `?h=${encodeURIComponent(hash)}` : "";
    return `https://player.vimeo.com/video/${id}${unlisted}`;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = parsed.searchParams.get("v");
    if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
    const embedded = parsed.pathname.match(/^\/embed\/([\w-]{6,20})$/);
    if (embedded) return `https://www.youtube-nocookie.com/embed/${embedded[1]}`;
    return null;
  }

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1);
    if (/^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  }

  return null;
}

export function Video({ url, title = "", caption, width = "measure" }: VideoProps) {
  if (!url) return null;
  const src = embedUrlFor(url);

  return (
    <figure className="blk blk-video" data-width={width}>
      {src ? (
        <div className="blk-video-frame">
          <iframe
            className="blk-video-iframe"
            src={src}
            // Named, because an unlabelled iframe is announced as "frame" and
            // nothing else.
            title={title || "Video"}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            // The player is a third party. It gets to play a film, and nothing
            // else — no same-origin access, no top-level navigation.
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        // Not a host we build players for. A working link beats an empty box.
        <a className="blk-video-fallback" href={url} rel="noopener noreferrer" target="_blank">
          {title || "Watch the video"}
          <span className="blk-sr"> (opens in a new tab)</span>
        </a>
      )}
      {caption ? <figcaption className="blk-video-caption">{caption}</figcaption> : null}
    </figure>
  );
}

export const video = defineBlock(
  {
    id: "video",
    label: "Video",
    category: "content",
    description: "A Vimeo or YouTube film, from its ordinary link.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  Video,
  () => ({
    url: "https://vimeo.com/76979871",
    title: "A film",
    caption: "",
    width: "measure" as const,
  })
);
