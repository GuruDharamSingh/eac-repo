import type { CardRecord, FeaturedWho, Opened } from "@elkdonis/blocks";
import type { RecordChoice, RecordSourceItem, RecordSources } from "@elkdonis/direct-edit/puck";
import { opensChoicesAction, opensDrawAction, opensSourcesAction, personChoicesAction, personSourcesAction, personWhoAction } from "@/lib/featured-person-actions";
import { serviceChoicesAction, serviceDrawAction, serviceSourcesAction } from "@/lib/puck/service-actions";
import { pieceChoicesAction, pieceDrawAction, pieceSourcesAction } from "@/lib/puck/writing-actions";
import { gatheringChoicesAction, gatheringDrawAction, gatheringSourcesAction } from "@/lib/puck/gathering-actions";
import { guideChoicesAction, guideDrawAction, guideSourcesAction } from "@/lib/puck/profile-actions";
import type { WireService } from "@/blocks/service-sample";
import type { WirePost } from "@/blocks/writing-sample";

/**
 * "From what?" on Para Theater (2026-11-07, as on elktours), for the canvas editor, its popup and Puck Studio. One row
 * per kind a block prop may bind (`binds: "<kind>"`); values are what the block stores, and what they draw is never
 * stored (the editor caches it beside the document).
 * - `person`: a Featured person — this site's people, or someone stored on one of its gatherings or series;
 * - `opens`: where a Button, Card or Featured person's name goes — a page, or a popup of a gathering, series, piece or person;
 * - `record`: what a Card is filled from — a gathering, a series or a piece of writing;
 * - `service` (2026-11-14): which service "Service (one in full)" and "Book this service" show. The value is the
 *   service's slug, as Puck Studio's own service picker stores it; cleared, the page follows the visitor's
 *   `?service=…`, else the newest (lib/puck/data-service.ts).
 * - `piece` (2026-11-14): which piece of writing "Piece (article)" shows. The value is the piece's slug, as the field
 *   stored it before; cleared, the block draws the piece in the address (/journal/…), else the newest. On the
 *   journal-piece template the address always wins, so a choice there is what the editor previews.
 * - `guide` (2026-11-14): whose profile "Profile card" shows. Featured person's references; empty is the site's guide
 *   (an owner of this organisation, lib/puck/data-profile.ts), so the block needs no slug typed into it.
 * - `gathering` (2026-11-14): which gathering "Next gathering" shows (pt-standing, home-standing): the standing
 *   meeting, the next upcoming one, or one gathering (lib/puck/data-standing.ts). Every choice follows the calendar.
 */
interface Kind {
  title: string;
  clear: string;
  sources(): Promise<RecordSourceItem[]>;
  choices(source: string): Promise<RecordChoice[]>;
  resolve(value: string): Promise<Record<string, unknown> | null>;
  describe(value: string, drawn: Record<string, unknown> | null | undefined): string;
}

const when = (iso: unknown) => {
  const d = typeof iso === "string" || iso instanceof Date ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;
};

const KINDS: Record<string, Kind> = {
  person: {
    title: "Featured person",
    clear: "Show no one (clear the choice)",
    sources: () => personSourcesAction(),
    choices: (source) => personChoicesAction(source),
    async resolve(value) { const who = await personWhoAction(value); return who ? { who } : null; },
    describe(value, drawn) {
      const who = drawn?.who as FeaturedWho | undefined;
      const follows = value.startsWith("thread:");
      if (!who) return follows ? "Follows a gathering or series. No one to show today, so visitors see nothing." : "Not shown: this person has no public profile here.";
      if (!follows) return who.displayName;
      const role = [who.via?.label, who.via?.at].filter(Boolean).join(", ");
      return `${who.displayName} today (${role}). Follows “${who.via?.thread ?? "the record"}”, so it changes when that does.`;
    },
  },
  opens: {
    title: "Opens",
    clear: "Open nothing (use the typed link)",
    sources: () => opensSourcesAction("opens"),
    choices: (source) => opensChoicesAction("opens", source),
    resolve: (value) => opensDrawAction("opens", value),
    describe(_value, drawn) {
      const o = drawn?.opened as Opened | undefined;
      return o ? `${o.label ?? o.href}. Replaces the typed link.` : "Not shown: that page or record is not public, or is gone.";
    },
  },
  record: {
    title: "Filled from",
    clear: "Fill from nothing (typed fields only)",
    sources: () => opensSourcesAction("record"),
    choices: (source) => opensChoicesAction("record", source),
    resolve: (value) => opensDrawAction("record", value),
    describe(_value, drawn) {
      const r = drawn?.bound as CardRecord | undefined;
      return r ? `${r.kind}: ${r.title}. Fields you leave empty follow it.` : "Not shown: that gathering, series or piece is not public, or is gone.";
    },
  },
  service: {
    title: "Service",
    clear: "The visitor's choice (?service=…), else the newest",
    sources: () => serviceSourcesAction(),
    choices: (source) => serviceChoicesAction(source),
    resolve: (value) => serviceDrawAction(value),
    describe(value, drawn) {
      // undefined: not fetched in this session (a value stored before the editor opened); null: not one of ours.
      if (drawn === undefined) return `The service at “${value}”.`;
      const s = drawn?.chosen as WireService | undefined;
      return s
        ? `${s.title}${s.priceLabel ? ` · ${s.priceLabel}` : ""}. Always this one, whatever the visitor chose.`
        : `Not shown: “${value}” is not one of this site's services now, so visitors see the newest.`;
    },
  },
  piece: {
    title: "Piece",
    clear: "The piece in the address (/journal/…), else the newest",
    sources: () => pieceSourcesAction(),
    choices: (source) => pieceChoicesAction(source),
    resolve: (value) => pieceDrawAction(value),
    describe(value, drawn) {
      if (drawn === undefined) return `The piece at “${value}”.`;
      const post = drawn?.post as WirePost | undefined;
      return post
        ? `${post.title}${post.series ? ` (${post.series})` : ""}. Shown wherever this block sits; on a piece's own page, that piece.`
        : `Not shown: “${value}” is not shown on this site now, so the block draws nothing.`;
    },
  },
  guide: {
    title: "Whose profile",
    clear: "The site's guide (an owner of this organisation)",
    sources: () => guideSourcesAction(),
    choices: (source) => guideChoicesAction(source),
    resolve: (value) => guideDrawAction(value),
    describe(value, drawn) {
      const g = drawn?.guide as { displayName?: string; roleTitle?: string | null } | null | undefined;
      const follows = value.startsWith("thread:");
      if (drawn === undefined) return follows ? "Whoever that gathering names today." : "The person chosen.";
      if (!g) return follows ? "Follows a gathering or series. No one to show today, so the card says there is no profile." : "Not shown: this person has no public profile here.";
      return `${g.displayName}${g.roleTitle ? `, ${g.roleTitle}` : ""}.${follows ? " Follows the gathering, so it changes when that does." : " Always this person."}`;
    },
  },
  gathering: {
    title: "Which gathering",
    clear: "The standing meeting (as before)",
    sources: () => gatheringSourcesAction(),
    choices: (source) => gatheringChoicesAction(source),
    resolve: (value) => gatheringDrawAction(value),
    describe(value, drawn) {
      const which = value === "next" ? "The next upcoming gathering" : value.startsWith("thread:") ? "This gathering" : "The standing meeting";
      if (drawn === undefined) return `${which}.`;
      const s = drawn?.standing as { event?: { title?: string }; at?: unknown } | null | undefined;
      if (!s?.event) return `${which}: nothing scheduled in the next three months, so the card says so.`;
      const at = when(s.at);
      return `${which}: now ${s.event.title}${at ? `, ${at}` : ""}. Follows the calendar.`;
    },
  },
};

const kind = (binds: string): Kind | undefined => (Object.prototype.hasOwnProperty.call(KINDS, binds) ? KINDS[binds] : undefined);

export const records: RecordSources = {
  handles: (binds) => Boolean(kind(binds)),
  title: (binds) => kind(binds)?.title ?? "Choose",
  clearLabel: (binds) => kind(binds)?.clear ?? "Clear the choice",
  sources: (binds) => kind(binds)?.sources() ?? Promise.resolve([]),
  choices: (binds, source) => kind(binds)?.choices(source) ?? Promise.resolve([]),
  resolve: (binds, value) => kind(binds)?.resolve(value) ?? Promise.resolve(null),
  describe: (binds, value, drawn) => kind(binds)?.describe(value, drawn) ?? value,
};
