"use server";
// "Suggest an artist or a place" (design screen 14). Rows go into visitor_suggestions (migration 239) with the
// kinds and columns drafted in migrations-draft/visitor_suggestions_artist_place_kinds.sql ('artist', 'place_lead',
// url, contact_email). Until that migration is applied this returns { ok:false, error:"available after migration" }.
// The queue, accept and reject stay in lib/suggestion-actions.ts (they do not yet know these two kinds).

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { assertPublicUrl } from "@elkdonis/utils/unfurl";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { DAILY_LIMIT } from "@/lib/suggestion-limits";
import type { Result } from "@/lib/catalogue-types";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const plain = (s: string | null | undefined, max: number) => (s ?? "").replace(/<[^>]*>/g, "").trim().slice(0, max);

export async function submitSuggestionAction(input: {
  kind: "artist" | "place";
  name: string;
  url?: string | null;
  why?: string | null;
  email?: string | null;
}): Promise<Result<{ id: string }>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to suggest something." };
  if (!viewer.isAffiliate) return { ok: false, error: "Follow us to send suggestions." };
  if (input.kind !== "artist" && input.kind !== "place") return { ok: false, error: "Choose an artist or a place." };

  const name = plain(input.name, 200);
  const why = plain(input.why, 2000);
  const email = plain(input.email, 200);
  let url = plain(input.url, 500);
  if (name.length < 2) return { ok: false, error: "Give it a name." };
  if (!url && !why) return { ok: false, error: "Add a web address or say why." };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Check the email address." };
  if (url) {
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    if (!url.includes(".")) return { ok: false, error: "That does not look like a web address." };
    try {
      await assertPublicUrl(url);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "That link cannot be used." };
    }
  }

  const [cols] = (await db`
    SELECT to_regclass('public.visitor_suggestions') AS t,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visitor_suggestions' AND column_name = 'url') AS has_url,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visitor_suggestions' AND column_name = 'contact_email') AS has_email,
      EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.visitor_suggestions') AND conname = 'visitor_suggestions_kind_check'
              AND pg_get_constraintdef(oid) LIKE '%place_lead%') AS kind_ok
  `) as unknown as Row[];
  if (!cols?.t || !cols.has_url || !cols.has_email || !cols.kind_ok) return { ok: false, error: "available after migration" };

  const [used] = (await db`
    SELECT COUNT(*)::int AS n FROM visitor_suggestions WHERE user_id = ${viewer.userId} AND org_id = ${ORG} AND created_at > NOW() - interval '24 hours'
  `) as unknown as Row[];
  if (Number(used?.n ?? 0) >= DAILY_LIMIT) return { ok: false, error: `That is ${DAILY_LIMIT} suggestions today; thank you! Try again tomorrow.` };

  const [r] = (await db`
    INSERT INTO visitor_suggestions (org_id, kind, user_id, title, note, url, contact_email)
    VALUES (${ORG}, ${input.kind === "artist" ? "artist" : "place_lead"}, ${viewer.userId}, ${name}, ${why || null}, ${url || null}, ${email || null})
    RETURNING id
  `) as unknown as Row[];
  revalidatePath("/manage/suggestions");
  return { ok: true, id: r!.id as string };
}
