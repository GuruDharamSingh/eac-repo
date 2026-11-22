import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// m-page-title (G2, 2026-11-15): kicker, big title, intro line and a "Read more"
// link. Screens 01, 02, 06, 11, 12, 15 of the phone design. Every word is the
// owner's (inlineEditable). The count in the kicker ("Paris · 6 tours") is the
// one data word: it comes from the resolver as `count` and is never stored.
// Colours and fonts read the site's variables only; the --m-* / --site-font-kicker
// ones fall back to values derived from the existing ones.
// ============================================================================

const props = [
  { name: "tight", kind: "boolean", label: "Less space above (under a masthead)", default: false },
  { name: "backgroundImage", kind: "image", label: "Cover picture behind the title", description: "Empty: no picture (or the first tour's cover when the next switch is on).", default: "" },
  { name: "coverBackground", kind: "boolean", label: "With no picture, use the first tour's cover", default: false },
  { name: "kicker", kind: "string", label: "Kicker", default: "Paris", inlineEditable: true },
  { name: "showCount", kind: "boolean", label: "Show the number of tours after the kicker", default: false },
  { name: "countLabel", kind: "string", label: "Word after the number", default: "tours", inlineEditable: true },
  { name: "title", kind: "string", label: "Title", description: "Empty: no heading here (Discover's heading is in the masthead).", default: "Tours", inlineEditable: true },
  { name: "intro", kind: "text", label: "Intro", default: "", inlineEditable: true },
  { name: "readMoreLabel", kind: "string", label: "Read more label", description: "Empty: no link.", default: "Read more", inlineEditable: true },
  { name: "readMoreHref", kind: "url", label: "Read more goes to", default: "/about" },
] as const;

export type MPageTitleProps = PropsOf<typeof props> & {
  /** From the resolver. Never stored. */
  count?: number | null;
  /** From the resolver (a tour cover). Never stored. */
  cover?: string | null;
};

export function MPageTitle({ tight, kicker, showCount, countLabel, title, intro, readMoreLabel, readMoreHref = "/about", count, backgroundImage, cover }: MPageTitleProps) {
  const bg = (typeof backgroundImage === "string" && backgroundImage) || (typeof cover === "string" && cover) || "";
  const hasCount = !!showCount && typeof count === "number";
  return (
    <header className={`blk blk-mpt${tight ? " blk-mpt--tight" : ""}${bg ? " blk-mpt--cover" : ""}`}>
      {bg ? (
        <>
          <span className="blk-mpt-bg" aria-hidden="true" style={{ backgroundImage: `url("${bg.replace(/"/g, "%22")}")` }} />
          <span className="blk-mpt-veil" aria-hidden="true" />
        </>
      ) : null}
      {(kicker || hasCount) && (
      <p className="blk-mpt-kicker m-kicker">
        <span className="blk-mpt-kicker-text">{kicker}</span>
        {hasCount && (
          <>
            {" · "}
            {count} <span className="blk-mpt-count-label">{countLabel}</span>
          </>
        )}
      </p>
      )}
      {title ? <h1 className="blk-mpt-title">{title}</h1> : null}
      {(intro || readMoreLabel) && (
        <p className="blk-mpt-intro">
          {intro}
          {intro && readMoreLabel ? " " : null}
          {readMoreLabel && (
            <a
              className="blk-mpt-more"
              href={typeof readMoreHref === "string" && readMoreHref ? readMoreHref : "/about"}
            >
              {readMoreLabel}
            </a>
          )}
        </p>
      )}
    </header>
  );
}

export const mPageTitle = defineBlock(
  {
    id: "m-page-title",
    category: "headers",
    label: "Phone page title",
    description: "Kicker, title, intro line and a Read more link, as at the top of the phone Tours page.",
    memberSafe: true,
    dataDriven: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Title block", sel: "> .blk-mpt" },
      kicker: { label: "Kicker", sel: ".blk-mpt-kicker-text", prop: "kicker" },
      countLabel: { label: "Word after the number", sel: ".blk-mpt-count-label", prop: "countLabel", draws: { props: { showCount: true } } },
      title: { label: "Title", sel: ".blk-mpt-title", prop: "title" },
      intro: { label: "Intro", sel: ".blk-mpt-intro" },
      more: { label: "Read more", sel: ".blk-mpt-more", prop: "readMoreLabel" },
    },
  },
  MPageTitle,
  () => ({ kicker: "Paris", showCount: true, countLabel: "tours", title: "Tours", intro: "Walks, studios and tables, each led by a guide on set dates.", readMoreLabel: "Read more", readMoreHref: "/about", count: 6 })
);
