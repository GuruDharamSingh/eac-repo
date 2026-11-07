import type { CardRecord, FeaturedWho, Opened } from "@elkdonis/blocks";
import type { RecordSources } from "@elkdonis/direct-edit/puck";
import { opensChoicesAction, opensDrawAction, opensSourcesAction, personChoicesAction, personSourcesAction, personWhoAction } from "@/lib/featured-person-actions";

/**
 * "From what?" on Para Theater (2026-11-07, as on elktours), for the canvas editor, its popup and Puck Studio:
 * - `person`: a Featured person — this site's people, or someone stored on one of its gatherings or series;
 * - `opens`: where a Button, Card or Featured person's name goes — a page, or a popup of a gathering, series, piece or person;
 * - `record`: what a Card is filled from — a gathering, a series or a piece of writing.
 */
const TITLES: Record<string, string> = { person: "Featured person", opens: "Opens", record: "Filled from" };

export const records: RecordSources = {
  handles: (binds) => binds === "person" || binds === "opens" || binds === "record",
  title: (binds) => TITLES[binds] ?? "Choose",
  clearLabel: (binds) => (binds === "person" ? "Show no one (clear the choice)" : binds === "opens" ? "Open nothing (use the typed link)" : "Fill from nothing (typed fields only)"),
  sources: (binds) => (binds === "person" ? personSourcesAction() : opensSourcesAction(binds)),
  choices: (binds, source) => (binds === "person" ? personChoicesAction(source) : opensChoicesAction(binds, source)),
  async resolve(binds, value) {
    if (binds !== "person") return opensDrawAction(binds, value);
    const who = await personWhoAction(value);
    return who ? { who } : null;
  },
  describe(binds, value, drawn) {
    if (binds === "opens") {
      const o = drawn?.opened as Opened | undefined;
      return o ? `${o.label ?? o.href}. Replaces the typed link.` : "Not shown: that page or record is not public, or is gone.";
    }
    if (binds === "record") {
      const r = drawn?.bound as CardRecord | undefined;
      return r ? `${r.kind}: ${r.title}. Fields you leave empty follow it.` : "Not shown: that gathering, series or piece is not public, or is gone.";
    }
    const who = drawn?.who as FeaturedWho | undefined;
    const follows = value.startsWith("thread:");
    if (!who) return follows ? "Follows a gathering or series. No one to show today, so visitors see nothing." : "Not shown: this person has no public profile here.";
    if (!follows) return who.displayName;
    const role = [who.via?.label, who.via?.at].filter(Boolean).join(", ");
    return `${who.displayName} today (${role}). Follows “${who.via?.thread ?? "the record"}”, so it changes when that does.`;
  },
};
