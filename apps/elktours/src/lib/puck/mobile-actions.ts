"use server";

import { revalidatePath } from "next/cache";
import { cleanBoxDoc } from "@elkdonis/direct-edit/block";
import { stripResolvedKeys } from "@elkdonis/blocks/record";
import { getApiEditor } from "@/lib/auth";
import { savePage } from "./store";
import { RESOLVED_KEYS } from "./resolved";
import { MOBILE_PATH, isMobileKey } from "./mobile-keys";
import { readMobileTours, type MobileToursData } from "./mobile-data";
import { readMobileDiscover } from "./mobile-discover";
import { sampleMobileTour } from "./mobile-tour";
import { readMobileContent, sampleMobileExp } from "./mobile-content";
import type { MobileContent, MobileDiscover, MobileExpDetail, MobileTourDetail } from "@/blocks/mobile/types";

/** Publish a phone document from /studio/m-<name>. Same gate as savePageAction: owners and guides, checked here. */
export async function saveMobileDocAction(key: string, data: unknown): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only owners and guides can publish pages." };
  if (!isMobileKey(key)) return { ok: false, error: "That is not a phone page." };
  const result = await savePage(key, cleanBoxDoc(stripResolvedKeys(data, RESOLVED_KEYS)));
  if (result.ok) revalidatePath(MOBILE_PATH[key]);
  return result;
}

/** The editor's copy of the tours resolver: the same answer a visitor's page gets (public data, no gate needed). */
export async function mobileToursAction(): Promise<MobileToursData> {
  return readMobileTours();
}

/** The editor copies of the Discover and tour-template resolvers (public data, as above). */
export async function mobileDiscoverAction(): Promise<MobileDiscover> {
  return readMobileDiscover();
}
export async function mobileTourSampleAction(): Promise<MobileTourDetail | null> {
  return sampleMobileTour();
}

/** Editor copies of the experiences, people and experience-template resolvers (G4). */
export async function mobileContentAction(): Promise<MobileContent> {
  return readMobileContent();
}
export async function mobileExpSampleAction(): Promise<MobileExpDetail | null> {
  return sampleMobileExp();
}
