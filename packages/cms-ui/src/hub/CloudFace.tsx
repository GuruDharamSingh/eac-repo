"use client";

import * as React from "react";
import { SurfaceCard, SurfaceFrame, type SurfaceDescriptor } from "../surface";

// ============================================================================
// "Cloud" — the member's way into Nextcloud, as a hub face.
//
// The org's files are already browsable on the hub (a host's Files card reads
// them through the platform). This card is for the OTHER half: Nextcloud as
// its own place — the desktop and phone apps, sharing links, editing a
// document in Collabora, the calendar — and for linking your account so the
// team folder shows up there at all.
//
// It links out rather than framing Nextcloud, deliberately: Nextcloud refuses
// to be framed (frame-ancestors 'self'), and its session cookies are
// SameSite=Lax/Strict, which browsers never send inside a cross-site frame —
// on an org domain the person could never stay signed in inside one.
//
// A host passes `getViewerCloud(userId, orgId)` from @elkdonis/services as
// `cloud`, and registers the surface: `custom: { cloud: CloudSurface }`.
// ============================================================================

/** Mirrors services' ViewerCloud; restated because cms-ui doesn't depend on services. */
export interface HubCloud {
  linked: boolean;
  nextcloudUrl: string;
  teamFolderUrl: string;
  teamFolderLabel: string;
  personalFolderUrl: string | null;
}

export function CloudFace({ cloud, orgName }: { cloud: HubCloud; orgName: string }) {
  return (
    <SurfaceCard
      kind="neutral"
      glyph="☁"
      kicker="Nextcloud"
      title="Cloud"
      blurb={
        cloud.linked
          ? `Your files, ${orgName}'s team folder and calendar — in the browser or the Nextcloud apps.`
          : "Link your Nextcloud once to get the team folder, your own folder and the calendar."
      }
      surface={{
        type: "custom",
        key: "cloud",
        title: "Cloud",
        kind: "neutral",
        size: "standard",
        props: { cloud, orgName },
      }}
      preview={
        cloud.linked ? (
          <span className="eac-preview-line">
            <span aria-hidden>✓</span> <span>Linked</span>
          </span>
        ) : (
          <span className="eac-preview-line">
            <span aria-hidden>→</span> <span>Not linked yet — one step</span>
          </span>
        )
      }
    />
  );
}

export function CloudSurface({
  descriptor,
}: {
  descriptor: Extract<SurfaceDescriptor, { type: "custom" }>;
}) {
  const cloud = descriptor.props?.cloud as HubCloud | undefined;
  const orgName = (descriptor.props?.orgName as string | undefined) ?? "the group";
  if (!cloud) return null;
  const host = cloud.nextcloudUrl.replace(/^https?:\/\//, "");

  return (
    <SurfaceFrame kind="neutral" title="Cloud" kicker="Nextcloud">
      <div className="eac-cloud">
        <p className="eac-cloud__lede">
          Cloud storage that belongs to you and the group, run by the collective — not-for-profit and open
          source. Use it from these sites, or directly in Nextcloud on the web, desktop or phone.
        </p>

        {cloud.linked ? (
          <>
            <p className="eac-cloud__status is-linked">
              <span aria-hidden>✓</span> Your Nextcloud is linked.
            </p>
            <ul className="eac-cloud__links">
              <li>
                <a className="eac-btn eac-btn--primary" href={cloud.teamFolderUrl} target="_blank" rel="noreferrer">
                  Open {orgName}&rsquo;s team folder
                </a>
                <span className="eac-cloud__path">{cloud.teamFolderLabel}</span>
              </li>
              {cloud.personalFolderUrl && (
                <li>
                  <a className="eac-btn" href={cloud.personalFolderUrl} target="_blank" rel="noreferrer">
                    Open my own folder
                  </a>
                  <span className="eac-cloud__path">Only you can see it</span>
                </li>
              )}
              <li>
                <a className="eac-btn eac-btn--quiet" href={cloud.nextcloudUrl} target="_blank" rel="noreferrer">
                  Open Nextcloud
                </a>
                <span className="eac-cloud__path">{host}</span>
              </li>
            </ul>
            <p className="eac-cloud__note">
              Just joined? New access reaches Nextcloud within about 10 minutes.
            </p>
          </>
        ) : (
          <>
            <p className="eac-cloud__status is-unlinked">One step, once:</p>
            <ol className="eac-cloud__steps">
              <li>
                Open{" "}
                <a href={cloud.nextcloudUrl} target="_blank" rel="noreferrer">
                  {host}
                </a>
                .
              </li>
              <li>
                Choose <strong>Sign in with Elkdonis</strong> — it uses the account you&rsquo;re signed in with here.
              </li>
              <li>Within about 10 minutes, {orgName}&rsquo;s team folder and your own folder appear there.</li>
            </ol>
            <a className="eac-btn eac-btn--primary" href={cloud.nextcloudUrl} target="_blank" rel="noreferrer">
              Open Nextcloud to link
            </a>
          </>
        )}
      </div>
    </SurfaceFrame>
  );
}
