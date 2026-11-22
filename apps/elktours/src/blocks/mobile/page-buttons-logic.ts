import { allows, type ViewerLike } from "@/lib/puck/viewer-rank";

// ============================================================================
// m-page-buttons (2026-11-21): the group of buttons at the foot of the phone landing. Pure logic, no imports beyond
// the rank table: the block, its server resolver, the editor's action and the checks share it.
// ============================================================================

export type ButtonLook = "row" | "pill" | "catalogue";
export interface ButtonRow {
  label?: string;
  to?: string;
  look?: string;
  width?: string;
  who?: string;
  kicker?: string;
  meta?: string;
  /** A second form for signed-in people of a role (the office button): when `swapWho` includes the viewer, label and link change. */
  swapWho?: string;
  swapLabel?: string;
  swapTo?: string;
  /** A third form, for a higher role. The last form that includes the viewer wins. */
  swap2Who?: string;
  swap2Label?: string;
  swap2To?: string;
}
/** What the resolver returns and the block draws. `note` is set only for an editor (who the button is for); never for a visitor. */
export interface ShownButton { label: string; to: string; look: ButtonLook; width: "full" | "half"; kicker: string; meta: string; note?: string }

/** The three buttons the phone landing drew before this block existed: the places catalogue, the forum, and log in / account / the office. */
export const DEFAULT_BUTTONS: ButtonRow[] = [
  { label: "Every stop, gallery and table", to: "/places", look: "catalogue", width: "full", who: "everyone", kicker: "The places catalogue", meta: "{count} places the guides know well" },
  { label: "Elkdonis Forum", to: "/forum", look: "row", width: "half", who: "everyone" },
  { label: "Log in", to: "/login", look: "pill", width: "half", who: "everyone", swapWho: "signed-in", swapLabel: "{name}", swapTo: "/account", swap2Who: "guide", swap2Label: "The Office", swap2To: "/manage" },
];

/** A link a button may carry: a path on this site, an https address or a mailto. Anything else is dropped (the button is not drawn). */
export function safeHref(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^\/(?!\/)[^\s]*$/.test(s)) return s;
  if (/^https:\/\/[^\s]+$/i.test(s)) return s;
  if (/^mailto:[^\s]+$/i.test(s)) return s;
  return null;
}

const oneOf = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (typeof v === "string" && (ok as readonly string[]).includes(v) ? (v as T) : d);
const WHO_WORDS: Record<string, string> = { everyone: "everyone", "signed-out": "signed-out visitors", "signed-in": "signed-in people", member: "members and above", guide: "guides and above", owner: "owners" };

export interface ResolveEnv {
  viewer: ViewerLike | null;
  /** The public places count, for {count}. */
  count: number | null;
  /** {name} falls back to this when the person has no name on file. */
  accountLabel: string;
  /** An editor sees every button, tagged with who it is for. */
  all?: boolean;
}

const fill = (s: string, env: ResolveEnv) =>
  s.replace(/\{count\}/g, env.count == null ? "" : String(env.count)).replace(/\{name\}/g, env.viewer?.name || env.accountLabel).trim();

/** The buttons this viewer may see, in order, with the form that applies to them. Visitors get nothing they may not see: no row, no label, no link. */
export function buttonsFor(rows: unknown, env: ResolveEnv): ShownButton[] {
  const list = Array.isArray(rows) && rows.length > 0 ? (rows as ButtonRow[]) : DEFAULT_BUTTONS;
  const out: ShownButton[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const seen = env.all || allows(raw.who, env.viewer);
    if (!seen) continue;
    let label = String(raw.label ?? ""), to = raw.to;
    // The second and third forms: a form applies when its audience includes the viewer; the last one that does wins.
    if (raw.swapWho && raw.swapWho !== "none" && allows(raw.swapWho, env.viewer) && !env.all) { label = String(raw.swapLabel || label); to = raw.swapTo || to; }
    if (raw.swap2Who && raw.swap2Who !== "none" && allows(raw.swap2Who, env.viewer) && !env.all) { label = String(raw.swap2Label || label); to = raw.swap2To || to; }
    const href = safeHref(to);
    label = fill(label, env);
    if (!href || !label) continue;
    const note = env.all
      ? `For ${WHO_WORDS[String(raw.who ?? "everyone")] ?? "nobody (unknown audience)"}${raw.swapWho && raw.swapWho !== "none" ? `; "${fill(String(raw.swapLabel ?? ""), env)}" for ${WHO_WORDS[raw.swapWho] ?? "?"}` : ""}${raw.swap2Who && raw.swap2Who !== "none" ? `; "${fill(String(raw.swap2Label ?? ""), env)}" for ${WHO_WORDS[raw.swap2Who] ?? "?"}` : ""}`
      : undefined;
    out.push({
      label,
      to: href,
      look: oneOf(raw.look, ["row", "pill", "catalogue"] as const, "row"),
      width: oneOf(raw.width, ["full", "half"] as const, "full"),
      kicker: fill(String(raw.kicker ?? ""), env),
      meta: fill(String(raw.meta ?? ""), env),
      ...(note ? { note } : {}),
    });
  }
  return out;
}
