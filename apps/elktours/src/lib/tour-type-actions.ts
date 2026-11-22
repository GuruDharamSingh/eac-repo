"use server";
// The tour type write. Read: `tour.tourType` (lib/tours.ts) / readTourType (lib/tour-type.ts).

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import type { Result } from "@/lib/catalogue-types";
import { readTourType, type TourType } from "@/lib/tour-type";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;

/** Editors only. `null` clears it. */
export async function setTourTypeAction(tourId: string, type: TourType | null): Promise<Result<{ type: TourType | null }>> {
  await requireOrgEditor("/manage");
  if (type !== null && readTourType(type) === null) return { ok: false, error: "Unknown tour type." };
  const rows = (await (type === null
    ? db`UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb) - 'tourType', updated_at = NOW()
         WHERE id = ${tourId} AND org_id = ${ORG} AND kind = 'tour' RETURNING slug`
    : db`UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('tourType', ${type}::text), updated_at = NOW()
         WHERE id = ${tourId} AND org_id = ${ORG} AND kind = 'tour' RETURNING slug`)) as unknown as Row[];
  if (!rows[0]) return { ok: false, error: "That tour is not on this site." };
  revalidatePath("/tours");
  revalidatePath(`/tours/${rows[0].slug as string}`);
  return { ok: true, type };
}
