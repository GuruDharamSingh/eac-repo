import "@elkdonis/cms-ui/hubsite.css";
import "@/app/hub/hub-cards.css";
import {
  HubCardGrid,
  HubLinkCard,
  HubViewToggle,
  MeetingBanner,
  type MeetingBannerData,
} from "@elkdonis/cms-ui/hubsite";
import { HubDrawer } from "@/components/hub/HubDrawer";
import { HUB_VIEWS } from "@/app/hub/views";

/**
 * The markup of the "Cards 2" hub (app/hub/cards-view.tsx loads the data).
 * Plain props and no reads, so it can also be rendered with stub data.
 *
 *   three across Publish · My profile · the series
 *   four across  Calendar · Manage the site · Whiteboard · General chat
 *   two across   Files · Forum
 *   then         Working together: Collaborative document, Pipeline, Group
 *                research (Suggested ideas left out, 2026-10-18)
 *   Rows step down to 2 columns below 1040px and one below 600px (hub-cards.css).
 */
export interface HubCardsBodyProps {
  shortName: string;
  firstName: string;
  displayName: string;
  meeting: MeetingBannerData | null;
  timeZone: string;
  canEdit: boolean;
  /** "Next: … · Tue, Oct 14, 7:00 p.m." */
  calendarLine: string | null;
  /** `plannerHref` is where the card goes: the series planner. */
  series: { plannerHref: string } | null;
  documentsLine: string | null;
  boardLine: string | null;
}

export function HubCardsBody({
  shortName,
  firstName,
  displayName,
  meeting,
  timeZone,
  canEdit,
  calendarLine,
  series,
  documentsLine,
  boardLine,
}: HubCardsBodyProps) {
  return (
    <main className="hub">
      {/* The classic hub's welcome row, so switching layouts keeps the
          greeting and the toggle where they were. */}
      <div className="hub-welcome">
        <div>
          <p className="kicker">{shortName}</p>
          <h1>Welcome back, {firstName}.</h1>
        </div>
        <div className="hub-welcome-tools">
          <HubViewToggle current="cards2" views={HUB_VIEWS} />
          <HubDrawer displayName={displayName} profileHref="/center" />
        </div>
      </div>

      <div className="eac-hs ifac-c2">
        <MeetingBanner meeting={meeting} timeZone={timeZone} />

        {/* The order (developer, 2026-10-18): three across, then four, then two. */}
        <HubCardGrid label="Hub" className="ifac-row-3">
          <HubLinkCard href="/hub/compose" glyph="✚" title="Publish" blurb="Writing, gatherings, work for sale — everything the group puts out." />
          <HubLinkCard href="/center" title="Profile / Center" blurb="Organize your personal efforts." />
          {/* The series card opens the planner (the weeks, who hosts), not the public page. */}
          {series ? <HubLinkCard href={series.plannerHref} title="Series" blurb="Recurring themed meetings" /> : null}
        </HubCardGrid>

        <HubCardGrid label="Calendar and tools" className="ifac-row-4">
          <HubLinkCard
            href="/hub/calendar"
            glyph="▦"
            title="Calendar"
            blurb="Every gathering, month by month."
            meta={calendarLine ?? undefined}
          />
          {canEdit ? (
            <HubLinkCard href="/manage" glyph="◈" title="Manage the site" blurb="Artists & dealers, people & access, site copy." />
          ) : null}
          <HubLinkCard href="/hub/whiteboard" glyph="✎" title="Whiteboard" blurb="A shared canvas. Sketch a hang, a floor plan, an idea." />
          <HubLinkCard
            href="/hub/chat"
            glyph="☏"
            title="General chat"
            blurb={`Everyone in ${shortName}. Say hello, ask the room, share what you found.`}
          />
        </HubCardGrid>

        <HubCardGrid label="Files and forum" className="ifac-row-2">
          <HubLinkCard href="/hub/files" glyph="▤" title="Files" blurb="The group's folder and your own." />
          <HubLinkCard href="/forum" glyph="☰" title="Forum" blurb="What is being discussed, every board in full." />
        </HubCardGrid>

        {/* Under them: working together. Suggested ideas is left out for now
            (developer, 2026-10-18). */}
        <section className="eac-hp-section ifac-three" aria-labelledby="c2-together">
          <h2 id="c2-together" className="eac-hp-section-title">
            Working together
          </h2>
          <HubCardGrid label="Working together">
            <HubLinkCard
              href="/hub/documents"
              glyph="▭"
              title="Collaborative document"
              blurb="Write together. Every member can edit."
              meta={documentsLine ?? undefined}
            />
            <HubLinkCard
              href="/hub/pipeline"
              glyph="▥"
              title="Pipeline"
              blurb="What the group is working on, on its Deck board."
              meta={boardLine ?? undefined}
            />
            <HubLinkCard
              href="/hub/research"
              glyph="?"
              title="Group research"
              blurb="Put something to the membership, and read what comes back."
            />
          </HubCardGrid>
        </section>
      </div>
    </main>
  );
}
