import type { CardRecord, FeaturedWho, Opened } from "@elkdonis/blocks";
import type { RecordSources } from "@elkdonis/direct-edit/puck";
import { pickChoicesAction, pickDrawAction, pickSourcesAction } from "@/lib/puck/mobile-pick-actions";
import { PICK_KINDS } from "@/lib/puck/reference-kinds";
import { opensChoicesAction, opensDrawAction, opensSourcesAction, personChoicesAction, personSourcesAction, personWhoAction } from "@/lib/featured-person-actions";

/**
 * "From what?" on this site (2026-11-06), for the canvas editor, its popup and Puck Studio:
 * - `person`: a Featured person — this site's people, or someone stored on one of its tours or series;
 * - `opens`: where a Button, Card or Featured person's name goes — a page, or a popup (docs/open/COMPONENT_CONNECTIONS_2026-11-06.md);
 * - `record`: what a Card is filled from — a tour or an experience.
 */
const TITLES: Record<string, string> = { person: "Featured person", opens: "Opens", record: "Filled from" };

const PICK_TITLES: Record<string, string> = { place: "Place", "place-photo": "Cover picture", guide: "Guide", experience: "Experience", tour: "Tour" };

export const records: RecordSources = {
  handles: (binds) => binds === "person" || binds === "opens" || binds === "record" || PICK_KINDS.includes(binds),
  title: (binds) => TITLES[binds] ?? PICK_TITLES[binds] ?? "Choose",
  clearLabel: (binds) => PICK_KINDS.includes(binds) ? "Clear the choice" : (binds === "person" ? "Show no one (clear the choice)" : binds === "opens" ? "Open nothing (use the typed link)" : "Fill from nothing (typed fields only)"),
  sources: (binds) => (PICK_KINDS.includes(binds) ? pickSourcesAction(binds) : binds === "person" ? personSourcesAction() : opensSourcesAction(binds)),
  choices: (binds, source) => (PICK_KINDS.includes(binds) ? pickChoicesAction(binds, source) : binds === "person" ? personChoicesAction(source) : opensChoicesAction(binds, source)),
  async resolve(binds, value) {
    if (PICK_KINDS.includes(binds)) return pickDrawAction(binds, value);
    if (binds !== "person") return opensDrawAction(binds, value);
    const who = await personWhoAction(value);
    return who ? { who } : null;
  },
  describe(binds, value, drawn) {
    if (PICK_KINDS.includes(binds)) { const l = drawn?.label as string | undefined; return l ? l + "." : "Not shown: that is not public here, or is gone."; }
    if (binds === "opens") {
      const o = drawn?.opened as Opened | undefined;
      return o ? `${o.label ?? o.href}. Replaces the typed link.` : "Not shown: that page or record is not public, or is gone.";
    }
    if (binds === "record") {
      const r = drawn?.bound as CardRecord | undefined;
      return r ? `${r.kind}: ${r.title}. Fields you leave empty follow it.` : "Not shown: that tour or experience is not public, or is gone.";
    }
    const who = drawn?.who as FeaturedWho | undefined;
    const follows = value.startsWith("thread:");
    if (!who) return follows ? "Follows a tour or series. No one to show today, so visitors see nothing." : "Not shown: this person has no public profile here.";
    if (!follows) return who.displayName;
    const role = [who.via?.label, who.via?.at].filter(Boolean).join(", ");
    return `${who.displayName} today (${role}). Follows “${who.via?.thread ?? "the record"}”, so it changes when that does.`;
  },
};
