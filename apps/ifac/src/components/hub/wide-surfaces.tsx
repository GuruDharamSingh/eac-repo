"use client";

import { SurfaceFrame, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { ComposeWorkspace } from "./compose-workspace";

/**
 * The two wide panels, as surfaces.
 *
 * These were the last `HubCard`s on the hub. They are here rather than beside
 * the feature they belong to because neither has a face of its own worth
 * writing — the tile is a door and the content is all behind it.
 */

export function QuestionnairesSurface({
  descriptor,
}: {
  descriptor: Extract<SurfaceDescriptor, { type: "custom" }>;
}) {
  const canEdit = Boolean(descriptor.props?.canEdit);
  const orgSlug = String(descriptor.props?.orgSlug ?? "");

  return (
    <SurfaceFrame
      kind="questionnaire"
      title="Questionnaires & group research"
      kicker="Ask the membership"
    >
      {canEdit ? (
        <ComposeWorkspace
          context={{
            orgSlug,
            canManageOrg: true,
            // The full grid lives at /hub/compose; here only the research
            // kinds, because that is what this panel is for.
            canPublishContent: false,
          }}
        />
      ) : (
        <div className="hub-panel">
          <p>
            Administrators open questionnaires and polls from here. When one is
            running you will be asked to answer it.
          </p>
        </div>
      )}
    </SurfaceFrame>
  );
}

export function HelpSurface() {
  return (
    <SurfaceFrame
      kind="neutral"
      title="Help & notes from the developer"
      kicker="How things work"
    >
      <div className="hub-panel">
        <h4 className="hub-panel-subhead">Getting around</h4>
        <ul className="hub-list">
          <li className="hub-list-row">
            <div>
              <p className="hub-list-title">Your page</p>
              <p className="hub-list-body">
                My profile &rarr; Edit my page opens your public page with the
                editor on it, so you see changes where they land.
              </p>
            </div>
          </li>
          <li className="hub-list-row">
            <div>
              <p className="hub-list-title">Files and documents</p>
              <p className="hub-list-body">
                Files is the group&rsquo;s shared drive. Documents are
                collaborative — several people can type in one at once.
              </p>
            </div>
          </li>
          <li className="hub-list-row">
            <div>
              <p className="hub-list-title">The calendar</p>
              <p className="hub-list-body">
                Anything dated and published reaches the group&rsquo;s Nextcloud
                calendar, which you can subscribe to on a phone.
              </p>
            </div>
          </li>
          <li className="hub-list-row">
            <div>
              <p className="hub-list-title">Everything opens in place</p>
              <p className="hub-list-body">
                Tiles open as panels over the hub rather than as new pages, and
                they stack — a day can open a gathering, which can open its
                RSVP. Escape, the backdrop or browser Back close the top one.
              </p>
            </div>
          </li>
        </ul>
        <p className="hub-muted">
          Something wrong or missing? Add it to Suggested ideas — that queue is
          read.
        </p>
      </div>
    </SurfaceFrame>
  );
}
