import type { ReactNode } from "react";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { CenterSurfaces } from "../center/_components/surfaces";

/** The market's popups on the artists directory and store fronts: an artist card opens the artist profile popup (2026-11-26). */
export default async function Layout({ children }: { children: ReactNode }) {
  const userId = await getCurrentUserId().catch(() => null);
  return <CenterSurfaces signedIn={Boolean(userId)}>{children}</CenterSurfaces>;
}
