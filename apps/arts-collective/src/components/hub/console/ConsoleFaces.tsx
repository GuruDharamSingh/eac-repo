"use client";

import { ComposeFace, CalendarFace, IdentitiesFace } from "@elkdonis/cms-ui/hub";
import { EmailFace, type EmailSuiteData } from "@elkdonis/cms-ui/email";
import * as React from "react";
import type { SurfaceEvent, SurfaceIdentity } from "@elkdonis/cms-ui/surface";

/**
 * The live faces the console makes room for.
 *
 * This replaced a ten-card "Make something" scroller in which three cards were
 * dimmed placeholders and the rest were one-line shortcuts into the same
 * compose sheet. A face is not a catalogue tile: the compose face draws the
 * kinds this org can actually make and opens the sheet on the one you pick,
 * and the calendar face draws the real month with the real events on it.
 * Between them they carry what nine of those cards were describing.
 *
 * The third face is the byline: which of your names the other two write under.
 * It sits beside them rather than in settings because it is a decision about
 * the thing you are about to make, not a preference about the account.
 *
 * The fourth is email, and it belongs here for the same reason: it draws the
 * org's actual correspondence — what went out, what came back — rather than
 * describing a feature. It is passed in from the server rather than fetched
 * like the identities above, because the page has already loaded it to decide
 * whether to draw the face at all.
 */
export function ConsoleFaces({
  events,
  canEdit,
  email,
}: {
  events: SurfaceEvent[];
  canEdit: boolean;
  /** Omitted when this viewer may not see the org's mail. */
  email?: EmailSuiteData | null;
}) {
  // Fetched on the client so the face can draw the real names rather than a
  // description of the feature; its failure costs the chips, not the tile.
  const [identities, setIdentities] = React.useState<SurfaceIdentity[] | null>(null);
  React.useEffect(() => {
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
  }, []);

  return (
    <section aria-label="Make something" className="mb-10">
      <h2 className="mb-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Make something
      </h2>
      <div className="eac-face-grid grid gap-4 sm:grid-cols-2">
        <ComposeFace />
        <CalendarFace initialEvents={events} canEdit={canEdit} />
        <IdentitiesFace identities={identities} />
        {email && <EmailFace data={email} canEdit={canEdit} />}
      </div>
    </section>
  );
}
