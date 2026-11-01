import type { Metadata } from "next";
import "../microfiche.css";
import { Microfiche } from "@/classifieds/Microfiche";
import { ClassifiedsFonts } from "../fonts";
import { loadNewsAds } from "./metis";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The News — ArtDirect",
  description: "Today's headlines from the Metis news desk, set as an endless microfiche sheet.",
  robots: { index: false },
};

/**
 * /classifieds/news: a side version of /classifieds with no ads. Every box
 * on the sheet is a real news story (from Metis), in the same faces, boxes
 * and rules. Kept apart from the main page until it has been looked at.
 */
export default async function ClassifiedsNewsPage() {
  const news = await loadNewsAds();
  return (
    <>
      <ClassifiedsFonts />
      <Microfiche reals={[]} news={news} />
    </>
  );
}
