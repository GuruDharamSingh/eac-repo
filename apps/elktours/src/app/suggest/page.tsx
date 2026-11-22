import type { Metadata } from "next";
import { SuggestView } from "@/components/mobile/suggest-view";

export const metadata: Metadata = { title: "Suggest an artist or a place", robots: { index: false, follow: false } };

/** Screen 14 (G4). The City sheet and the Suggest pill both lead here. */
export default function SuggestPage() {
  return <SuggestView />;
}
