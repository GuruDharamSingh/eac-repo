import "@elkdonis/cms-ui/hubsite.css";
import "@/app/hub/hub-cards.css";
import type * as React from "react";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { HubPageFrame, type HubCrumb } from "@elkdonis/cms-ui/hubsite";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getSiteContent } from "@/lib/data";
import { siteConfig } from "@/config/site";

/**
 * The chrome of a hub page that a "Cards 2" card opens (2026-10-10): the
 * site header, then cms-ui's shared `HubPageFrame` (breadcrumb, title,
 * intro, body), then the footer — the same order as /hub/compose.
 *
 * The frame sits inside `.hub` so it takes the hub's paper ground; the
 * `--sf-*` tokens it is drawn with come from `.ifac-hub-scope` in the hub
 * layout. Without `.hub` the frame would sit on the site's #020202 body
 * with ink-coloured text.
 */
export async function HubPageShell({
  userId,
  crumbs,
  title,
  intro,
  actions,
  wide,
  children,
}: {
  userId: string;
  crumbs: HubCrumb[];
  title: string;
  intro?: React.ReactNode;
  actions?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const content = await getSiteContent();
  return (
    <div className="site-shell">
      <ThemeStyle orgId={siteConfig.orgId} pageKey="hub" userId={userId} />
      <SiteHeader />
      <div className="hub ifac-hp">
        <HubPageFrame crumbs={crumbs} title={title} intro={intro} actions={actions} wide={wide}>
          {children}
        </HubPageFrame>
      </div>
      <SiteFooter content={content.footer} />
    </div>
  );
}
