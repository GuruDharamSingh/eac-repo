import {
  getAttendanceCount,
  getCurrentGroupThread,
  getMeetingRecordings,
  getReadingQuote,
  getShelfItems,
  getSiteSections,
  isGoing,
  readCurrentBook,
  readMeetingStructure,
  readSuggestedBooks,
} from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { Hero, type HeroImage } from "@/components/home/hero";
import {
  CurrentCircle,
  FeatureTiles,
  Invitation,
  MeetingStructureBand,
  SuggestedBooks,
  VerticalBanner,
} from "@/components/home/bands";
import { Theatre } from "@/components/home/theatre";
import { Shelf } from "@/components/home/shelf";
import { Closing } from "@/components/home/closing";

import { withBaseMaybe } from "@/lib/base-path";

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
/** A stored media path, ready for an `src`/`href`. */
const media = (v: unknown): string | null => withBaseMaybe(str(v));

/**
 * The front page, top to bottom:
 *
 *   hero carousel → current circle | invitation → the creed line →
 *   books ahead (3/4) | vertical banner (1/4) → nine tiles →
 *   recordings theatre → structure of a meeting →
 *   the shelf (full-bleed, over the curtains) → quote | attend card
 *
 * Every read is fail-soft and they run in parallel, so one dead dependency
 * (Nextcloud being the likely one) empties a band rather than the page.
 */
export default async function HomePage() {
  const [viewer, sections, thread, recordings, quote] = await Promise.all([
    getViewer().catch(() => null),
    getSiteSections(),
    getCurrentGroupThread(),
    getMeetingRecordings(),
    getReadingQuote(),
  ]);

  const siteBook = readCurrentBook(sections);
  // The bookmark belongs to the GROUP now: two groups can be at different
  // places in the same book. The front page follows the lead group when it is
  // reading the site's book, and keeps the site-wide page otherwise.
  const book =
    siteBook && thread?.currentPage != null && (!thread.bookTitle || thread.bookTitle === siteBook.title)
      ? { ...siteBook, currentPage: thread.currentPage }
      : siteBook;
  const suggested = readSuggestedBooks(sections);
  const structure = readMeetingStructure(sections);

  const [attending, going, shelf] = await Promise.all([
    thread ? getAttendanceCount(thread.id) : 0,
    thread ? isGoing(thread.id, viewer?.userId ?? null) : false,
    getShelfItems(suggested, book),
  ]);

  const heroUrl = media(sections.hero_image?.url);
  const heroImage: HeroImage | null = heroUrl
    ? { url: heroUrl, caption: str(sections.hero_image?.caption) }
    : null;

  const talkBaseUrl =
    process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? process.env.NEXTCLOUD_PUBLIC_URL ?? null;

  return (
    <>
      <div className="column">
        <Hero book={book} image={heroImage} initialPage={book?.currentPage ?? null} />

        <section className="band">
          <div className="split">
            <CurrentCircle thread={thread} attending={attending} />
            <Invitation />
          </div>
        </section>

        <p className="creed">{str(sections.mission?.line) ?? siteConfig.missionLine}</p>

        <section className="band">
          <div className="quarters">
            <SuggestedBooks books={suggested} />
            <VerticalBanner
              imageUrl={media(sections.side_banner?.url)}
              href={str(sections.side_banner?.href)}
              book={book}
            />
          </div>
        </section>

        <section className="band band--tight">
          <FeatureTiles />
        </section>

        <section className="band">
          <div className="band__head">
            <h2 className="band__title">Prior meetings</h2>
            <span className="eyebrow">from the circle&rsquo;s folder</span>
          </div>
          <Theatre recordings={recordings} />
        </section>

        <section className="band">
          <MeetingStructureBand structure={structure} canEdit={Boolean(viewer?.canEdit)} />
        </section>
      </div>

      {/* Outside the column on purpose: this band runs the width of the
          window and covers the curtains. */}
      <Shelf items={shelf} />

      <div className="column">
        <section className="band">
          <Closing
            quote={quote}
            thread={thread}
            attending={attending}
            signedIn={Boolean(viewer)}
            going={going}
            talkBaseUrl={talkBaseUrl}
          />
        </section>
      </div>
    </>
  );
}
