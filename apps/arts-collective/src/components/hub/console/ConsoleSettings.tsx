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
