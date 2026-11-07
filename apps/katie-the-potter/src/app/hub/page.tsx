import type { Metadata } from "next";
import { HubCardGrid, HubLinkCard, HubPageFrame } from "@elkdonis/cms-ui/hubsite";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import "@elkdonis/cms-ui/surface.css";
import "@elkdonis/cms-ui/hubsite.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hub", robots: { index: false, follow: false } };

/**
 * /hub: the shop's rooms as cards, for its editors. The reference apps' hub is
 * a members' room (chat, calendar, forum, pipeline) that needs a surface
 * provider and a few hundred lines of connectors; a one-artist shop has none
 * of that, so this is the server-rendered cms-ui hub kit pointing at the
 * /manage sections, with no provider and no client code.
 */
export default async function HubPage() {
  const viewer = await requireOrgEditor("/hub");
  return (
    <HubPageFrame
      wide
      crumbs={[{ label: siteConfig.orgName, href: "/" }, { label: "Hub" }]}
      title="Hub"
      intro={`Signed in as ${viewer.email}. Everything for running the shop, in one place.`}
    >
      <HubCardGrid label="Shop sections">
        <HubLinkCard lead href="/manage" glyph="◧" title="Manage" blurb="The overview: what is for sale, what needs doing, how you get paid." />
        <HubLinkCard href="/manage/pieces" glyph="◍" title="Pieces" blurb="Add, edit, publish and retire the pieces in the store." />
        <HubLinkCard href="/manage/orders" glyph="✉" title="Orders" blurb="Confirm eTransfers, mark orders shipped, cancel or refund." />
        <HubLinkCard href="/manage/payouts" glyph="$" title="Payouts" blurb="Where you are, how money reaches you, and what you are owed." />
        <HubLinkCard href="/manage/site" glyph="☰" title="Site" blurb="Pages and the public site." />
        {viewer.role === "owner" ? <HubLinkCard href="/manage/analytics" glyph="∿" title="Visitors" blurb="Who comes to the site, and from where." /> : null}
        <HubLinkCard href="/channel" glyph="◉" title="Channel" blurb="Post pieces to Facebook, Instagram and Threads, follow up with video or writing, and see where each post went." />
        <HubLinkCard href="/studio" glyph="✎" title="Page editor" blurb="Arrange blocks to build the landing and other pages." />
        <HubLinkCard href="/center" glyph="◌" title="Center" blurb="Your home on the Arts Collective network." />
      </HubCardGrid>
    </HubPageFrame>
  );
}
