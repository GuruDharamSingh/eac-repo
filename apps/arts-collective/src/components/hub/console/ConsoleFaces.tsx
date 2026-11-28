"use client";

import { ComposeFace, CalendarFace, IdentitiesFace } from "@elkdonis/cms-ui/hub";
import { EmailFace, type EmailSuiteData } from "@elkdonis/cms-ui/email";
import * as React from "react";
import { SurfaceCard, useSurface, type SurfaceEvent, type SurfaceIdentity } from "@elkdonis/cms-ui/surface";
import type { CurrentWorkData } from "@/lib/offer-card-types";
import type { ConsoleState } from "@/lib/org-console";
import { CurrentWorkFace } from "./CurrentWorkFace";
import { PiecesFace } from "./PiecesFace";
import { RecentWorkFace, type RecentItem } from "./RecentWorkFace";
import { CONSOLE_SURFACES } from "./console-keys";

/**
 * The card grid of the Organization page. It is ALWAYS a card grid: which cards differ by
 * what the viewer may do, never whether there are cards.
 *
 * Editors (owner, guide) get the managing cards; a member or follower gets the reading
 * ones (recent work, the calendar, and the slots for the content library and the forum).
 * Nothing a member may not do is drawn: a tile that opens onto "you may not" is furniture.
 *
 * Order, plain: the Current Work Page, then Make something, then the content library and
 * the forum (slots, filled by their lanes' cards as they land), the calendar, email, your
 * pieces, the byline; then a short "More" row (settings, store, owner links). Word art, the
 * connected services and the files follow as blocks, placed by the page.
 */
export function ConsoleFaces({
  events,
  canEdit,
  owner = false,
  email,
  currentWork,
  state,
  recent = [],
  orgName,
  orgSlug,
  orgHomeUrl,
  contentSlot,
  forumSlot,
}: {
  events: SurfaceEvent[];
  canEdit: boolean;
  /** Owners only: the agreements and quotes links. */
  owner?: boolean;
  /** Omitted when this viewer may not see the org's mail. */
  email?: EmailSuiteData | null;
  /** The Current Work Page card (owners and guides). Omitted: no tile. */
  currentWork?: CurrentWorkData | null;
  /** The console state behind "Your pieces" (editors only). */
  state?: ConsoleState | null;
  /** What the org published lately, for the member's "Recent work" card. */
  recent?: RecentItem[];
  orgName: string;
  orgSlug: string;
  orgHomeUrl: string;
  /** The content library card (lane K), drawn after Make something. Omitted: no tile. */
  contentSlot?: React.ReactNode;
  /** The forum card (lane F), drawn after the content library. Omitted: no tile. */
  forumSlot?: React.ReactNode;
}) {
  const surfaces = useSurface();
  // Fetched on the client so the face can draw the real names rather than a
  // description of the feature; its failure costs the chips, not the tile.
  // Editors only: the byline belongs to the thing they are about to make.
  const [identities, setIdentities] = React.useState<SurfaceIdentity[] | null>(null);
  React.useEffect(() => {
    if (!canEdit) return;
    let live = true;
    void fetch("/api/hub/identities", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (live && data) setIdentities(data.identities ?? []);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [canEdit]);

  return (
    <>
      <section aria-label="Cards" className="orgp-grid">
        <div className="eac-face-grid grid gap-4 sm:grid-cols-2">
          {canEdit && currentWork && <CurrentWorkFace data={currentWork} />}
          {canEdit && <ComposeFace />}
          {!canEdit && <RecentWorkFace items={recent} orgName={orgName} homeUrl={orgHomeUrl} />}
          {contentSlot}
          {forumSlot}
          <CalendarFace initialEvents={events} canEdit={canEdit} />
          {canEdit && email && <EmailFace data={email} canEdit={canEdit} />}
          {canEdit && state && <PiecesFace state={state} />}
          {canEdit && <IdentitiesFace identities={identities} />}
        </div>
      </section>

      {canEdit && (
        <section aria-label="More" className="orgp-grid orgp-more">
          <p className="orgp-label">More</p>
          <div className="eac-face-grid grid gap-4 sm:grid-cols-2">
            <SurfaceCard
              kind="neutral"
              glyph="⚙"
              kicker="Name, people, look, address"
              layout="header"
              title="Settings"
              blurb={`Everything that sets up ${orgName}, changed now and then.`}
              ariaLabel="Open settings"
              className="orgp-plain"
              onClick={(origin) =>
                surfaces.open({ type: "custom", key: CONSOLE_SURFACES.settings, title: "Settings", size: "wide" }, origin)
              }
            />
            <SurfaceCard
              kind="product"
              glyph="◈"
              kicker="Marketplace"
              layout="header"
              title="Store team and beneficiaries"
              blurb={`Who may list and sell for ${orgName}, and where a listing's money may go.`}
              href={`/hub/store?org=${encodeURIComponent(orgSlug)}`}
              className="orgp-plain"
            />
            {owner && (
              <SurfaceCard
                kind="document"
                glyph="▦"
                kicker="Owner"
                layout="header"
                title="Agreements and revenue shares"
                blurb={`What ${orgName} may take from a member's sale, and who has agreed to it.`}
                href="/hub/agreements"
                className="orgp-plain"
              />
            )}
            {owner && (
              <SurfaceCard
                kind="idea"
                glyph="❝"
                kicker="Owner"
                layout="header"
                title="Quotes on the center"
                blurb={`The line that turns over on ${orgName}'s center, and what members have sent in.`}
                href="/hub/quotes"
                className="orgp-plain"
              />
            )}
          </div>
        </section>
      )}
    </>
  );
}
