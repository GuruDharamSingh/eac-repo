"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import {
  createSocialPost,
  getIdentityIds,
  getSocialPost,
  isOrgChannel,
  listConnections,
  listUserMemberships,
  updateSocialPost,
} from "@elkdonis/services";
import {
  ChannelNotReady,
  ChannelPlanConflict,
  addChannelPlanStep,
  addChannelRule,
  addChannelTodo,
  archiveChannelRoutine,
  channelRoutineOwnedBy,
  updateChannelRoutine,
  createChannelDelivery,
  findOpenChannelDelivery,
  createChannelRoutine,
  ensureChannelPlan,
  saveChannelPlan,
  setChannelPlanStep,
  setChannelTodoDone,
  updateChannelDelivery,
  type ChannelActor,
  type ChannelOwner,
  type ChannelSubject,
  type RoutineCadence,
} from "@elkdonis/services/channel";
import { getCurrentUser } from "@/lib/session";
import { listShareTargets } from "@/lib/share-actions";
import { publishSocialPost } from "@/lib/post-actions";
import { linkInBio, INSTAGRAM_RULES, type Outlet } from "./model";

// ============================================================================
// Channel writes. Every action:
//   - resolves the acting user from the session (never from the form),
//   - checks the piece belongs to that person, or to an org they run
//     (owner or guide), before writing anything about it,
//   - records actor kind 'user' (agents reach the same services through the
//     action registry and record 'agent'),
//   - returns { ok, error } — compare `r.ok === false` (strict: false).
// Posting to Instagram, Facebook and Threads happens in one place only,
// publishNewPostAction, after the person confirms the exact list in New post.
// It goes through the Studio's own send path (post-actions publishSocialPost),
// so the connection, org-channel and publish-job rules are the Studio's.
// Scheduled deliveries are still plans: nothing sends them.
// docs/open/channel.md §6.
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ChannelResult<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const MANAGER = new Set(["owner", "guide"]);

interface Acting {
  userId: string;
  actor: ChannelActor;
  orgIds: string[];
  identityIds: string[];
}

async function acting(): Promise<Acting | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const [memberships, identityIds] = await Promise.all([listUserMemberships(user.id), getIdentityIds(user.id)]);
  return {
    userId: user.id,
    actor: { kind: "user", id: user.id, userId: user.id },
    // "oad" is the personal org every "Just me" row lives under: a role on it
    // must not count as managing other people's personal posts.
    orgIds: memberships.filter((m) => MANAGER.has(m.role) && m.orgId !== "oad").map((m) => m.orgId),
    identityIds,
  };
}

/** `user:<uuid>` or `org:<id>` → an owner this person may act for. */
function ownerFor(a: Acting, identityId: string | null | undefined, scopeOrg: string | null): ChannelOwner | null {
  if (scopeOrg) return a.orgIds.includes(scopeOrg) ? { kind: "org", id: scopeOrg } : null;
  if (!identityId || identityId === `user:${a.userId}`) return { kind: "user", id: a.userId };
  const m = /^org:(.+)$/.exec(identityId);
  if (m && a.orgIds.includes(m[1])) return { kind: "org", id: m[1] };
  return null;
}

/** The name a row goes out under is the owner's own: never taken from the form. */
function identityOf(a: Acting, owner: ChannelOwner): string {
  return owner.kind === "org" ? `org:${owner.id}` : `user:${a.userId}`;
}

/** A routine id from the form, kept only if it is this owner's live routine. */
async function ownRoutine(owner: ChannelOwner, routineId: string | null | undefined): Promise<string | null> {
  if (!routineId || !/^[A-Za-z0-9_-]{1,21}$/.test(routineId)) return null;
  return (await channelRoutineOwnedBy(owner, routineId)) ? routineId : null;
}

function parseKey(key: string): ChannelSubject | null {
  const m = /^(thread|artwork):([A-Za-z0-9_-]{1,64})$/.exec(key ?? "");
  return m ? { kind: m[1] as ChannelSubject["kind"], id: m[2] } : null;
}

/**
 * The piece is the person's (authored / made) or belongs to an org they run.
 * `plan` (plans, to-dos) also admits artwork an org's site shows through its
 * shop:store pin; `deliver` (anything that would go out under a name) does
 * not, so an org manager cannot post another artist's work through the org.
 */
async function mayTouch(a: Acting, subject: ChannelSubject, purpose: "plan" | "deliver" = "deliver"): Promise<boolean> {
  if (subject.kind === "thread") {
    const rows = await db<Array<{ ok: boolean }>>`
      SELECT true AS ok FROM threads
      WHERE id = ${subject.id} AND status <> 'archived'
        AND (author_id = ANY(${a.identityIds}) OR org_id = ANY(${a.orgIds.length ? a.orgIds : [""]}))
      LIMIT 1
    `;
    return Boolean(rows[0]);
  }
  const rows = await db<Array<{ ok: boolean }>>`
    SELECT true AS ok FROM artwork a
    LEFT JOIN store s ON s.id = a.store_id
    LEFT JOIN site_config c ON c.key = 'shop:store' AND c.value->>'storeId' = s.id::text
    WHERE a.id::text = ${subject.id} AND a.status <> 'archived'
      AND (a.artist_user_id = ${a.userId} OR a.credited_artist_user_id = ${a.userId}
           OR s.owner_user_id = ${a.userId}
           OR s.owner_org_id = ANY(${a.orgIds.length ? a.orgIds : [""]})
           OR (${purpose === "plan"} AND c.org_id = ANY(${a.orgIds.length ? a.orgIds : [""]})))
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

function failure(err: unknown): { ok: false; error: string } {
  if (err instanceof ChannelNotReady || err instanceof ChannelPlanConflict) return { ok: false, error: err.message };
  const message = err instanceof Error ? err.message : String(err);
  console.error("[channel action]", message);
  return { ok: false, error: message.length < 160 ? message : "That did not save." };
}

const OUTLETS: Outlet[] = ["site", "page", "market", "instagram", "facebook", "threads", "youtube", "video", "writing", "live", "newsletter"];
const asOutlet = (v: string): Outlet | null => (OUTLETS.includes(v as Outlet) ? (v as Outlet) : null);

function done() {
  revalidatePath("/channel", "layout");
}

// ── suggestions ─────────────────────────────────────────────────────────────

export interface SuggestionInput {
  pieceKey: string;
  outlet: string;
  identityId: string;
  text: string;
  at: string | null;
  routineId: string | null;
  scopeOrg: string | null;
}

/** Accept: a draft delivery placed where the suggestion was, and a step in plan.md. */
export async function acceptSuggestionAction(s: SuggestionInput): Promise<ChannelResult> {
  return acceptSuggestionsAction([s]);
}

export async function acceptSuggestionsAction(list: SuggestionInput[]): Promise<ChannelResult<{ accepted: number }>> {
  try {
    const a = await acting();
    if (!a) return { ok: false, error: "Sign in first." };
    let accepted = 0;
    for (const s of list.slice(0, 20)) {
      const subject = parseKey(s.pieceKey);
      const outlet = asOutlet(s.outlet);
      const owner = ownerFor(a, s.identityId, s.scopeOrg);
      if (!subject || !outlet || !owner) return { ok: false, error: "That suggestion is not yours to accept." };
      if (!(await mayTouch(a, subject, "deliver"))) return { ok: false, error: "That piece is not yours." };
      const identityId = identityOf(a, owner);
      // Accepting twice (a double click, a second tab) writes nothing the second time.
      if (await findOpenChannelDelivery(owner, subject, outlet, identityId)) continue;
      const at = s.at && !Number.isNaN(Date.parse(s.at)) ? new Date(s.at).toISOString() : null;
      const text = String(s.text ?? "").slice(0, 200);
      await createChannelDelivery(
        owner,
        { subject, outlet, status: "draft", identityId, scheduledAt: at, routineId: await ownRoutine(owner, s.routineId), payload: { suggestion: text, title: text } },
        a.actor
      );
      await addChannelPlanStep(owner, subject, { text, fromBoard: true, on: at ? at.slice(0, 10) : null }, a.actor);
      accepted += 1;
    }
    done();
    return { ok: true, accepted };
  } catch (err) {
    return failure(err);
  }
}

/** Dismiss: remembered as a 'dismissed' delivery so the gap stops suggesting it. */
export async function dismissSuggestionAction(s: SuggestionInput): Promise<ChannelResult> {
  try {
    const a = await acting();
    if (!a) return { ok: false, error: "Sign in first." };
    const subject = parseKey(s.pieceKey);
    const outlet = asOutlet(s.outlet);
    const owner = ownerFor(a, s.identityId, s.scopeOrg);
    if (!subject || !outlet || !owner) return { ok: false, error: "That suggestion is not yours." };
    if (!(await mayTouch(a, subject, "deliver"))) return { ok: false, error: "That piece is not yours." };
    const identityId = identityOf(a, owner);
    if (await findOpenChannelDelivery(owner, subject, outlet, identityId)) {
      done();
      return { ok: true };
    }
    await createChannelDelivery(owner, { subject, outlet, status: "dismissed", identityId, payload: { suggestion: String(s.text ?? "").slice(0, 200) } }, a.actor);
    done();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

// ── plan.md ─────────────────────────────────────────────────────────────────

async function planTarget(pieceKey: string, identityId: string | null, scopeOrg: string | null) {
  const a = await acting();
  if (!a) return { error: "Sign in first." } as const;
  const subject = parseKey(pieceKey);
  const owner = ownerFor(a, identityId, scopeOrg);
  if (!subject || !owner) return { error: "That plan is not yours." } as const;
  if (!(await mayTouch(a, subject, "plan"))) return { error: "That piece is not yours." } as const;
  return { a, subject, owner } as const;
}

export async function startPlanAction(pieceKey: string, identityId: string | null, scopeOrg: string | null): Promise<ChannelResult> {
  try {
    const t = await planTarget(pieceKey, identityId, scopeOrg);
    if ("error" in t) return { ok: false, error: t.error! };
    await ensureChannelPlan(t.owner, t.subject, t.a.actor);
    done();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

/** Whole-body save, made from the copy last read (`expectedUpdatedAt`): a newer copy refuses it. */
export async function savePlanAction(pieceKey: string, identityId: string | null, scopeOrg: string | null, bodyMd: string, expectedUpdatedAt: string | null): Promise<ChannelResult> {
  try {
    const t = await planTarget(pieceKey, identityId, scopeOrg);
    if ("error" in t) return { ok: false, error: t.error! };
    await saveChannelPlan(t.owner, t.subject, String(bodyMd ?? "").slice(0, 40_000), t.a.actor, expectedUpdatedAt);
    done();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function setPlanStepAction(pieceKey: string, identityId: string | null, scopeOrg: string | null, index: number, isDone: boolean, stepText: string | null): Promise<ChannelResult> {
  try {
    const t = await planTarget(pieceKey, identityId, scopeOrg);
    if ("error" in t) return { ok: false, error: t.error! };
    if (!Number.isInteger(index) || index < 0) return { ok: false, error: "No such step." };
    await setChannelPlanStep(t.owner, t.subject, index, Boolean(isDone), t.a.actor, typeof stepText === "string" ? stepText : null);
    done();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

// ── to-dos ──────────────────────────────────────────────────────────────────

export async function addTodoAction(input: { text: string; date: string | null; pieceKey?: string | null; scopeOrg: string | null }): Promise<ChannelResult> {
  try {
    const a = await acting();
    if (!a) return { ok: false, error: "Sign in first." };
    const owner = ownerFor(a, null, input.scopeOrg);
    if (!owner) return { ok: false, error: "Not your channel." };
    const subject = input.pieceKey ? parseKey(input.pieceKey) : null;
    if (subject && !(await mayTouch(a, subject, "plan"))) return { ok: false, error: "That piece is not yours." };
    await addChannelTodo(owner, { text: input.text, date: input.date, subject }, a.actor);
    done();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function setTodoDoneAction(id: string, isDone: boolean, scopeOrg: string | null): Promise<ChannelResult> {
  try {
    const a = await acting();
    if (!a) return { ok: false, error: "Sign in first." };
    const owner = ownerFor(a, null, scopeOrg);
    if (!owner) return { ok: false, error: "Not your channel." };
    await setChannelTodoDone(owner, String(id).slice(0, 21), Boolean(isDone));
    done();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

// ── quick sheet ─────────────────────────────────────────────────────────────

export interface QuickSheetInput {
  pieceKey: string;
  identityId: string;
  scopeOrg: string | null;
  outlet: string;
  title: string;
  caption: string;
  quote: string | null;
  alsoFacebook: boolean;
  at: string | null;
  routineId: string | null;
  deliveryId: string | null;
  schedule: boolean;
}

/** Save the sheet as a draft, or schedule it. Instagram captions get links swapped for "link in bio". */
export async function saveQuickSheetAction(input: QuickSheetInput): Promise<ChannelResult<{ swapped: boolean }>> {
  try {
    const a = await acting();
    if (!a) return { ok: false, error: "Sign in first." };
    const subject = parseKey(input.pieceKey);
    const outlet = asOutlet(input.outlet);
    const owner = ownerFor(a, input.identityId, input.scopeOrg);
    if (!subject || !outlet || !owner) return { ok: false, error: "Not yours to schedule." };
    if (!(await mayTouch(a, subject, "deliver"))) return { ok: false, error: "That piece is not yours." };
    const identityId = identityOf(a, owner);
    const routineId = await ownRoutine(owner, input.routineId);
    let caption = String(input.caption ?? "").slice(0, INSTAGRAM_RULES.captionMax);
    let swapped = false;
    if (outlet === "instagram") ({ text: caption, swapped } = linkInBio(caption));
    if (input.schedule && !input.at) return { ok: false, error: "Choose when it goes out." };
    const payload = { title: String(input.title ?? "").slice(0, 200), text: caption, quote: input.quote ? String(input.quote).slice(0, 300) : null, alsoFacebook: Boolean(input.alsoFacebook), linkInBio: swapped };
    const status = input.schedule ? "scheduled" : "draft";
    if (input.deliveryId) {
      const r = await updateChannelDelivery(owner, input.deliveryId, { status, scheduledAt: input.at, payload });
      if (!r) return { ok: false, error: "That draft is gone." };
    } else {
      await createChannelDelivery(owner, { subject, outlet, status, identityId, scheduledAt: input.at, routineId, payload }, a.actor);
      await ensureChannelPlan(owner, subject, a.actor);
    }
    done();
    return { ok: true, swapped };
  } catch (err) {
    return failure(err);
  }
}

// ── New post ────────────────────────────────────────────────────────────────

export interface NewPostInput {
  postId: string | null;
  pieceKey: string | null;
  scopeOrg: string | null;
  title: string;
  body: string;
  link: string | null;
  images: Array<{ url: string; alt?: string | null }>;
  outlets: { site: boolean; instagram: boolean; facebook: boolean };
  overrides: { instagram?: string | null; facebook?: string | null };
}

/**
 * Save draft: a Studio post (social_posts), so the same draft opens in the
 * Studio's Post kind, where sending to Facebook and Instagram is reviewed.
 */
export async function saveNewPostAction(input: NewPostInput): Promise<ChannelResult<{ postId: string }>> {
  try {
    const a = await acting();
    if (!a) return { ok: false, error: "Sign in first." };
    if (input.scopeOrg && !a.orgIds.includes(input.scopeOrg)) return { ok: false, error: "You do not run that org's channel." };
    const orgId = input.scopeOrg ?? "oad";
    if (input.pieceKey) {
      const subject = parseKey(input.pieceKey);
      if (!subject || !(await mayTouch(a, subject, "deliver"))) return { ok: false, error: "That piece is not yours." };
    }
    const post = input.postId ? { id: input.postId } : await createSocialPost(a.userId, orgId);
    // Library media only: Instagram later fetches these, so no outside URL is accepted.
    const images = (input.images ?? []).filter((i) => typeof i.url === "string" && i.url.startsWith("/api/media/")).slice(0, 10);
    const saved = await updateSocialPost(a.userId, post.id, {
      title: String(input.title ?? "").slice(0, 200),
      body: String(input.body ?? "").slice(0, 63_000),
      link: input.link && /^https?:\/\//.test(input.link) ? input.link : null,
      images,
      variants: {
        ...(input.overrides.instagram ? { instagram: { text: input.overrides.instagram } } : {}),
        ...(input.overrides.facebook ? { facebook: { text: input.overrides.facebook } } : {}),
      },
    });
    if (!saved) return { ok: false, error: "That draft is not yours." };
    done();
    return { ok: true, postId: post.id };
  } catch (err) {
    return failure(err);
  }
}

export interface DryRunStep {
  order: number;
  outlet: "site" | "instagram" | "facebook";
  account: string;
  text: string;
  notes: string[];
}

/**
 * Publish (dry run): the exact order and text each outlet would get, with the
 * outlet rules applied. Sends nothing. Site first, then Instagram, then
 * Facebook (its link preview reads the site page).
 */
export async function dryRunPublishAction(input: NewPostInput & { accounts: { instagram: string | null; facebook: string | null; site: string | null } }): Promise<ChannelResult<{ steps: DryRunStep[]; live: boolean }>> {
  try {
  const a = await acting();
  if (!a) return { ok: false, error: "Sign in first." };
  const outlets = input.outlets ?? { site: false, instagram: false, facebook: false };
  const overrides = input.overrides ?? {};
  input = { ...input, outlets, overrides, body: String(input.body ?? ""), title: String(input.title ?? "") };
  const steps: DryRunStep[] = [];
  const shared = `${input.title ? `${input.title}\n\n` : ""}${input.body}`.trim();
  if (input.outlets.site && !input.pieceKey) steps.push({ order: 1, outlet: "site", account: input.accounts.site ?? "Your page", text: shared, notes: ["Goes up with the first post that succeeds (the Studio's mirror), on your page or the org's feed."] });
  if (input.outlets.instagram) {
    const base = input.overrides.instagram || shared;
    const { text, swapped } = linkInBio(base);
    const notes = [INSTAGRAM_RULES.jpegNote, "Two steps: a container is made, then published once it is ready."];
    if (swapped) notes.unshift("Link replaced with “link in bio”.");
    if (!input.images?.length) notes.unshift("Instagram needs a picture; this post has none.");
    if (text.length > INSTAGRAM_RULES.captionMax) notes.unshift(`Caption is ${text.length} characters; the limit is ${INSTAGRAM_RULES.captionMax}.`);
    steps.push({ order: 2, outlet: "instagram", account: input.accounts.instagram ?? "Instagram", text, notes });
  }
  if (input.outlets.facebook) {
    const text = input.overrides.facebook || shared;
    steps.push({ order: 3, outlet: "facebook", account: input.accounts.facebook ?? "Facebook", text, notes: input.link ? ["After the site: the link preview is read from the published page."] : [] });
  }
  return { ok: true, steps, live: process.env.CHANNEL_PUBLISH === "live" };
  } catch (err) {
    return failure(err);
  }
}

// ── routines ────────────────────────────────────────────────────────────────

export async function addRoutineAction(input: { name: string; outlet: string; cadence: RoutineCadence; scopeOrg: string | null }): Promise<ChannelResult> {
  try {
    const a = await acting();
    if (!a) return { ok: false, error: "Sign in first." };
    const owner = ownerFor(a, null, input.scopeOrg);
    if (!owner) return { ok: false, error: "Not your channel." };
    await createChannelRoutine(owner, { name: input.name, outlet: input.outlet, cadence: input.cadence }, a.actor);
    done();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

// ── New post: real publishing (owner's go-ahead, 2026-11-07) ────────────────

export interface PublishTarget {
  id: string;
  outlet: "facebook" | "instagram" | "threads";
  label: string;
  /** Why this account cannot take the post; null when it can. */
  disabledReason: string | null;
}

/**
 * The accounts this post can go out through: the person's own connections
 * (the Studio's listShareTargets). In an org's channel only the org's own
 * channels (org_channels) are offered, as publishSocialPost requires.
 */
export async function listPublishTargetsAction(scopeOrg: string | null): Promise<ChannelResult<{ targets: PublishTarget[] }>> {
  try {
    const a = await acting();
    if (!a) return { ok: false, error: "Sign in first." };
    if (scopeOrg && !a.orgIds.includes(scopeOrg)) return { ok: false, error: "You do not run that org's channel." };
    const [raw, connections] = await Promise.all([listShareTargets(), scopeOrg ? listConnections(a.userId) : Promise.resolve([])]);
    const targets: PublishTarget[] = [];
    for (const t of raw) {
      const outlet = t.kind === "page" ? "facebook" : t.kind;
      let disabledReason = t.disabledReason ?? (t.id.endsWith(":none") ? "No Page chosen on this connection." : null);
      if (scopeOrg && !disabledReason) {
        const [connectionId, kind, pageId] = t.id.split(":");
        const provider = kind === "page" || kind === "instagram" ? "meta" : kind === "iglogin" ? "instagram" : "threads";
        const external = kind === "page" || kind === "instagram" ? pageId ?? "" : connections.find((c) => c.id === connectionId)?.accountId ?? "";
        if (!(await isOrgChannel(scopeOrg, provider, external))) disabledReason = "Not one of this org's channels. An owner or guide sets them in Connections.";
      }
      targets.push({ id: t.id, outlet, label: t.label, disabledReason });
    }
    return { ok: true, targets };
  } catch (err) {
    return failure(err);
  }
}

export interface PublishResult {
  targetId: string;
  label: string;
  ok: boolean;
  url: string | null;
  error: string | null;
}

/**
 * Publish (real): save the post with each outlet's exact text, then send it
 * to each confirmed account in order: Instagram, Facebook, Threads. The first
 * that succeeds also puts the post on the site (the Studio's mirror: the
 * person's page for "Just me", else the org's feed), so Facebook's link
 * preview reads a page that exists. Each account is tried even if an earlier
 * one failed; every attempt is a publish_jobs row.
 */
export async function publishNewPostAction(input: NewPostInput & { targetIds: string[] }): Promise<ChannelResult<{ postId: string; results: PublishResult[] }>> {
  try {
    const a = await acting();
    if (!a) return { ok: false, error: "Sign in first." };
    const ids = [...new Set((input.targetIds ?? []).map(String))].slice(0, 6);
    if (ids.length === 0) return { ok: false, error: "Choose at least one account." };
    const listed = await listPublishTargetsAction(input.scopeOrg);
    if (listed.ok === false) return listed;
    const chosen = ids.map((id) => listed.targets.find((t) => t.id === id)).filter((t): t is PublishTarget => Boolean(t));
    const refused = chosen.find((t) => t.disabledReason);
    if (chosen.length !== ids.length || refused) return { ok: false, error: refused ? `${refused.label}: ${refused.disabledReason}` : "One of those accounts is not yours." };

    const shared = `${input.title ? `${input.title}\n\n` : ""}${input.body ?? ""}`.trim();
    const saved = await saveNewPostAction({
      ...input,
      overrides: {
        // Instagram links are not clickable: the caption says "link in bio" instead
        // (post-actions then leaves the URL off the caption).
        instagram: linkInBio(input.overrides?.instagram || shared).text,
        facebook: input.overrides?.facebook || shared,
      },
    });
    if (saved.ok === false) return saved;
    if (chosen.some((t) => t.outlet === "threads")) {
      await updateSocialPost(a.userId, saved.postId, { variants: { instagram: { text: linkInBio(input.overrides?.instagram || shared).text }, facebook: { text: input.overrides?.facebook || shared }, threads: { text: shared.slice(0, 500) } } });
    }

    const order: Record<PublishTarget["outlet"], number> = { instagram: 0, facebook: 1, threads: 2 };
    const results: PublishResult[] = [];
    // A retry after a partial failure sends only to the accounts that have not
    // taken this post yet: publishSocialPost itself does not check.
    const already = new Map(((await getSocialPost(a.userId, saved.postId))?.shares ?? []).map((sh) => [sh.targetId, sh.url ?? null]));
    for (const t of [...chosen].sort((x, y) => order[x.outlet] - order[y.outlet])) {
      if (already.has(t.id)) {
        results.push({ targetId: t.id, label: `${t.label} (already posted)`, ok: true, url: already.get(t.id) ?? null, error: null });
        continue;
      }
      // About a piece with its own page: the socials link to that page, and no
      // second copy goes on the feed (owner, 2026-11-07).
      const r = await publishSocialPost(saved.postId, t.id, { mirror: !input.pieceKey });
      results.push(
        r.ok === false
          ? { targetId: t.id, label: t.label, ok: false, url: null, error: r.error }
          : { targetId: t.id, label: t.label, ok: true, url: (r as { value: { url: string | null } }).value.url ?? null, error: null }
      );
    }
    done();
    return { ok: true, postId: saved.postId, results };
  } catch (err) {
    return failure(err);
  }
}

// ── the routines planner (2026-11-07) ───────────────────────────────────────

export async function updateRoutineAction(input: { id: string; scopeOrg: string | null; name?: string; outlet?: string; cadence?: RoutineCadence }): Promise<ChannelResult> {
  try {
    const a = await acting();
    if (!a) return { ok: false, error: "Sign in first." };
    const owner = ownerFor(a, null, input.scopeOrg);
    if (!owner) return { ok: false, error: "Not your channel." };
    const r = await updateChannelRoutine(owner, String(input.id).slice(0, 21), { name: input.name, outlet: input.outlet, cadence: input.cadence });
    if (!r) return { ok: false, error: "That routine is gone." };
    done();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function archiveRoutineAction(id: string, scopeOrg: string | null): Promise<ChannelResult> {
  try {
    const a = await acting();
    if (!a) return { ok: false, error: "Sign in first." };
    const owner = ownerFor(a, null, scopeOrg);
    if (!owner) return { ok: false, error: "Not your channel." };
    await archiveChannelRoutine(owner, String(id).slice(0, 21));
    done();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export interface Adjustment {
  /** When it goes: an ISO instant, or null to leave it unplaced (the tray). */
  at?: string | null;
  /** Where: another outlet than the one suggested. */
  outlet?: string;
  /** Starred: important, so it leads the ribbon and the dock (owner, 2026-11-07: a star). */
  important?: boolean;
  /** The initial idea, in the person's words. */
  note?: string;
}

/**
 * Accept a suggestion as adjusted when it was presented (the planner): its
 * time, outlet, importance and the person's idea. Same rules as Accept:
 * a draft delivery and a plan step; nothing is scheduled or sent.
 */
export async function acceptAdjustedAction(s: SuggestionInput, adj: Adjustment): Promise<ChannelResult> {
  try {
    const a = await acting();
    if (!a) return { ok: false, error: "Sign in first." };
    const subject = parseKey(s.pieceKey);
    const outlet = asOutlet(adj.outlet ?? s.outlet);
    const owner = ownerFor(a, s.identityId, s.scopeOrg);
    if (!subject || !outlet || !owner) return { ok: false, error: "That suggestion is not yours to accept." };
    if (!(await mayTouch(a, subject, "deliver"))) return { ok: false, error: "That piece is not yours." };
    const identityId = identityOf(a, owner);
    if (await findOpenChannelDelivery(owner, subject, outlet, identityId)) return { ok: false, error: "That is already on your queue." };
    const at = adj.at === undefined ? (s.at && !Number.isNaN(Date.parse(s.at)) ? new Date(s.at).toISOString() : null) : adj.at && !Number.isNaN(Date.parse(adj.at)) ? new Date(adj.at).toISOString() : null;
    const important = adj.important === true;
    const note = adj.note ? String(adj.note).replace(/\s+/g, " ").trim().slice(0, 300) : null;
    const text = String(s.text ?? "").slice(0, 200);
    // The routine slot only stays attached when the step stays in that slot's outlet.
    const routineId = outlet === s.outlet ? await ownRoutine(owner, s.routineId) : null;
    await createChannelDelivery(owner, { subject, outlet, status: "draft", identityId, scheduledAt: at, routineId, payload: { suggestion: text, title: text, important, note } }, a.actor);
    await addChannelPlanStep(owner, subject, { text: note ? `${text} (${note})` : text, fromBoard: true, on: at ? at.slice(0, 10) : null }, a.actor);
    done();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

/** "Never suggest this": an outlet for a kind of piece, for this channel's owner (migration 255). */
export async function neverSuggestAction(input: { outlet: string | null; pieceKind: string | null; identityId: string | null; scopeOrg: string | null }): Promise<ChannelResult> {
  try {
    const a = await acting();
    if (!a) return { ok: false, error: "Sign in first." };
    const owner = ownerFor(a, input.identityId, input.scopeOrg);
    if (!owner) return { ok: false, error: "Not your channel." };
    const outlet = input.outlet ? asOutlet(input.outlet) : null;
    // An unknown outlet is refused, never widened to "any outlet".
    if (input.outlet && !outlet) return { ok: false, error: "Unknown outlet." };
    await addChannelRule(owner, { outlet, pieceKind: input.pieceKind }, a.actor);
    done();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

