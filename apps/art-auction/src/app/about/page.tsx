import type { Metadata } from "next";
import { getMarketplaceSettings } from "@elkdonis/commerce/server";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { loadAbout, canEditAbout, type AboutContent } from "@/lib/about-content";
import { siteConfig } from "@/config/site";
import { cormorant, jost } from "../series/[slug]/series-fonts";
import { SrsNav } from "../series/[slug]/series-template";
import { AboutEditor, AboutBody } from "./about-editor";
import "../series/[slug]/series-template.css";
import "../series/[slug]/manage/workspace.css";
import "./about.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "About",
  description: "What Collect Art is, who presents the auction, and who stands behind the platform.",
};

// The About page (2026-10-28), after the "About A: names as headers" board
// (https://claude.ai/artifact/4BRndE7RCsQHX7joYW4MjV): each section is a
// header with a burgundy rule, Collect Art's own words beside an optional
// media piece. The content lives in site_config (lib/about-content.ts) and
// the site's owners edit it in place (about-editor.tsx).

export default async function AboutPage() {
  const [{ content, saved }, settings, userId] = await Promise.all([loadAbout(), getMarketplaceSettings(siteConfig.marketplaceOrgId), getCurrentUserId()]);
  const editor = await canEditAbout(userId);
  const commission = settings.defaultCommissionRate;
  const shown: AboutContent = { ...content, sections: editor ? content.sections : content.sections.filter((s) => s.html || s.media) };
  const footer = (
    <footer className="srs-foot">
      {siteConfig.name} is part of <a href={siteConfig.network.artsCollectiveUrl}>Arts Collective</a>, operated on behalf of the Elkdonis Arts Collective, a not-for-profit.
    </footer>
  );
  return (
    <div className={`srs abt ${cormorant.variable} ${jost.variable}`}>
      {editor ? (
        <AboutEditor content={content} saved={saved} commission={commission} signedIn={Boolean(userId)} footer={footer} />
      ) : (
        <>
          <SrsNav signedIn={Boolean(userId)} current="about" />
          <AboutBody content={shown} commission={commission} />
          {footer}
        </>
      )}
    </div>
  );
}
