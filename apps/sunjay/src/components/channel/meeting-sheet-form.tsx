"use client";

import * as React from "react";
import { SiteFormPage } from "@elkdonis/site-forms";
import { sunjaySiteForms } from "@/lib/forms/site";

/**
 * Channel's "Edit here" for a meeting (design canvas "Studio pipeline frame", D: a Studio form at the
 * quick tier, in the site's look, with "More options in Studio"). The shared meeting form
 * (@elkdonis/site-forms, the same binding as /manage/content), framed for Channel's side sheet.
 * Feeds come from the server part (meeting-sheet.tsx).
 */
export function MeetingSheetForm({
  id,
  closeHref,
  studioHref,
  feeds,
}: {
  /** The meeting's thread id; null for a new one. */
  id: string | null;
  closeHref: string;
  /** The network Studio for this meeting, with `back` to this Channel (the page builds it). */
  studioHref: string;
  feeds: Array<{ slug: string; name: string }>;
}) {
  const site = React.useMemo(() => sunjaySiteForms(feeds), [feeds]);
  return (
    <div className="sj-chform">
      <p className="sj-chform-eb">Edit here · meeting, quick form</p>
      {/* The Quick-Form is a light form (ledger-quick) with a transparent button row: on this dark site it
          sits on its own paper panel so its ink and blue ghost buttons keep their contrast. */}
      <div className="sj-chform-panel">
        <SiteFormPage kind="meeting" site={site} threadId={id} closeHref={closeHref} />
      </div>
      <div className="sj-chform-more">
        <a href={studioHref}>
          More options in Studio <span aria-hidden="true">↗</span>
        </a>
        <p>Opens this meeting in the full form at arts-collective.com/studio. Studio shows “Back to Para Theater” after Save or Publish.</p>
      </div>
    </div>
  );
}
