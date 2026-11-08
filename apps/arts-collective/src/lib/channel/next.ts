import { parsePlan } from "@elkdonis/services/channel-plan-md";
import type { ChannelMoveKind, ChannelNextMove } from "@elkdonis/actions";
import { specFromSuggestion, type QuickSpec } from "@/components/channel/quick-spec";
import { outletLabel } from "@/components/channel/labels";
import { fmtDay, fmtTime, type ChannelModel, type Outlet, type Piece, type Suggestion } from "./model";

// ============================================================================
// Channel's next moves (2026-11-07): the top three to five things to do next on
// a channel's board, each with the registry entry that performs it. Derived
// from the /channel loader's model (load.ts) and nothing else, so Channel
// Home's next row (components/channel/NextRow.tsx), the dock's Channel part and
// the registry entry `channel-next` (through next-source.ts) read one list.
//
// Pure: no database, no server-only import. It runs wherever the model is: on
// the server for the dock and the HTTP door (next-source.ts), in the browser
// for NextRow, which reads the model Channel already hands its pages. Times
// come from `model.now` / `model.today`, never the clock, so both agree.
//
// Sources, in the model's own words:
//   pieces[].suggestions   gaps and follow-ups, placed in a routine slot, by a
//                          date, or not placed (accept: channel-suggestion-accept)
//   week.days[] slot       a routine slot this week with nothing in it
//   week.days[] post       placed Channel drafts (finish in the quick sheet) and
//                          scheduled lives
//   tray draft / note      drafts not placed yet; undated notes
//   pieces[].plan          unticked steps of the person's own in plan.md
//                          (channel-plan-step); steps "from the board" are left
//                          out, since their drafts already stand for them
//   week.days[] todo       today's and tomorrow's to-dos (setTodoDoneAction)
// Order: due today or overdue, then the next two days, then the rest of the
// week, then what has no date; within each, soonest first, then by kind; at
// most two moves per piece and one empty slot per routine.
// docs/open/CHANNEL_REGISTRY_AND_BOARD_2026-11-07.md.
// ============================================================================

/** A next move as Channel's pages use it: the registry's shape plus what opens it in place. */
export interface ChannelNext extends ChannelNextMove {
  /** For `open.kind === 'sheet'`: the quick sheet's input. */
  sheet: QuickSpec | null;
  /** A to-do the row ticks with setTodoDoneAction (to-dos have no registry entry yet). */
  todoId: string | null;
  /** Due today or overdue. */
  urgent: boolean;
  /** Starred when it was adjusted (owner, 2026-11-07: importance is a star). Leads the row. */
  important?: boolean;
}

export interface NextOptions {
  /** How many moves; default 4 (the row's four columns), at most 20. */
  limit?: number;
}

const KIND_ORDER: Record<ChannelMoveKind, number> = { setup: -1, live: 0, slot: 1, draft: 2, suggestion: 3, step: 4, todo: 5, gap: 6, "follow-up": 7, note: 8 };
/** Setup moves lead the row while they are open, at most this many at once. */
const SETUP_MAX = 2;
const SOCIAL = new Set<string>(["instagram", "facebook", "threads"]);
const PER_PIECE = 2;

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function zonedDay(at: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

interface Candidate {
  move: ChannelNext;
  bucket: number;
  sortAt: string;
  pieceIndex: number;
}

export function channelNextMoves(model: ChannelModel, opts: NextOptions = {}): ChannelNext[] {
  const limit = Math.max(1, Math.min(20, Math.floor(opts.limit ?? 4)));
  const tz = model.timeZone;
  const today = model.today;
  const scopeOrg = model.scope.kind === "org" ? model.scope.orgId : null;
  const ready = model.ready;
  const routines = new Map(model.routines.map((r) => [r.id, r]));
  const pieceIndex = new Map(model.pieces.map((p, i) => [p.key, i]));
  const byKey = new Map(model.pieces.map((p) => [p.key, p]));

  const link = (path: string, params: Record<string, string | null> = {}) => {
    const q = new URLSearchParams();
    if (scopeOrg) q.set("org", scopeOrg);
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    const s = q.toString();
    return `${path}${s ? `?${s}` : ""}`;
  };
  const pieceLink = (key: string, tab?: "plan") => link("/channel", { piece: key, tab: tab ?? null });
  /** " as Elkdonis Arts" for an org identity, as the loader words suggestions; "" for the person. */
  const asOrg = (identityId: string) => {
    if (scopeOrg) return ""; // an org's own channel has one name
    const idn = model.identities.find((i) => i.id === identityId);
    return idn && idn.kind === "org" ? ` as ${idn.shortName}` : "";
  };

  const dayOf = (at: string) => zonedDay(at, tz);
  const bucketOfDay = (day: string | null) => (!day ? 3 : day <= today ? 0 : day <= addDays(today, 2) ? 1 : day <= addDays(today, 7) ? 2 : 3);
  /** "Today", "Tomorrow", "Fri", or "Nov 21". */
  const when = (at: string) => {
    const d = dayOf(at);
    if (d === today) return "Today";
    if (d === addDays(today, 1)) return "Tomorrow";
    if (d > today && d <= addDays(today, 6)) return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(new Date(at));
    return fmtDay(at, tz);
  };

  const out: Candidate[] = [];
  const push = (move: Omit<ChannelNext, "urgent">, day: string | null, sortAt: string | null) => {
    const bucket = bucketOfDay(day);
    out.push({ move: { ...move, urgent: bucket === 0 && day !== null }, bucket, sortAt: sortAt ?? "", pieceIndex: move.pieceKey ? pieceIndex.get(move.pieceKey) ?? 9999 : 9999 });
  };
  const accept = (s: Suggestion): ChannelNext["run"] =>
    ready
      ? {
          id: "channel-suggestion-accept",
          input: { pieceKey: s.pieceKey, outlet: s.outlet, identityId: s.identityId, text: s.text, at: s.at, routineId: s.routineId },
          label: "Add to the queue",
          busyLabel: "Adding…",
        }
      : null;

  // ── suggestions: in a slot, by a date, or not placed ─────────────────────
  for (const p of model.pieces) {
    for (const s of p.suggestions) {
      const routine = s.routineId ? routines.get(s.routineId) : undefined;
      const kind: ChannelMoveKind = s.at ? (s.routineId ? "slot" : "suggestion") : SOCIAL.has(s.outlet) ? "gap" : "follow-up";
      const label = outletLabel(s.outlet);
      const kicker =
        kind === "slot" ? `${when(s.at!)} · ${routine?.name ?? label} slot` : kind === "suggestion" ? `${when(s.at!)} · ${label}` : kind === "gap" ? `Gap · ${label}` : `Follow-up · ${label}`;
      // Heavy making (a video, a long piece) belongs to the Studio; posts and letters to the quick sheet.
      const studio = s.outlet === "video" ? model.links.video : s.outlet === "writing" ? model.links.writing : null;
      // An unprompted gap reads as the tray does, "Field Notes is not on Facebook", with
      // the move as the button: "Share the shop link" (owner decision, 2026-11-07: "Gaps too").
      const gap = kind === "gap";
      push(
        {
          id: `sug:${s.id}`,
          kind,
          kicker,
          title: gap ? `${p.title} is not on ${label}${asOrg(s.identityId)}` : s.text,
          reason: gap ? p.inMotion?.reason ?? s.reason : s.reason,
          at: s.at,
          href: studio ?? pieceLink(p.key),
          run: accept(s),
          outlet: s.outlet,
          pieceKey: p.key,
          pieceTitle: p.title,
          identityId: s.identityId,
          open: studio
            ? { kind: "studio", label: s.outlet === "video" ? "Film it in the Studio" : "Write it in the Studio" }
            : { kind: "sheet", label: gap ? gapVerb(p, s) : "Write it now" },
          sheet: studio ? null : specFromSuggestion(s, p, routine?.name ?? null),
          todoId: null,
        },
        s.at ? dayOf(s.at) : null,
        s.at
      );
    }
  }

  // ── the week: empty slots, placed drafts, lives, to-dos ──────────────────
  const slotRoutines = new Set<string>();
  for (const d of model.week.days) {
    if (d.date < today) continue;
    for (const i of d.items) {
      if (i.type === "slot" && !i.suggestion) {
        if (slotRoutines.has(i.routineId)) continue;
        slotRoutines.add(i.routineId);
        const fallback = model.pieces.find((p) => p.suggestions.some((s) => s.outlet === i.outlet)) ?? model.pieces[0];
        const studio = i.outlet === "video" ? model.links.video : i.outlet === "writing" ? model.links.writing : null;
        const live = i.outlet === "live";
        const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(new Date(i.at));
        const sheet: QuickSpec | null =
          !studio && !live && fallback
            ? { title: `${outletLabel(i.outlet)}: ${fallback.title}`, kicker: `Filling · ${i.routineName} slot`, pieceKey: fallback.key, outlet: i.outlet, identityId: fallback.ownerIdentityId, at: i.at, routineId: i.routineId, routineName: i.routineName }
            : null;
        push(
          {
            id: `slot:${i.routineId}:${d.date}`,
            kind: "slot",
            kicker: `${when(i.at)} · ${i.routineName} slot`,
            title: `Fill ${weekday}’s ${i.routineName} slot`,
            reason: `${i.cadence} · ${fmtTime(i.at, tz)}`,
            at: i.at,
            href: live && model.viewer.isAdmin ? model.links.live : studio ?? link("/channel/queue"),
            run: null,
            outlet: i.outlet,
            pieceKey: null,
            pieceTitle: null,
            identityId: null,
            open: sheet
              ? { kind: "sheet", label: "Choose a piece" }
              : studio
                ? { kind: "studio", label: i.outlet === "video" ? "Film it in the Studio" : "Write it in the Studio" }
                : live && model.viewer.isAdmin
                  ? { kind: "live", label: "Open the booth" }
                  : { kind: "queue", label: "Open the queue" },
            sheet,
            todoId: null,
          },
          d.date,
          i.at
        );
      } else if (i.type === "post" && i.deliveryId && (i.state === "draft" || i.state === "live")) {
        const p = i.pieceKey ? byKey.get(i.pieceKey) : undefined;
        const outlet = i.outlets[0] ?? null;
        if (i.state === "live") {
          // Live stays in the row for everyone; the booth itself is admin-only today, so others open the piece.
          const booth = model.viewer.isAdmin;
          push(
            {
              id: `live:${i.deliveryId}`,
              kind: "live",
              kicker: `Live · ${when(i.at)} ${fmtTime(i.at, tz)}`,
              title: i.title,
              reason: i.pieceTitle || null,
              at: i.at,
              href: booth ? model.links.live : p ? pieceLink(p.key) : link("/channel/queue"),
              run: null,
              outlet: "live",
              pieceKey: p?.key ?? null,
              pieceTitle: p?.title ?? null,
              identityId: null,
              open: booth ? { kind: "live", label: "Open the booth" } : p ? { kind: "piece", label: "Open the piece" } : { kind: "queue", label: "Open the queue" },
              sheet: null,
              todoId: null,
            },
            d.date,
            i.at
          );
          continue;
        }
        push(
          {
            id: `draft:${i.deliveryId}`,
            kind: "draft",
            important: Boolean(i.important),
            kicker: `${i.important ? "★ " : ""}Draft · ${outlet ? outletLabel(outlet) : "post"} · ${when(i.at)}`,
            title: i.title,
            reason: [i.pieceTitle, i.routineName ? `${i.routineName} routine` : null].filter(Boolean).join(" · ") || null,
            at: i.at,
            href: p ? pieceLink(p.key) : link("/channel/queue"),
            run: null,
            outlet,
            pieceKey: p?.key ?? null,
            pieceTitle: p?.title ?? null,
            identityId: p ? draftIdentity(p, i.deliveryId) : null,
            open: p && outlet ? { kind: "sheet", label: "Finish the draft" } : { kind: "queue", label: "Open the queue" },
            sheet: p && outlet ? draftSheet(p, i.deliveryId, outlet, i.title, i.at, i.routineName) : null,
            todoId: null,
          },
          d.date,
          i.at
        );
      } else if (i.type === "todo" && !i.done && (d.isToday || d.isTomorrow)) {
        push(
          {
            id: `todo:${i.id}`,
            kind: "todo",
            kicker: d.isToday ? "To-do · today" : "To-do · tomorrow",
            title: i.text,
            reason: null,
            at: null,
            href: link("/channel/queue"),
            run: null,
            outlet: null,
            pieceKey: null,
            pieceTitle: null,
            identityId: null,
            open: null,
            sheet: null,
            todoId: ready ? i.id : null,
          },
          d.date,
          `${d.date}T23:59:59Z`
        );
      }
    }
  }

  // ── the tray: drafts not placed, notes ───────────────────────────────────
  for (const t of model.tray) {
    if (t.type === "draft") {
      const p = t.pieceKey ? byKey.get(t.pieceKey) : undefined;
      push(
        {
          id: `draft:${t.deliveryId}`,
          kind: "draft",
          important: Boolean(t.important),
          kicker: `${t.important ? "★ " : ""}Draft · ${outletLabel(t.outlet)} · not placed`,
          title: t.title,
          reason: t.sub || null,
          at: null,
          href: p ? pieceLink(p.key) : link("/channel/queue"),
          run: null,
          outlet: t.outlet,
          pieceKey: p?.key ?? null,
          pieceTitle: p?.title ?? null,
          identityId: p ? draftIdentity(p, t.deliveryId) : null,
          open: p ? { kind: "sheet", label: "Place it" } : { kind: "queue", label: "Open the queue" },
          sheet: p ? draftSheet(p, t.deliveryId, t.outlet, t.title, null, null) : null,
          todoId: null,
        },
        null,
        null
      );
    } else if (t.type === "note") {
      push(
        {
          id: `note:${t.todoId}`,
          kind: "note",
          kicker: "Your note",
          title: t.title,
          reason: t.sub || null,
          at: null,
          href: model.links.writing,
          run: null,
          outlet: null,
          pieceKey: null,
          pieceTitle: null,
          identityId: null,
          open: { kind: "studio", label: "Start it in the Studio" },
          sheet: null,
          todoId: null,
        },
        null,
        null
      );
    }
  }

  // ── plan.md: the person's own unticked steps ─────────────────────────────
  for (const p of model.pieces) {
    if (!p.plan) continue;
    for (const s of parsePlan(p.plan.bodyMd).steps) {
      if (s.done || s.fromBoard) continue;
      const dueWord = s.on ? (s.on < today ? `was due ${fmtDay(`${s.on}T12:00:00Z`, "UTC")}` : s.on === today ? "due today" : `due ${fmtDay(`${s.on}T12:00:00Z`, "UTC")}`) : null;
      push(
        {
          id: `step:${p.key}:${s.index}`,
          kind: "step",
          kicker: dueWord ? `Plan step · ${dueWord}` : "Plan step",
          title: s.text,
          reason: p.title,
          at: s.on ? `${s.on}T12:00:00.000Z` : null,
          href: pieceLink(p.key, "plan"),
          run: ready
            ? { id: "channel-plan-step", input: { pieceKey: p.key, identityId: p.ownerIdentityId, op: "check", index: s.index, text: s.text }, label: "Mark done", busyLabel: "Saving…" }
            : null,
          outlet: null,
          pieceKey: p.key,
          pieceTitle: p.title,
          identityId: p.ownerIdentityId,
          open: { kind: "plan", label: "Open the plan" },
          sheet: null,
          todoId: null,
        },
        s.on,
        s.on
      );
    }
  }

  // ── order, then keep the row varied ──────────────────────────────────────
  out.sort(
    (a, b) =>
      a.bucket - b.bucket ||
      (a.bucket < 3 ? a.sortAt.localeCompare(b.sortAt) : 0) ||
      KIND_ORDER[a.move.kind] - KIND_ORDER[b.move.kind] ||
      a.pieceIndex - b.pieceIndex
  );
  // Starred steps first (a stable sort keeps the order above within each group).
  out.sort((a, b) => Number(Boolean(b.move.important)) - Number(Boolean(a.move.important)));
  const perPiece = new Map<string, number>();
  const seen = new Set<string>();
  const moves: ChannelNext[] = setupMoves(model, link).slice(0, SETUP_MAX).slice(0, limit);
  for (const c of out) {
    if (moves.length >= limit) break;
    if (seen.has(c.move.id)) continue;
    const k = c.move.pieceKey;
    if (k && (perPiece.get(k) ?? 0) >= PER_PIECE) continue;
    seen.add(c.move.id);
    if (k) perPiece.set(k, (perPiece.get(k) ?? 0) + 1);
    moves.push(c.move);
  }
  return moves;
}

/** What a gap's button says: the shop link for work on sale, a quote card for words, else the plain verb. */
function gapVerb(p: Piece, s: Suggestion): string {
  if (s.chip.includes("Quote")) return "Make a quote card";
  const forSale = p.subject.kind === "artwork" && p.href;
  if (s.outlet === "instagram") return forSale ? "Post it, shop link in bio" : "Post it";
  return forSale ? "Share the shop link" : "Share it";
}

/** The identity a Channel draft was planned under (its timeline row), so the sheet updates the right owner's row. */
function draftIdentity(p: Piece, deliveryId: string): string {
  return p.timeline.find((e) => e.deliveryId === deliveryId)?.identityId ?? p.ownerIdentityId;
}

function draftSheet(p: Piece, deliveryId: string, outlet: Outlet, title: string, at: string | null, routineName: string | null): QuickSpec {
  return {
    title,
    kicker: routineName ? `Draft · ${routineName} slot` : `Draft · ${outletLabel(outlet)}`,
    pieceKey: p.key,
    outlet,
    identityId: draftIdentity(p, deliveryId),
    at,
    routineId: null,
    routineName,
    deliveryId,
  };
}

/**
 * Getting set up (owner, 2026-11-07: "setup moves in the next row"), for a new
 * org like Katie's or a new artist: what stands between them and a first post.
 * Each step drops out once the platform shows it done, as task steps do.
 * The same list feeds the dock (next-source.ts), so it shows there too.
 */
function setupMoves(model: ChannelModel, link: (path: string, params?: Record<string, string | null>) => string): ChannelNext[] {
  const scopeOrg = model.scope.kind === "org" ? model.scope.orgId : null;
  const orgName = model.scope.kind === "org" ? model.scope.name : null;
  const social = model.outlets.filter((o) => o.id === "instagram" || o.id === "facebook" || o.id === "threads");
  const connected = social.some((o) => o.connected);
  const orgHasChannel = scopeOrg ? social.some((o) => o.identityIds.includes(`org:${scopeOrg}`)) : true;
  const posted = model.pieces.some((p) => p.timeline.some((e) => SOCIAL.has(e.outlet) && e.state === "published"));
  const firstListed = model.pieces.find((p) => p.status !== "draft") ?? model.pieces[0];
  const mk = (id: string, kicker: string, title: string, reason: string, href: string | null, label: string, pieceKey: string | null = null): ChannelNext => ({
    id: `setup:${id}`,
    kind: "setup",
    kicker,
    title,
    reason,
    at: null,
    href,
    run: null,
    outlet: null,
    pieceKey,
    pieceTitle: pieceKey ? model.pieces.find((p) => p.key === pieceKey)?.title ?? null : null,
    identityId: scopeOrg ? `org:${scopeOrg}` : `user:${model.viewer.userId}`,
    open: href ? { kind: "queue", label } : null,
    sheet: null,
    todoId: null,
    urgent: false,
  });
  const out: ChannelNext[] = [];
  if (!connected)
    out.push(mk("connect", "Suggested", "Connect Instagram", "Posts go out through your own accounts. Connect once, from Outlets.", link("/channel/outlets", { tab: "instagram" }), "Open Outlets"));
  else if (!orgHasChannel)
    out.push(
      mk(
        "channel",
        "Suggested",
        `Make your Page ${orgName}'s channel`,
        `In ${orgName}'s channel, posts go only through its own channels. In Outlets, under Connect, choose “Channel for ${orgName}”.`,
        link("/channel/outlets", { tab: "facebook" }),
        "Open Outlets"
      )
    );
  if (model.pieces.length === 0)
    out.push(mk("piece", "Suggested", "Add your first piece", "Pieces you list show here with everywhere they went.", model.links.store ?? model.links.artwork, "Add a piece"));
  else if (!posted && firstListed)
    out.push(mk("first-post", "Suggested", `Post ${firstListed.title}`, "A first post: the piece, its picture and a link back to it. You check every account before it goes.", link("/channel/new", { about: firstListed.key }), "Open New post", firstListed.key));
  if (model.ready && model.routines.length === 0)
    out.push(mk("routine", "Suggested", "Add a routine", "A routine (Instagram on Tuesdays and Fridays, a letter on the 1st) opens slots that suggestions fill.", link("/channel/routines"), "Add one"));
  return out;
}

