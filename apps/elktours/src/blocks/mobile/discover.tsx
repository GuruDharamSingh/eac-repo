import Link from "next/link";
import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { ArchFrame, CatalogueRow, Porthole, SectionHeader } from "@/components/mobile";
import { FeaturedRouteMap, GuidesView, MastheadView } from "./views.client";
import { PlacesShelfView } from "./places-shelf.client";
import { TourQuickLink } from "./tour-quick-link";
import type { MobileExperience, MobileFeatured, MobileFeedLead, MobileGuide, MobilePlace } from "./types";

// ============================================================================
// Discover (screen 01), G3a. One declaration per band. Words around the data are the owner's (inlineEditable, with
// `prop:` parts); the data (tours, places, people, posts) is locked and arrives through resolvers (lib/puck/
// mobile-discover.ts), never stored. EMPTY STATES: each data block says below what it does with nothing to show.
// ============================================================================

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

/* ---- m-masthead: wordmark, city pill (opens the City sheet), issue rule. Static copy, no data. ---- */
const mastProps = [
  { name: "wordTop", kind: "string", label: "Wordmark, first line", default: "Elkdonis", inlineEditable: true },
  { name: "wordBottom", kind: "string", label: "Wordmark, second line", default: "Experiences", inlineEditable: true },
  { name: "city", kind: "string", label: "City", default: "Paris", inlineEditable: true },
  { name: "line", kind: "string", label: "Title after the city button", description: "The page heading begins with the city button and continues with these words. Empty: the button sits beside the wordmark instead.", default: "", inlineEditable: true },
  { name: "issueLabel", kind: "string", label: "Issue line", description: "Empty: no line.", default: "", inlineEditable: true },
  { name: "loginLabel", kind: "string", label: "City sheet: log in (signed out)", default: "Log in", inlineEditable: true },
  { name: "accountLabel", kind: "string", label: "City sheet: account (signed in without a name)", default: "Account", inlineEditable: true },
  { name: "sheetTitle", kind: "string", label: "City sheet title", default: "Choose a city" },
  { name: "moreTitle", kind: "string", label: "City sheet: more cities heading", default: "More cities coming" },
  { name: "suggestLabel", kind: "string", label: "City sheet: suggest button", default: "Suggest an artist or place", inlineEditable: true },
  { name: "moreText", kind: "text", label: "City sheet: more cities line", default: "Florence and Lisbon open in spring 2027. Kyoto and Mexico City are being planned." },
  // A picture or film behind the header text (2026-11-21). Off while both are empty: the header is then drawn exactly as before.
  { name: "cover", kind: "image", label: "Picture behind the header", description: "Empty: no picture, the header looks as it always did.", default: "" },
  { name: "coverVideo", kind: "url", label: "Film behind the header (optional)", description: "Plays muted and looped over the picture. The picture shows until it loads.", default: "" },
  { name: "wash", kind: "number", label: "How dark the wash is", description: "A veil of the page colour over the media so the words stay readable.", default: 55, min: 0, max: 100, step: 5, unit: "%" },
  { name: "textAt", kind: "select", label: "Where the text sits", default: "top", options: [{ value: "top", label: "Top" }, { value: "middle", label: "Middle" }, { value: "bottom", label: "Bottom" }] },
  { name: "coverHeight", kind: "number", label: "Header height with a picture", default: 360, min: 200, max: 700, step: 10, unit: "px" },
] as const;
export type MMastheadProps = PropsOf<typeof mastProps>;
export const mMasthead = defineBlock(
  {
    id: "m-masthead", category: "headers", label: "Phone masthead", description: "Wordmark and the city menu button that opens the City sheet (with Log in / Account).",
    memberSafe: true, interactive: true, styling: "tokens", props: mastProps,
    reads: [{ from: "viewer", what: "signed-in" }, { from: "site", what: "org" }],
    parts: {
      root: { label: "Masthead", sel: "> .blk-mmast-root" },
      wordTop: { label: "Wordmark, first line", sel: ".blk-mmast-word1", prop: "wordTop" },
      wordBottom: { label: "Wordmark, second line", sel: ".blk-mmast-word2", prop: "wordBottom" },
      city: { label: "City", sel: ".blk-mmast-cityname", prop: "city" },
      line: { label: "Title after the city button", sel: ".blk-mmast-linetext", prop: "line" },
      issue: { label: "Issue line", sel: ".blk-mmast-issue-label", prop: "issueLabel" },
    },
  },
  (p: MMastheadProps & { viewer?: { name: string | null; office?: boolean } | null }) => <MastheadView viewer={p.viewer} loginLabel={str(p.loginLabel, "Log in")} accountLabel={str(p.accountLabel, "Account")} wordTop={p.wordTop} wordBottom={p.wordBottom} city={p.city} line={p.line} cityName={str(p.city, "Paris")} issueLabel={p.issueLabel} sheetTitle={p.sheetTitle ?? "Choose a city"} moreTitle={p.moreTitle ?? ""} moreText={p.moreText ?? ""} suggestLabel={p.suggestLabel} cover={str(p.cover)} coverVideo={str(p.coverVideo)} wash={typeof p.wash === "number" ? p.wash : 55} textAt={str(p.textAt, "top")} coverHeight={typeof p.coverHeight === "number" ? p.coverHeight : 360} />,
  () => ({ wordTop: "Elkdonis", wordBottom: "Experiences", city: "Paris", issueLabel: "" })
);

/* ---- m-search-row: a search pill and a filter button, both go to Tours. No data. ---- */
const searchProps = [{ name: "placeholder", kind: "string", label: "Placeholder", default: "Search walks, ateliers, museums", inlineEditable: true }] as const;
export const mSearchRow = defineBlock(
  {
    id: "m-search-row", category: "content", label: "Phone search row", description: "A search pill that opens the Tours page.",
    memberSafe: true, styling: "tokens", props: searchProps,
    parts: { root: { label: "Search row", sel: "> .blk-msr-wrap" }, placeholder: { label: "Placeholder", sel: ".blk-msr-text", prop: "placeholder" } },
  },
  ({ placeholder }: PropsOf<typeof searchProps>) => (
    <div className="blk blk-msr-wrap">
      <Link href="/tours" className="blk-msr">
        <span className="blk-mtl-glass" />
        <span className="blk-msr-text">{placeholder}</span>
      </Link>
      <Link href="/tours" className="blk-msr-filter" aria-label="Filter tours">
        <span />
        <span />
        <span />
      </Link>
    </div>
  ),
  () => ({ placeholder: "Search walks, ateliers, museums" })
);

/* ---- m-featured-tour: EMPTY: hides itself (no published tour, nothing to feature). ---- */
const featProps = [
  { name: "sectionLabel", kind: "string", label: "Section label", default: "Featured Tour", inlineEditable: true },
  { name: "tourSlug", kind: "string", label: "Tour (its address name)", description: "Empty: the next departing tour, else the first published one.", default: "" },
] as const;
export type MFeaturedProps = PropsOf<typeof featProps> & { featured?: MobileFeatured | null };
export const mFeaturedTour = defineBlock(
  {
    id: "m-featured-tour", category: "content", label: "Phone featured tour", description: "One tour as a large arch card. Hides itself with no published tours.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: featProps,
    parts: {
      root: { label: "Featured tour", sel: "> .blk-mft-root" },
      section: { label: "Section label", sel: ".blk-mft-section", prop: "sectionLabel" },
      card: { label: "Card", sel: ".blk-mft" },
      title: { label: "Tour title", sel: ".blk-mft-title" },
    },
  },
  ({ sectionLabel, featured }: MFeaturedProps) =>
    featured ? (
      <div className="blk-mft-root">
        <SectionHeader label={typeof sectionLabel === "string" ? sectionLabel : ""} />
        <TourQuickLink slug={featured.slug} title={featured.title} className="blk-mft m-cusp">
          {featured.img || !featured.filmPoster ? (
            <ArchFrame w={338} h={250} bottom={16} src={featured.img} frame={featured.imgFrame}>
              {/* No cover photo: the tour's 3D route plays in the arch (developer, 2026-11-17). */}
              {!featured.img && featured.map ? <FeaturedRouteMap map={featured.map} title={featured.title} /> : null}
              {featured.placesLabel && <span className="blk-mft-badge">{featured.placesLabel}</span>}
            </ArchFrame>
          ) : (
            // No cover picture: the film's poster whole in a 16:9 frame (the Google credit sits in its edges), never cropped to the arch.
            <span className="blk-mft-whole">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={featured.filmPoster} alt="" loading="lazy" />
              {featured.placesLabel && <span className="blk-mft-badge">{featured.placesLabel}</span>}
            </span>
          )}
          <span className="blk-mft-foot">
            <span className="blk-mft-text">
              <span className="m-kicker blk-mft-meta">{[featured.typeLabel, featured.duration].filter(Boolean).join(" · ")}</span>
              <span className="blk-mft-title">{featured.title}</span>
              <span className="blk-mft-by">{[featured.guide && `with ${featured.guide}`, featured.nextLabel].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="blk-mft-go">→</span>
          </span>
        </TourQuickLink>
      </div>
    ) : null,
  () => ({ sectionLabel: "Featured Tour", featured: { slug: "sample", title: "A walk through the old quarter", typeLabel: "Walking tour", duration: "2 h 30", guide: "Dana", nextLabel: "Next · Sat 21 Nov, 10:00", placesLabel: "4 places left", img: null } })
);
// The section label is not a data word, but a part on the header would need markup SectionHeader does not give; the
// label stays editable through the field panel.

/* ---- m-places-shelf: EMPTY: hides itself when no guide has starred a place (favourites need a migration). ---- */
const shelfProps = [
  { name: "sectionLabel", kind: "string", label: "Section label", default: "Favourite places", inlineEditable: true },
  { name: "moreLabel", kind: "string", label: "'All' link label", default: "All ›", inlineEditable: true },
  { name: "seeAllLabel", kind: "string", label: "Last card label", default: "See all", inlineEditable: true },
  { name: "from", kind: "select", label: "Which places", description: "Starred by guides is how the shelf has always worked.", default: "stars", options: [{ value: "stars", label: "Places a guide has starred" }, { value: "chosen", label: "Places I choose below" }] },
  {
    name: "picks", kind: "rows", label: "Places I choose", addLabel: "Add a place", summary: ["place"],
    description: "Used when 'Which places' is 'Places I choose'. Add, remove and reorder here. Only references are stored: no picture is copied or moved.",
    fields: [
      { name: "place", kind: "string", label: "Place", binds: "place", default: "" },
      { name: "cover", kind: "string", label: "Cover picture", description: "One of that place's own pictures. Empty: the place's own cover.", binds: "place-photo", default: "" },
    ],
  },
] as const;
export type MShelfProps = PropsOf<typeof shelfProps> & { places?: MobilePlace[] | null; placesCount?: number | null };
export const mPlacesShelf = defineBlock(
  {
    id: "m-places-shelf", category: "content", label: "Phone places shelf", description: "A sideways shelf of favourite places. Hides itself until a guide has starred some.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: shelfProps,
    reads: [{ from: "site", what: "org" }, { from: "record", via: "picks", kinds: ["place"] }],
    parts: {
      root: { label: "Places shelf", sel: "> .blk-mps" },
      all: { label: "'All' link", sel: ".blk-mps-more", prop: "moreLabel" },
      card: { label: "Place card", sel: ".blk-mps-card" },
      seeAll: { label: "Last card", sel: ".blk-mps-all", prop: "seeAllLabel" },
    },
  },
  ({ sectionLabel, moreLabel, seeAllLabel, places, placesCount }: MShelfProps) =>
    places && places.length > 0 ? (
      <section className="blk blk-mps">
        <SectionHeader label={typeof sectionLabel === "string" ? sectionLabel : ""} more={{ label: typeof moreLabel === "string" ? moreLabel : "All ›", href: "/places" }} />
        <PlacesShelfView
          places={places}
          seeAll={
            <Link href="/places" className="blk-mps-all">
              <span>{seeAllLabel}{placesCount ? ` ${placesCount}` : ""}</span>
            </Link>
          }
        />
      </section>
    ) : null,
  () => ({ sectionLabel: "Favourite places", moreLabel: "All ›", seeAllLabel: "See all", placesCount: 75, places: [{ id: "p1", slug: "sample", name: "A gallery", kind: "Gallery", area: "Le Marais", img: null }] })
);

/* ---- m-experiences-panel: EMPTY: hides itself with no public experiences. ---- */
const expProps = [
  { name: "label", kind: "string", label: "Label", default: "Experiences coming", inlineEditable: true },
  { name: "heading", kind: "string", label: "Heading", default: "Something strange on the way", inlineEditable: true },
  { name: "line", kind: "text", label: "Line", default: "Local artists and residents waiting at a stop, or open to you by request.", inlineEditable: true },
  { name: "mode", kind: "select", label: "Mode", description: "List is how the panel has always looked.", default: "list", options: [{ value: "list", label: "List: a picture and a few words each" }, { value: "feature", label: "Feature: the first one large, the rest as a list" }, { value: "description", label: "Description: each with its short description" }] },
  { name: "which", kind: "select", label: "Which experiences", default: "next", options: [{ value: "next", label: "The next public ones" }, { value: "chosen", label: "Experiences I choose below" }] },
  { name: "count", kind: "number", label: "How many", default: 3, min: 1, max: 12, step: 1 },
  {
    name: "picks", kind: "rows", label: "Experiences I choose", addLabel: "Add an experience", summary: ["experience"],
    description: "Used when 'Which experiences' is 'Experiences I choose'. Shown in this order.",
    fields: [{ name: "experience", kind: "string", label: "Experience", binds: "experience", default: "" }],
  },
] as const;
export type MExpProps = PropsOf<typeof expProps> & { experiences?: MobileExperience[] | null };
export const mExperiencesPanel = defineBlock(
  {
    id: "m-experiences-panel", category: "content", label: "Phone experiences panel", description: "A verdigris panel listing the next public experiences. Hides itself with none.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: expProps,
    reads: [{ from: "site", what: "org" }, { from: "record", via: "picks", kinds: ["experience"] }],
    parts: {
      root: { label: "Experiences panel", sel: "> .blk-mxp" },
      label: { label: "Label", sel: ".blk-mxp-label", prop: "label" },
      heading: { label: "Heading", sel: ".blk-mxp-heading", prop: "heading" },
      line: { label: "Line", sel: ".blk-mxp-line", prop: "line" },
    },
  },
  ({ label, heading, line, experiences, mode }: MExpProps) =>
    experiences && experiences.length > 0 ? (
      <section className="blk blk-mxp">
        <span className="m-kicker blk-mxp-label">{label}</span>
        <h2 className="blk-mxp-heading">{heading}</h2>
        <p className="blk-mxp-line">{line}</p>
        <div className="blk-mxp-rows">
          {experiences.map((e, i) =>
            mode === "feature" && i === 0 ? (
              <Link key={e.id} href={`/experiences/${e.slug}`} className="blk-mxp-feature">
                {e.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.img} alt="" loading="lazy" className="blk-mxp-fimg" />
                ) : (
                  <span className="blk-mxp-fimg blk-mxp-fimg--none" aria-hidden="true">{e.title.slice(0, 1)}</span>
                )}
                <span className="blk-mxp-title">{e.title}</span>
                <span className="blk-mxp-by">{[e.artist, e.craft].filter(Boolean).join(" · ")}</span>
                <span className="blk-mxp-where">{e.where}</span>
              </Link>
            ) : (
              <Link key={e.id} href={`/experiences/${e.slug}`} className="blk-mxp-row">
                <Porthole size={72} verdigris src={e.img} initial={e.title.slice(0, 1)} />
                <span className="blk-mxp-text">
                  <span className="blk-mxp-title">{e.title}</span>
                  <span className="blk-mxp-by">{[e.artist, e.craft].filter(Boolean).join(" · ")}</span>
                  <span className="blk-mxp-where">{e.where}</span>
                  {mode === "description" && e.pitch ? <span className="blk-mxp-pitch">{e.pitch}</span> : null}
                </span>
              </Link>
            )
          )}
        </div>
      </section>
    ) : null,
  () => ({ label: "Experiences coming", heading: "Something strange on the way", line: "Local artists and residents waiting at a stop, or open to you by request.", experiences: [{ id: "e1", slug: "sample", title: "A private studio visit", artist: "An artist", craft: null, where: "By request", img: null }] })
);

/* ---- m-guides: EMPTY: hides itself with no guides. Cards expand in place. ---- */
const guidesProps = [
  { name: "sectionLabel", kind: "string", label: "Section label", default: "Your guides", inlineEditable: true },
  { name: "moreLabel", kind: "string", label: "Link label", default: "Local Artists ›", inlineEditable: true },
  { name: "nowLabel", kind: "string", label: "Open card: tours heading", default: "Leading now", inlineEditable: true },
  { name: "profileLabel", kind: "string", label: "Open card: profile button", default: "Full profile →", inlineEditable: true },
  { name: "who", kind: "select", label: "Who is shown", default: "all", options: [{ value: "all", label: "Every guide on the site" }, { value: "chosen", label: "Only the guides I list below" }] },
  { name: "order", kind: "select", label: "Order", default: "site", options: [{ value: "site", label: "As the site lists them" }, { value: "name", label: "By name" }, { value: "listed", label: "As I list them below, then the others" }] },
  { name: "limit", kind: "number", label: "Most guides shown", default: 6, min: 1, max: 24, step: 1 },
  { name: "bioLines", kind: "select", label: "Description length", description: "Three lines is how the cards have always looked.", default: "three", options: [{ value: "two", label: "Compact: two lines" }, { value: "three", label: "Three lines" }, { value: "full", label: "Full description" }] },
  { name: "showTours", kind: "boolean", label: "List the tours each guide leads", default: true },
  { name: "onTap", kind: "select", label: "When a card is tapped", default: "expand", options: [{ value: "expand", label: "It opens in place" }, { value: "profile", label: "It goes to the profile page" }] },
  {
    name: "people", kind: "rows", label: "Guides I list", addLabel: "Add a guide", summary: ["person", "blurb"],
    description: "Pick who is shown (when 'Who is shown' is 'Only the guides I list') and, for each, a short description for this site. The description is kept here in the block, not on the person.",
    fields: [
      { name: "person", kind: "string", label: "Guide", binds: "guide", default: "" },
      { name: "blurb", kind: "text", label: "Short description here", description: "Empty: the guide's own bio.", default: "" },
    ],
  },
] as const;
export type MGuidesProps = PropsOf<typeof guidesProps> & { guides?: MobileGuide[] | null };
export const mGuides = defineBlock(
  {
    id: "m-guides", category: "content", label: "Phone guides", description: "One card per guide; tap to see the tours they lead. Hides itself with no guides.",
    memberSafe: true, dataDriven: true, interactive: true, styling: "tokens", props: guidesProps,
    reads: [{ from: "site", what: "org" }, { from: "record", via: "people", kinds: ["guide"] }],
    parts: {
      root: { label: "Guides", sel: "> .blk-mg" },
      card: { label: "Guide card", sel: ".blk-mg-card" },
      now: { label: "Tours heading", sel: ".blk-mg-now", prop: "nowLabel" },
      profile: { label: "Profile button", sel: ".blk-mg-profile", prop: "profileLabel" },
    },
  },
  ({ sectionLabel, moreLabel, nowLabel, profileLabel, guides, bioLines, onTap }: MGuidesProps) =>
    guides && guides.length > 0 ? (
      <section className="blk blk-mg" data-bio={bioLines === "two" || bioLines === "full" ? bioLines : undefined}>
        <SectionHeader label={typeof sectionLabel === "string" ? sectionLabel : ""} more={{ label: typeof moreLabel === "string" ? moreLabel : "Local Artists ›", href: "/people" }} />
        <GuidesView guides={guides} nowLabel={nowLabel} profileLabel={profileLabel} toProfile={onTap === "profile"} />
      </section>
    ) : null,
  () => ({ sectionLabel: "Your guides", moreLabel: "Local Artists ›", nowLabel: "Leading now", profileLabel: "Full profile →", guides: [{ id: "g1", slug: "sample", name: "Dana", craft: "Painter", bio: "Walks the quarter daily.", initial: "D", photo: null, tours: [] }] })
);

/* ---- m-link-rows: Feed / Places catalogue / Forum. EMPTY: no Feed row without posts; the Forum "N new" badge is
   not shown (the unread count is not read here). The Places row always shows (75 public places). ---- */
const rowProps = [
  { name: "feedKicker", kind: "string", label: "Feed: kicker", default: "From the guides · Feed", inlineEditable: true },
  { name: "placesKicker", kind: "string", label: "Places: kicker", default: "The places catalogue", inlineEditable: true },
  { name: "placesTitle", kind: "string", label: "Places: title", default: "Every stop, gallery and table", inlineEditable: true },
  { name: "placesLine", kind: "string", label: "Places: line after the number", default: "places the guides know well", inlineEditable: true },
  { name: "forumTitle", kind: "string", label: "Forum: title", default: "Elkdonis Forum", inlineEditable: true },
  { name: "loginLabel", kind: "string", label: "Log in: label (signed out)", default: "Log in", inlineEditable: true },
  { name: "accountLabel", kind: "string", label: "Account: label when signed in without a name", default: "Account", inlineEditable: true },
  { name: "showButtons", kind: "boolean", label: "Show the buttons (places catalogue, forum, log in)", description: "Off: only the newest Feed post. The buttons are then a separate block, Phone page buttons, where each has its own audience.", default: true },
] as const;
export type MLinkRowsProps = PropsOf<typeof rowProps> & { feed?: MobileFeedLead | null; placesCount?: number | null; viewer?: { name: string | null; office?: boolean } | null };
export const mLinkRows = defineBlock(
  {
    id: "m-link-rows", category: "content", label: "Phone link rows", description: "Three rows: the newest Feed post, the Places catalogue and the Forum.",
    memberSafe: true, dataDriven: true, styling: "tokens", props: rowProps,
    reads: [{ from: "viewer", what: "signed-in" }, { from: "viewer", what: "role" }, { from: "site", what: "org" }],
    parts: {
      root: { label: "Link rows", sel: "> .blk-mlr" },
      feedKicker: { label: "Feed kicker", sel: ".blk-mlr-feed-kicker", prop: "feedKicker" },
      placesKicker: { label: "Places kicker", sel: ".blk-mlr-places .m-row-kicker", prop: "placesKicker" },
      placesTitle: { label: "Places title", sel: ".blk-mlr-places .m-row-title", prop: "placesTitle" },
      forumTitle: { label: "Forum title", sel: ".blk-mlr-forum-title", prop: "forumTitle" },
      loginLabel: { label: "Log in pill", sel: ".blk-mlr-login-text", prop: "loginLabel" },
    },
  },
  (p: MLinkRowsProps) => p.showButtons === false && !p.feed ? null : (
    <div className="blk blk-mlr">
      {p.feed && (
        <Link href={p.feed.href} className="m-row blk-mlr-feed">
          <span className="blk-mlr-feed-top">
            <span className="m-kicker blk-mlr-feed-kicker">{p.feedKicker}</span>
            <span className="blk-mlr-feed-count">{p.feed.count}</span>
            <span className="m-row-chev">›</span>
          </span>
          <span className="blk-mlr-feed-body">
            <ArchFrame w={52} h={60} bottom={8}>
              <span className="m-porthole-initial blk-mlr-initial">{p.feed.initial}</span>
            </ArchFrame>
            <span className="blk-mlr-feed-text">
              <span className="blk-mlr-feed-title">{p.feed.title}</span>
              {p.feed.excerpt && <span className="blk-mlr-feed-excerpt">{p.feed.excerpt}</span>}
              <span className="blk-mlr-feed-by">{p.feed.by}</span>
            </span>
          </span>
        </Link>
      )}
      {p.showButtons === false ? null : <div className="blk-mlr-places">
        <CatalogueRow
          href="/places"
          thumb={<ArchFrame w={44} h={52} bottom={7} brass />}
          kicker={typeof p.placesKicker === "string" ? p.placesKicker : ""}
          title={typeof p.placesTitle === "string" ? p.placesTitle : ""}
          meta={`${p.placesCount ?? ""} ${typeof p.placesLine === "string" ? p.placesLine : ""}`.trim()}
        />
      </div>}
      {p.showButtons === false ? null : <div className="blk-mlr-pair">
        <Link href="/forum" className="m-row blk-mlr-forum">
          <span className="blk-mmast-dot blk-mlr-forum-dot" />
          <span className="m-row-text blk-mlr-forum-title">{p.forumTitle}</span>
          <span className="m-row-chev">›</span>
        </Link>
        <Link href={p.viewer?.office ? "/manage" : p.viewer ? "/account" : "/login"} className="m-row blk-mlr-login">
          <span className="blk-mlr-login-text">{p.viewer?.office ? "The Office" : p.viewer ? (p.viewer.name || p.accountLabel) : p.loginLabel}</span>
        </Link>
      </div>}
    </div>
  ),
  () => ({ feedKicker: "From the guides · Feed", placesKicker: "The places catalogue", placesTitle: "Every stop, gallery and table", placesLine: "places the guides know well", forumTitle: "Elkdonis Forum", loginLabel: "Log in", accountLabel: "Account", placesCount: 75, feed: { count: 3, title: "A post", excerpt: "A line.", by: "Dana", initial: "D", href: "/feed" } })
);
