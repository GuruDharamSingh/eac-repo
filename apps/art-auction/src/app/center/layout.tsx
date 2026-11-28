import type { ReactNode } from "react";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { CenterSurfaces } from "./_components/surfaces";

/** /center and /center/work share the popup system (cms-ui surfaces) for the cards' frames. */
export default async function CenterLayout({ children }: { children: ReactNode }) {
  const userId = await getCurrentUserId();
  return <CenterSurfaces signedIn={Boolean(userId)}>{children}</CenterSurfaces>;
}
