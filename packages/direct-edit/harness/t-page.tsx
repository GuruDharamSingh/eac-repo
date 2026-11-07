import fs from "node:fs";
import Link from "next/link";
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { serverPuckConfig } from "@/lib/puck/config.server";
import { Reveal } from "@/components/landing/Reveal";
export const dynamic = "force-dynamic";
export default async function TreeTest() {
  const doc = JSON.parse(fs.readFileSync("/h/landing-doc.json", "utf8")) as Data;
  const parts = {
    "hero-actions": <div className="ig-hero-actions" data-landing-part="hero-actions"><Link href="/login" className="cta-btn">LIVE-SIGN-IN</Link></div>,
    offerings: <div data-landing-part="offerings">LIVE-OFFERINGS</div>,
    "login-banner": <div data-landing-part="login-banner">LIVE-BANNER</div>,
    gallery: <div data-landing-part="gallery">LIVE-GALLERY</div>,
    join: <div data-landing-part="join">LIVE-JOIN</div>,
    forum: <div data-landing-part="forum">LIVE-FORUM</div>,
    "fundraising-progress": <div data-landing-part="fundraising-progress">LIVE-PROGRESS</div>,
    "fundraising-status": <p data-landing-part="fundraising-status">LIVE-STATUS</p>,
    "board-list": <div data-landing-part="board-list"><Reveal as="ul" className="ig-members">LIVE-BOARD</Reveal></div>,
  };
  const metadata = { orgId: "inner_group", slug: "landing", parts };
  const filled = await resolveAllData(doc, serverPuckConfig, metadata);
  return <div className="marketing-root"><Render config={serverPuckConfig} data={filled as Data} metadata={metadata} /></div>;
}
