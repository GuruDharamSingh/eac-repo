import { db } from "@elkdonis/db";
import { ensureDefaultRun, enrol, getActiveEnrolment, getCourseBySlug } from "@elkdonis/lms";
import { dockChoose } from "@elkdonis/actions/server";
import { siteConfig } from "@/config/site";

/** The market's store course (packages/lms/scripts/seed-market-store.mts). */
export const STORE_COURSE = "market-store";

/**
 * When a person's own market store opens, enrol them in "Finish your store" and make it their
 * dock trail, so the dock opens on its first step (2026-11-24;
 * docs/open/MARKET_CENTER_AND_DOCK_2026-11-24.md, slice 2). Org stores are not enrolled.
 * Never throws: opening the store must not fail because of the course. A missing or
 * unpublished course is a no-op.
 */
export async function startStoreCourse(userId: string): Promise<void> {
  try {
    const [store] = await db<Array<{ status: string }>>`
      SELECT status FROM store WHERE owner_user_id = ${userId} AND org_id = ${siteConfig.marketplaceOrgId} LIMIT 1
    `;
    if (store?.status !== "active") return;
    const course = await getCourseBySlug(STORE_COURSE);
    if (!course?.publishedVersionId) return;
    if (!(await getActiveEnrolment(userId, course.id))) {
      const run = await ensureDefaultRun(course);
      if (!run) return;
      const r = await enrol({ userId, roles: {} }, run.id);
      if (r.ok === false) {
        console.warn("[market] store course enrol:", r.error);
        return;
      }
    }
    await dockChoose(userId, STORE_COURSE);
  } catch (err) {
    console.warn("[market] store course:", err);
  }
}
