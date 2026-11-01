"use client";

import * as React from "react";
import { SurfaceFrame, SurfaceSection } from "@elkdonis/cms-ui/surface";
import { OrgIdentityPanel } from "@/components/hub/OrgIdentityPanel";
import { AppearancePanel } from "@/components/hub/AppearancePanel";
import { MyAppearancePanel } from "@/components/hub/MyAppearancePanel";
import { MembersPanel } from "@/components/hub/MembersPanel";
import { SilexSurfaceControls } from "@/components/hub/SilexSurfaceControls";

/**
 * Everything configural about an organisation, off the console's main page.
 *
 * These four panels used to sit inline between the things an owner comes here
 * to DO — identity between publishing and members, a CSS-variable editor
 * between members and the subdomain. Configuration is rare and deliberate;
 * publishing is daily. Mixing them made a long page where the common task was
 * the hardest to find.
 *
 * One surface with four sections rather than four surfaces: someone who opens
 * settings to change a colour usually also wants to see the site's name and
 * who can edit it, and a stack of dialogs to compare two settings is worse
 * than a scroll.
 */

export interface ConsoleSettingsProps {
  orgId: string;
  orgSlug: string;
  orgName: string;
  isOwner: boolean;
  currentUserId: string;
  homeUrl: string;
  layoutMode: "default" | "silex";
  hasPublishedSilex: boolean;
  /** The page editor for this org's landing page (/hub/sites/<slug>/design). */
  designHref: string;
  /** A designed landing page is published (`site_config` `puck:home`). */
  hasDesignedPage: boolean;
  /** What the subdomain root shows today, for the sentence under the address. */
  leading: { mode: "silex" | "designed" | "pinned" | "latest" | "default"; title?: string | null };
  onRemoveDesign: (orgSlug: string) => Promise<{ ok: boolean; error?: string }>;

  identity: React.ComponentProps<typeof OrgIdentityPanel>["initial"];
  onSaveIdentity: React.ComponentProps<typeof OrgIdentityPanel>["onSave"];

  themeVars: React.ComponentProps<typeof AppearancePanel>["vars"];
  themePages: React.ComponentProps<typeof AppearancePanel>["pages"];
  overridesByPage: React.ComponentProps<typeof AppearancePanel>["overridesByPage"];
  onSaveSiteTheme: React.ComponentProps<typeof AppearancePanel>["onSave"];

  myThemeOverrides: React.ComponentProps<typeof MyAppearancePanel>["overrides"];
  onSaveMyTheme: React.ComponentProps<typeof MyAppearancePanel>["onSave"];

  members: React.ComponentProps<typeof MembersPanel>["members"];
}

const SECTIONS = [
  { id: "identity", label: "Identity" },
  { id: "people", label: "People & roles" },
  { id: "appearance", label: "Appearance" },
  { id: "site", label: "Site & address" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function ConsoleSettings({
  props,
  initialSection = "identity",
}: {
  props: ConsoleSettingsProps;
  initialSection?: SectionId;
}) {
  const [section, setSection] = React.useState<SectionId>(initialSection);
  const homeLabel = props.homeUrl.replace(/^https?:\/\//, "");

  const rail = (
    <nav aria-label="Settings sections" className="flex flex-col gap-1">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setSection(s.id)}
          aria-current={section === s.id ? "true" : undefined}
          className={`rounded-md px-3 py-2 text-left text-sm transition ${
            section === s.id
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          }`}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );

  return (
    <SurfaceFrame
      kind="neutral"
      title="Settings"
      kicker={props.orgName}
      rail={rail}
      actions={[{ label: "Open the site ↗", href: props.homeUrl, external: true }]}
    >
      {section === "identity" && (
        <SurfaceSection title="Who this org is">
          <p className="mb-4 text-sm text-muted-foreground">
            Shown on your profile page and in the network directory.
          </p>
          <OrgIdentityPanel
            orgId={props.orgId}
            onSave={props.onSaveIdentity}
            initial={props.identity}
          />
        </SurfaceSection>
      )}

      {section === "people" && (
        <SurfaceSection title="People & roles">
          <p className="mb-4 text-sm text-muted-foreground">
            {props.isOwner
              ? "Owners and guides can publish. Members take part. Viewers can only read."
              : "Only an owner can change roles."}
          </p>
          <MembersPanel
            orgSlug={props.orgSlug}
            currentUserId={props.currentUserId}
            isOwner={props.isOwner}
            members={props.members}
          />
        </SurfaceSection>
      )}

      {section === "appearance" && (
        <SurfaceSection title="Appearance">
          <p className="mb-4 text-sm text-muted-foreground">
            These set CSS variables the whole site reads — your pages and the
            live components share them, so a change here restyles both. Pick a
            scope to theme the whole site or just one page.
          </p>
          <div className="flex flex-wrap items-start gap-4">
            <AppearancePanel
              orgId={props.orgId}
              vars={props.themeVars}
              pages={props.themePages}
              overridesByPage={props.overridesByPage}
              onSave={props.onSaveSiteTheme}
            />
            <MyAppearancePanel
              vars={props.themeVars}
              overrides={props.myThemeOverrides}
              onSave={props.onSaveMyTheme}
            />
          </div>
        </SurfaceSection>
      )}

      {section === "site" && (
        <SurfaceSection title="Site & address">
          <p className="mb-3 text-sm text-muted-foreground">
            Every org has a subdomain, whatever its tier.
          </p>
          <p className="font-mono text-sm text-foreground">{homeLabel}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Public surface:{" "}
            {props.layoutMode === "silex"
              ? "your published Silex page"
              : "the standard three pages"}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {[
              ["Offering", "/offering"],
              ["Profile", "/profile"],
              ["Community", "/community"],
            ].map(([label, path]) => (
              <a
                key={path}
                href={`${props.homeUrl}${path}`}
                target="_blank"
                rel="noopener"
                className="underline underline-offset-4 hover:text-foreground"
              >
                {label} ↗
              </a>
            ))}
          </p>
          <LandingPageControls props={props} />
          <div className="mt-4">
            <SilexSurfaceControls
              slug={props.orgSlug}
              layoutMode={props.layoutMode}
              hasPublished={props.hasPublishedSilex}
            />
          </div>
        </SurfaceSection>
      )}
    </SurfaceFrame>
  );
}

/**
 * The landing page: what leads the site today, the page editor, and the way
 * back to the default page. Sits beside the Silex controls because both
 * answer "what is at /": Silex for a whole site, the page editor for the
 * landing page alone (decision A of the onboarding brief, 2026-10-29).
 */
function LandingPageControls({ props }: { props: ConsoleSettingsProps }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { leading } = props;
  const reading =
    leading.mode === "silex"
      ? "your published Silex page"
      : leading.mode === "designed"
        ? "the landing page you designed"
        : leading.mode === "pinned"
          ? `the pinned item${leading.title ? `, “${leading.title}”` : ""}`
          : leading.mode === "latest"
            ? `the newest published item${leading.title ? `, “${leading.title}”` : ""} (pin one to choose)`
            : "the default page built from your identity (nothing is published yet)";

  async function remove() {
    if (!window.confirm("Remove the designed landing page? The site goes back to the offering or the default page. The design is not kept.")) return;
    setBusy(true);
    setError(null);
    const r = await props.onRemoveDesign(props.orgSlug);
    setBusy(false);
    if (!r.ok) setError(r.error ?? "Could not remove it.");
    else window.location.reload();
  }

  return (
    <div className="mt-5 border-t border-border pt-4" data-landing-controls>
      <h3 className="text-sm font-medium">Landing page</h3>
      <p className="mt-1 text-sm text-muted-foreground">Your site opens on {reading}.</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a
          href={props.designHref}
          className="inline-flex min-h-9 items-center rounded-md border border-border bg-background px-3 font-medium hover:bg-accent"
        >
          {props.hasDesignedPage ? "Edit the landing page" : "Design the landing page"}
        </a>
        {props.hasDesignedPage && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
          >
            {busy ? "Removing…" : "Use the default page instead"}
          </button>
        )}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Without a designed page the site leads with the pinned item, else the newest published one; pin from the
        “published” list on the console or from the item itself.
      </p>
      {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
