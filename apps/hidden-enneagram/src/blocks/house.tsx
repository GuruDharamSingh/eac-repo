import { defineBlock, RichText, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// Round 3 (2026-11-07): the quiet house blocks of the redesign.
//
//   he-welcome  "Welcome." band: art-auction's home letter (.hw) in Ario's
//               palette: a large serif word and a short rule on the left, a
//               letter and one link on the right. Stacks on a phone.
//   he-orb      A glow: the white-core radial "orb" set between
//               bands. Decorative only.
//   he-works    Work impressions: pictures, recordings and video, each with a
//               caption. A graceful line until Ario supplies media.
//
// Ids, prop and part names are stored in page JSON: never rename.
// ============================================================================

// ── he-welcome ──────────────────────────────────────────────────────────────

const welcomeProps = [
  { name: "heading", kind: "string", label: "Greeting", default: "Welcome.", inlineEditable: true },
  { name: "subline", kind: "string", label: "Line under the rule", default: "A letter from Ario", inlineEditable: true },
  { name: "body", kind: "richtext", label: "Letter", default: "<p>Write the letter here.</p>" },
  { name: "signature", kind: "string", label: "Signed", default: "Ario", inlineEditable: true },
  { name: "linkLabel", kind: "string", label: "Link", description: "Empty = no link.", default: "About Ario" },
  { name: "linkHref", kind: "url", label: "Link goes to", default: "/about" },
] as const;

type WelcomeProps = PropsOf<typeof welcomeProps>;

export function HeWelcome({ heading, subline, body, signature, linkLabel, linkHref }: WelcomeProps) {
  const link = typeof linkLabel === "string" && linkLabel.trim() && typeof linkHref === "string" && linkHref.trim();
  return (
    <section className="blk he-welcome">
      <div className="he-welcome-in">
        <div className="he-welcome-left">
          {heading ? <h1 className="he-welcome-heading">{heading}</h1> : null}
          <span className="he-welcome-rule" aria-hidden="true" />
          {subline ? <p className="he-welcome-subline">{subline}</p> : null}
        </div>
        <div className="he-welcome-right">
          <RichText className="he-welcome-body" body={body} />
          {signature ? <p className="he-welcome-sign">— {signature}</p> : null}
          {link ? (
            <a className="he-welcome-link" href={linkHref as string}>
              {linkLabel} →
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export const heWelcome = defineBlock(
  {
    id: "he-welcome",
    label: "Welcome",
    category: "headers",
    description: "A quiet first band: a large greeting and a short rule beside a letter and one link.",
    memberSafe: true,
    styling: "tokens",
    props: welcomeProps,
    parts: {
      root: { label: "Welcome", sel: "> .he-welcome" },
      heading: { label: "Greeting", sel: "> .he-welcome .he-welcome-heading", prop: "heading" },
      rule: { label: "Rule", sel: "> .he-welcome .he-welcome-rule" },
      subline: { label: "Line under the rule", sel: "> .he-welcome .he-welcome-subline", prop: "subline" },
      body: { label: "Letter", sel: "> .he-welcome .he-welcome-body", prop: "body" },
      link: { label: "Link", sel: "> .he-welcome .he-welcome-link", prop: "linkLabel" },
    },
    tokens: [
      { name: "--he-ink", label: "Ink", type: "color" },
      { name: "--he-ink-dim", label: "Letter ink", type: "color" },
      { name: "--he-aurum", label: "Accent (rule, link)", type: "color" },
    ],
  },
  HeWelcome,
);

// ── he-orb ──────────────────────────────────────────────────────────────────

const orbProps = [
  {
    name: "size",
    kind: "select",
    label: "Size",
    default: "medium",
    options: [
      { value: "small", label: "Small" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large" },
    ],
  },
] as const;

export function HeOrb({ size = "medium" }: PropsOf<typeof orbProps>) {
  return (
    <div className="blk he-orb-band" aria-hidden="true">
      <div className="he-orb" data-size={size} />
    </div>
  );
}

export const heOrb = defineBlock(
  {
    id: "he-orb",
    label: "Glow (orb)",
    category: "content",
    description: "The house ornament between bands: a soft white-core glow on the night ground.",
    memberSafe: true,
    styling: "tokens",
    props: orbProps,
    parts: { root: { label: "Glow", sel: "> .he-orb-band" }, orb: { label: "Orb", sel: "> .he-orb-band .he-orb" } },
    tokens: [],
  },
  HeOrb,
);

// ── he-works ────────────────────────────────────────────────────────────────

const worksProps = [
  { name: "eyebrow", kind: "string", label: "Eyebrow", default: "Work impressions", inlineEditable: true },
  { name: "heading", kind: "string", label: "Heading", default: "From the work", inlineEditable: true },
  { name: "intro", kind: "text", label: "Line under the heading", default: "" },
  {
    name: "items",
    kind: "rows",
    label: "Pictures, recordings, video",
    addLabel: "Add one",
    summary: ["caption"],
    fields: [
      { name: "picture", kind: "image", label: "Picture (or a video's poster)", default: "" },
      { name: "media", kind: "url", label: "Recording or video file (.mp3, .m4a, .mp4, .webm), or a link", default: "" },
      { name: "caption", kind: "string", label: "Caption", default: "" },
      { name: "alt", kind: "string", label: "Picture description", default: "" },
    ],
    default: [],
  },
  {
    name: "emptyNote",
    kind: "string",
    label: "Shown while there is nothing",
    default: "Pictures, recordings and video from Ario’s sessions and workshops will appear here.",
  },
] as const;

type WorksProps = PropsOf<typeof worksProps>;

const AUDIO = /\.(mp3|m4a|wav|ogg|oga|aac|flac)(\?.*)?$/i;
const VIDEO = /\.(mp4|webm|mov|m4v)(\?.*)?$/i;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function HeWorks({ eyebrow, heading, intro, items = [], emptyNote }: WorksProps) {
  const rows = (Array.isArray(items) ? items : []).filter((r) => str(r.picture) || str(r.media));
  return (
    <section className="blk he-works" data-empty={rows.length ? undefined : "yes"}>
      <header className="he-band-head">
        {eyebrow ? <p className="he-eyebrow">{eyebrow}</p> : null}
        {heading ? <h2 className="he-band-title">{heading}</h2> : null}
        {intro ? <p className="he-band-intro">{intro}</p> : null}
      </header>
      {rows.length === 0 ? (
        <p className="he-works-empty">{emptyNote}</p>
      ) : (
        <ul className="he-works-wall">
          {rows.map((r, i) => {
            const picture = str(r.picture);
            const media = str(r.media);
            const caption = str(r.caption);
            const alt = str(r.alt);
            return (
              <li key={`${picture || media}-${i}`} className="he-works-item">
                {media && AUDIO.test(media) ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {picture ? <img src={picture} alt={alt} loading="lazy" /> : <div className="he-orb" data-size="small" aria-hidden="true" />}
                    <audio controls preload="none" src={media} />
                  </>
                ) : media && VIDEO.test(media) ? (
                  <video controls preload="none" src={media} poster={picture || undefined} />
                ) : media ? (
                  <a href={media} rel="noopener" target="_blank" className="he-works-link">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {picture ? <img src={picture} alt={alt} loading="lazy" /> : <span className="he-works-play">Open ↗</span>}
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={picture} alt={alt} loading="lazy" />
                )}
                {caption ? <p className="he-works-caption">{caption}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export const heWorks = defineBlock(
  {
    id: "he-works",
    label: "Work impressions",
    category: "content",
    description: "Pictures, recordings and video of the work, each with a caption; a quiet line until there are any.",
    memberSafe: true,
    styling: "tokens",
    props: worksProps,
    parts: {
      root: { label: "Work impressions", sel: "> .he-works" },
      eyebrow: { label: "Eyebrow", sel: "> .he-works .he-eyebrow", prop: "eyebrow" },
      heading: { label: "Heading", sel: "> .he-works .he-band-title", prop: "heading" },
      wall: { label: "Wall", sel: "> .he-works .he-works-wall" },
      caption: { label: "Captions", sel: "> .he-works .he-works-caption" },
    },
    tokens: [
      { name: "--he-ink", label: "Ink", type: "color" },
      { name: "--he-ink-dim", label: "Caption ink", type: "color" },
    ],
  },
  HeWorks,
);
