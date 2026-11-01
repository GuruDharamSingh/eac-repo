import type { Metadata } from "next";
import "./microfiche.css";
import { Microfiche } from "@/classifieds/Microfiche";
import { ClassifiedsFonts } from "./fonts";
import { loadRealEntries } from "./reals";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Classifieds — ArtDirect",
  description: "An endless sheet of classified ads from across the Arts Collective network, read like a microfiche.",
};

/**
 * /classifieds: the microfiche. The viewer is fixed over the whole viewport
 * (covering the site header, which stays in the layout); the HUD carries the
 * way back. Visitors land on a random spot unless the URL hash names one.
 */
export default async function ClassifiedsPage() {
  const reals = await loadRealEntries();
  return (
    <>
      <ClassifiedsFonts />
      <Microfiche reals={reals} />
    </>
  );
}
