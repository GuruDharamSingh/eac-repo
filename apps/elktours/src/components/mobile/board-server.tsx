import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile } from "@elkdonis/services";
import { requireOrgEditor } from "@/lib/auth";
import { getSlot } from "@/lib/slot-actions";
import { addDays, formatWeekLabel, mondayOf, parisDayOf, parisInstant, parisToday, resolveWeek } from "@/lib/schedule-plan";
import { boardCounts, getBookingRule, listBoardSlots, listDecisions, loadTours } from "@/lib/tour-slots";
import { listGuides } from "@/lib/tours";
import { getOfficeSummary } from "@/lib/office";
import { countOverlaps, overlapsOfSlot } from "@/lib/slot-overlaps";
import { listFeedPosts, type FeedPost } from "@/lib/feed";
import { listExperiencesToReview } from "@/lib/artist-wizard";
import { SectionHeader } from "@/components/mobile";
import { BoardTabBar } from "./board-nav";
import { tourEditorHref } from "@/lib/office-links";
import { BoardWho, SlotCard, clock, dayLong, dayShort } from "./board-ui";
import { OfficeReviewCards, type ReviewCard } from "./office-review-cards";
import { DecisionsView } from "./decisions-view";
import { NewSlotsView } from "./new-slots-view";
import { ScheduleView } from "./schedule-view";
import { SlotView } from "./slot-view";
import "./board.css";

// Server loaders for the phone tree of the board routes (G7a). Each returns the phone screen for one /manage route
// and is drawn inside <Split> by the page, beside the untouched desktop page. The page has already gated the role;
// these ask again (cheap) so they are safe on their own. Guides see their own slots, owners see everyone's.

async function who() {
  const viewer = await requireOrgEditor();
  const profile = await getProfile(viewer.userId).catch(() => null);
  const name = profile?.displayName?.trim() || viewer.email.split("@")[0] || "You";
  const isOwner = viewer.role === "owner";
  return { viewer, name, sub: isOwner ? "Owner · the office" : "Guide", isOwner, guideUserId: isOwner ? undefined : viewer.userId };
}

async function guideChips(): Promise<Array<{ id: string; name: string; short: string }>> {
  const guides = await listGuides().catch(() => []);
  return guides.map((g) => ({ id: g.id, name: g.name, short: g.name.split(/\s+/)[0] ?? g.name }));
}

// "More" on the Office home: the full manage pages, folded. The queues (reviews, posts, suggestions, invitations,
// decisions) are reached from the "Needs you" tiles instead.
const MORE: Array<{ href: string; title: string; line: string }> = [
  { href: "/manage/bookings", title: "Bookings", line: "Every booking, by date" },
  { href: "/manage/tours", title: "Tours", line: "Routes, stops, rules and pictures" },
  { href: "/manage/places", title: "Places", line: "The catalogue guests browse" },
  { href: "/manage/experiences", title: "Experiences", line: "Review, publish and edit" },
  { href: "/manage/flyovers", title: "Fly-overs", line: "Films waiting or delivered" },
  { href: "/manage?journal=1", title: "Journal and posts", line: "What has been posted on the site" },
  { href: "/manage/settings", title: "Settings", line: "The below-minimum rule and guides' posts" },
];

const POST_STATUS: Record<FeedPost["status"], string> = { published: "On Discover", pending: "With the office", archived: "Declined" };

function offerLine(offer: { onTour?: { fee?: number; unit?: string } | null; standalone?: { pricePerGuest?: number } | null } | null, format: string, minutes: number | null): string {
  const bits: string[] = [format === "online" ? "Online" : format === "hybrid" ? "Hybrid" : "In person"];
  if (minutes) bits.push(`${minutes} min`);
  if (offer?.onTour?.fee != null) bits.push(`EUR ${offer.onTour.fee} ${offer.onTour.unit === "per_guest" ? "per guest" : "per run"} on a tour`);
  if (offer?.standalone?.pricePerGuest != null) bits.push(`EUR ${offer.standalone.pricePerGuest} per guest on request`);
  return bits.join(" · ");
}

/**
 * /manage on a phone since 2026-11-19: the office moved to the hub (developer's decision: /hub is the office on
 * phone and desktop), so this page is the way into it plus the full manage pages. Replaces BoardHomeMobile below.
 */
export async function ManageIndexMobile() {
  const me = await who();
  const { calls } = await boardCounts({ guideUserId: me.guideUserId })
    .then((c) => ({ calls: c.belowMinimum }))
    .catch(() => ({ calls: 0 }));
  const overlaps = await countOverlaps({ guideUserId: me.guideUserId });
  const rows = [
    { href: "/manage/schedule", title: "Schedule", line: "Every run, by week; open one for its guests" },
    ...(overlaps > 0 ? [{ href: "/manage/overlaps", title: `Overlapping runs (${overlaps})`, line: "Runs of one guide that overlap" }] : []),
    ...(calls > 0 ? [{ href: "/manage/decisions", title: `Calls to make (${calls})`, line: "Runs below their minimum" }] : []),
    { href: "/manage/suggestions", title: "Suggestions", line: "Spots and walks visitors suggested" },
    { href: "/manage/share", title: "Share a post", line: "A post or a link for Discover" },
    ...MORE,
  ];
  return (
    <>
      <div className="b-page">
        <BoardWho name={me.name} sub={me.sub} />
        <div className="b-head">
          <h1 className="b-title">Manage</h1>
        </div>
        <Link href="/hub" className="m-row" style={{ margin: "12px 20px 0", border: "1px solid hsl(var(--primary))" }}>
          <span className="m-row-text">
            <span className="m-row-title">Open the Hub</span>
            <span className="m-row-meta">The office: availability, offer a tour, create a tour, add a place, your takes</span>
          </span>
          <span className="m-row-chev" aria-hidden="true">›</span>
        </Link>
        <p className="b-queue-note">The full manage pages:</p>
        <div className="b-queue">
          {rows.map((q) => (
            <Link key={q.href} href={q.href} className="m-row">
              <span className="m-row-text">
                <span className="m-row-title">{q.title}</span>
                <span className="m-row-meta">{q.line}</span>
              </span>
              <span className="m-row-chev" aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      </div>
      <BoardTabBar count={calls} />
    </>
  );
}

/**
 * Retired 2026-11-19 (the office moved to /hub; /manage on a phone draws ManageIndexMobile). Kept until the hub
 * has been used on a phone for a while.
 * Screen 30, the Office (/manage on a phone; "Board" renamed 2026-11-15, OFFICE_SPEC.md). Top to bottom: who and
 * the date, "Needs you" count tiles, (owners) To review, Today, This week, Tours, Experiences on tours, On Discover,
 * New from artists, and More (folded).
 */
export async function BoardHomeMobile() {
  const me = await who();
  const today = parisToday();
  const [summary, slots, tours, myPosts, toReview] = await Promise.all([
    getOfficeSummary({ guideUserId: me.guideUserId, isOwner: me.isOwner }),
    listBoardSlots({ from: new Date(Date.now() - 7 * 86400000), to: parisInstant(addDays(today, 60))!, includeCancelled: false, guideUserId: me.guideUserId }),
    loadTours(),
    listFeedPosts({ authorUserId: me.viewer.userId, includePending: true, limit: 5 }),
    me.isOwner ? listExperiencesToReview() : Promise.resolve([]),
  ]);
  const scheduled = slots.filter((s) => s.status === "scheduled");
  const weekEnd = parisInstant(addDays(today, 7))!.getTime();
  const week = scheduled.filter((s) => new Date(s.startsAt).getTime() >= parisInstant(today)!.getTime() && new Date(s.startsAt).getTime() < weekEnd);
  const todays = week.filter((s) => parisDayOf(s.startsAt) === today);
  const later = week.filter((s) => parisDayOf(s.startsAt) !== today);
  const calls = summary.needs.find((x) => x.key === "calls")?.count ?? 0;
  const allClear = summary.needs.every((x) => x.count === 0);

  // Next run of each tour, with places booked (the Tours band).
  const nowMs = Date.now();
  const nextByTour = new Map<string, (typeof scheduled)[number]>();
  for (const s of scheduled) if (new Date(s.startsAt).getTime() > nowMs && !nextByTour.has(s.tourId)) nextByTour.set(s.tourId, s);
  const myTours = [...tours.values()]
    .filter((t) => me.isOwner || t.authorId === me.viewer.userId)
    .sort((a, b) => a.title.localeCompare(b.title));
  const reviewCards: ReviewCard[] = toReview.map((c) => ({
    id: c.id,
    title: c.title,
    pitch: c.pitch,
    artistName: c.artistName,
    details: offerLine(c.offer, c.format, c.durationMinutes),
  }));
  const firstTour = myTours[0];

  return (
    <>
      <div className="b-page">
        <BoardWho name={me.name} sub={me.sub} />
        <div className="b-head">
          <span className="m-kicker">{dayLong(today)}</span>
          <h1 className="b-title">The Office</h1>
        </div>

        <SectionHeader label="Needs you" />
        {allClear ? (
          <p className="b-allclear">All clear.</p>
        ) : null}
        <div className="b-needs" aria-label="Needs you">
          {summary.needs.map((x) => (
            <Link key={x.key} href={x.href} className={`b-need${x.count === 0 ? " is-zero" : ""}${x.key === "calls" && x.count > 0 ? " is-urgent" : ""}`}>
              <span className="b-need-n">{x.count}</span>
              <span className="b-need-label">{x.label}</span>
            </Link>
          ))}
        </div>

        {reviewCards.length > 0 ? (
          <>
            <SectionHeader label="To review" />
            <OfficeReviewCards cards={reviewCards} />
          </>
        ) : null}

        <SectionHeader label="Today" more={{ label: "Schedule", href: "/manage/schedule" }} />
        <div className="b-list" style={{ paddingTop: 0 }}>
          <div className="b-cards">
            {todays.map((s) => (
              <SlotCard key={s.slotId} slot={s} showGuide={me.isOwner} />
            ))}
          </div>
          {todays.length === 0 ? <p className="b-empty" style={{ margin: "4px 4px 0" }}>Nothing runs today.</p> : null}
        </div>

        <SectionHeader label="This week" />
        <div className="b-list" style={{ paddingTop: 0 }}>
          <div className="b-cards">
            {later.map((s) => (
              <SlotCard key={s.slotId} slot={s} showGuide={me.isOwner} showDay />
            ))}
          </div>
          {later.length === 0 ? (
            <p className="b-empty" style={{ margin: "4px 4px 0" }}>
              No slots in the coming days. Tap the brass + and choose <strong>New dates</strong>.
            </p>
          ) : null}
        </div>

        {myTours.length > 0 ? (
          <>
            <SectionHeader label="Tours" />
            <div className="b-queue">
              {myTours.map((t) => {
                const next = nextByTour.get(t.id);
                return (
                  <div key={t.id} className="m-row b-tourcard">
                    <span className="m-row-title">{t.title}</span>
                    <span className="m-row-meta">
                      {next ? `${dayShort(parisDayOf(next.startsAt))} · ${clock(next.startsAt)} · ${next.seatsTaken}/${next.capacity} booked` : "No dates ahead"}
                    </span>
                    <span className="b-tour-links">
                      <Link href="/manage/schedule/new" className="b-sr-link">Dates</Link>
                      <Link href={`/manage/tours/${t.id}/collaborate`} className="b-sr-link">Collaborate</Link>
                      <Link href={`/manage/tours/${t.id}/assets`} className="b-sr-link">Page media</Link>
                      <Link href={tourEditorHref(t.id)} className="b-sr-link">Edit</Link>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        <SectionHeader label="Experiences on tours" />
        <div className="b-queue">
          {summary.experiencesOnTours.map((x) => (
            <Link key={x.tourId} href={`/manage/tours/${x.tourId}/collaborate`} className="m-row">
              <span className="m-row-text">
                <span className="m-row-title">{x.tourTitle}</span>
                <span className="m-row-meta">{x.stops} {x.stops === 1 ? "stop" : "stops"} · {x.confirmed} confirmed · {x.asked} asked</span>
              </span>
              <span className="m-row-chev" aria-hidden="true">›</span>
            </Link>
          ))}
          <Link href={firstTour && myTours.length === 1 ? `/manage/tours/${firstTour.id}/collaborate` : "/manage/tours"} className="b-dashed b-dashed-link">
            + Add an experience to a tour stop
          </Link>
        </div>

        <SectionHeader label="On Discover" />
        <div className="b-queue">
          <Link href="/manage/places" className="m-row">
            <span className="m-row-text">
              <span className="m-row-title">Places &amp; favourites</span>
              <span className="m-row-meta">{summary.places.featured} featured · {summary.places.total} in the catalogue</span>
            </span>
            <span className="m-row-chev" aria-hidden="true">›</span>
          </Link>
          <Link href="/forum" className="m-row">
            <span className="m-row-text">
              <span className="m-row-title">Elkdonis Forum</span>
              <span className="m-row-meta">Topics, the Feed and the closed section</span>
            </span>
            <span className="m-row-chev" aria-hidden="true">›</span>
          </Link>
          {myPosts.map((p) => (
            <Link key={p.id} href={`/manage/feed-review`} className="m-row">
              <span className="m-row-text">
                <span className="m-row-title">{p.title}</span>
                <span className={`m-row-meta b-poststate is-${p.status}`}>{POST_STATUS[p.status]}</span>
              </span>
              <span className="m-row-chev" aria-hidden="true">›</span>
            </Link>
          ))}
          <Link href="/manage/share" className="b-dashed b-dashed-link">+ Share a post or a link</Link>
        </div>

        {summary.newFromArtists.length > 0 ? (
          <>
            <SectionHeader label="New from artists" />
            <div className="b-queue">
              {summary.newFromArtists.map((x) => (
                <Link key={x.id} href={`/experiences/${x.slug}`} className="m-row">
                  <span className="m-row-text">
                    <span className="m-row-title">{x.title}</span>
                    <span className="m-row-meta">{x.artistName ? `${x.artistName} · ` : ""}Not on a tour yet</span>
                  </span>
                  <span className="m-row-chev" aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        <details className="b-more">
          <summary className="b-more-summary"><span className="m-kicker">More</span><span className="m-rule" aria-hidden="true" /></summary>
          <p className="b-queue-note">These open the full manage pages.</p>
          <div className="b-queue">
            {MORE.map((q) => (
              <Link key={q.href} href={q.href} className="m-row">
                <span className="m-row-text">
                  <span className="m-row-title">{q.title}</span>
                  <span className="m-row-meta">{q.line}</span>
                </span>
                <span className="m-row-chev" aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </details>
      </div>
      <BoardTabBar count={calls} />
    </>
  );
}

/** Screen 31, Schedule (/manage/schedule on a phone). */
export async function ScheduleMobile({ week }: { week?: string }) {
  const me = await who();
  const monday = resolveWeek(week);
  const today = parisToday();
  const [slots, counts, guides] = await Promise.all([
    listBoardSlots({ from: parisInstant(monday)!, to: parisInstant(addDays(monday, 7))!, includeCancelled: true, guideUserId: me.guideUserId }),
    boardCounts({ guideUserId: me.guideUserId }),
    me.isOwner ? guideChips() : Promise.resolve(null),
  ]);
  return (
    <ScheduleView
      name={me.name}
      sub={me.sub}
      monday={monday}
      days={Array.from({ length: 7 }, (_, i) => addDays(monday, i))}
      today={today}
      weekLabel={mondayOf(today) === monday ? `This week · ${formatWeekLabel(monday)}` : formatWeekLabel(monday)}
      prevWeek={addDays(monday, -7)}
      nextWeek={addDays(monday, 7)}
      slots={slots}
      guides={guides}
      below={counts.belowMinimum}
    />
  );
}

/** Screen 32, New slots (/manage/schedule/new). */
export async function NewSlotsMobile() {
  const me = await who();
  const [tours, upcoming, rule, counts, guides] = await Promise.all([
    loadTours(),
    listBoardSlots({ from: new Date(), includeCancelled: false }),
    getBookingRule(),
    boardCounts({ guideUserId: me.guideUserId }),
    me.isOwner ? guideChips() : Promise.resolve(null),
  ]);
  return (
    <NewSlotsView
      tours={[...tours.values()]
        .sort((a, b) => Number(b.published) - Number(a.published) || a.title.localeCompare(b.title))
        .map((t) => ({
          id: t.id,
          title: t.title,
          authorId: t.authorId,
          published: t.published,
          durationMinutes: t.durationMinutes,
          minToRun: t.defaults.minToRun,
          closeBeforeMinutes: t.defaults.closeBeforeMinutes,
          priceMinor: t.priceMinor,
          currency: t.currency,
        }))}
      existing={upcoming.map((s) => ({ tourId: s.tourId, day: parisDayOf(s.startsAt) }))}
      guides={guides}
      selfGuideId={me.isOwner ? null : me.viewer.userId}
      today={parisToday()}
      rule={rule.kind}
      below={counts.belowMinimum}
      who={me.name}
    />
  );
}

/** Screen 33, Slot (/manage/schedule/[slotId]). */
export async function SlotMobile({ slotId }: { slotId: string }) {
  await requireOrgEditor();
  const r = await getSlot(slotId);
  if (!r.ok) notFound();
  const overlaps = await overlapsOfSlot(r.slot.slotId, { startsAt: r.slot.startsAt, endsAt: r.slot.endsAt }).catch(() => []);
  return <SlotView initialSlot={r.slot} initialManifest={r.manifest} overlaps={overlaps} />;
}

/** Screen 34, Decisions (/manage/decisions). */
export async function DecisionsMobile() {
  const me = await who();
  const d = await listDecisions({ guideUserId: me.guideUserId });
  return <DecisionsView name={me.name} below={d.below} rule={d.rule} />;
}
