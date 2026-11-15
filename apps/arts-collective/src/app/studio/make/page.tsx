import { redirect } from "next/navigation";
import { parseContentKey } from "@elkdonis/content/model";
import { requireUser } from "@/lib/session";

/**
 * Make into (2026-11-14): one URL that Studio's Create Library and a site's Channel both link to.
 *
 *   /studio/make?from=<thread|artwork>:<id>&to=<kind>&org=<org>&back=&backLabel=
 *
 * `to` is any kind the Studio opens as a new draft (see TARGETS; packages/studio/src/kinds.ts).
 * For now it checks the session and opens the target kind's new draft in the Studio:
 * `/studio?kind=<to>&org=&from=<key>`, with `back`/`backLabel` passed through for the Studio page
 * to check (`checkStudioBack`). Nothing carries over yet; the parts screen of
 * docs/open/MAKE_INTO_CARRY_2026-11-11.md (M1) replaces this redirect. A bad `from` is dropped and
 * a bad `to` opens the Studio as it is.
 */
export const dynamic = "force-dynamic";

const TARGETS = new Set(["post", "writing", "video", "meeting", "artwork-form", "service-form", "wordart", "recording"]);
const ORG_ID = /^[A-Za-z0-9_-]{1,64}$/;

type Props = { searchParams: Promise<{ from?: string; to?: string; org?: string; back?: string; backLabel?: string }> };

export default async function StudioMakePage({ searchParams }: Props) {
  const { from, to, org, back, backLabel } = await searchParams;

  const self = new URLSearchParams();
  for (const [k, v] of Object.entries({ from, to, org, back, backLabel })) if (typeof v === "string" && v) self.set(k, v);
  const selfQs = self.toString();
  await requireUser(`/login?next=${encodeURIComponent(`/studio/make${selfQs ? `?${selfQs}` : ""}`)}`);

  const kind = typeof to === "string" && TARGETS.has(to) ? to : null;
  const source = typeof from === "string" && from.length <= 80 && parseContentKey(from) ? from : null;

  const q = new URLSearchParams();
  if (kind) q.set("kind", kind);
  if (typeof org === "string" && ORG_ID.test(org)) q.set("org", org);
  if (kind && source) q.set("from", source);
  if (typeof back === "string" && back && back.length <= 512) q.set("back", back);
  if (typeof backLabel === "string" && backLabel) q.set("backLabel", backLabel.slice(0, 80));
  const qs = q.toString();
  redirect(`/studio${qs ? `?${qs}` : ""}`);
}
