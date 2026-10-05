import { db } from "@elkdonis/db";
import { getStoreForUser } from "@elkdonis/commerce/queries";
import type { StoreEntryState } from "@elkdonis/commerce/links";
import type { HubSections } from "@/components/hub/PageSectionsCard";

/**
 * Which optional sections a person shows on their own IFAC page
 * (`users.profile_sections`), plus where their marketplace store stands.
 *
 * Writing, the Elkdonis feed and the store are opt-in: off unless set. The
 * galleries section is opt-out here: IFAC always showed galleries, so it is
 * on unless the member switched it off (`galleries: false`). ArtDirect reads
 * the same key as opt-in (packages/services/src/presence.ts).
 */
export async function readProfileSections(userId: string): Promise<HubSections> {
  const empty: HubSections = {
    elkdonisFeed: false,
    store: false,
    blog: false,
    galleries: true,
    storeState: "none",
    storeId: null,
    storeName: null,
  };
  try {
    const [row] = await db<Array<{ profile_sections: Record<string, unknown> }>>`
      SELECT profile_sections FROM users WHERE id = ${userId}
    `;
    // Their marketplace store, in whatever state it is actually in. This used
    // to collapse to `hasStore: status === "active"`, which told a member
    // whose application was under review to go and open a store — the one
    // thing they had already done.
    const store = await getStoreForUser(userId).catch(() => null);
    const s = row?.profile_sections ?? {};
    return {
      elkdonisFeed: Boolean(s.elkdonisFeed),
      store: Boolean(s.store),
      blog: Boolean(s.blog),
      galleries: !isOff(s.galleries),
      storeState: (store?.status as StoreEntryState) ?? "none",
      storeId: store?.id ?? null,
      storeName: store?.displayName ?? null,
    };
  } catch (error) {
    console.error("[ifac] readProfileSections error:", error);
    return empty;
  }
}

/** True only when the member explicitly switched `key` off. */
export async function isProfileSectionOff(userId: string, key: string): Promise<boolean> {
  try {
    const [row] = await db<Array<{ v: unknown }>>`
      SELECT profile_sections -> ${key} AS v FROM users WHERE id = ${userId}
    `;
    return isOff(row?.v);
  } catch (error) {
    console.error("[ifac] isProfileSectionOff error:", error);
    return false;
  }
}

function isOff(v: unknown): boolean {
  return v === false || v === "false";
}
