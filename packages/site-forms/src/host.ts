import type { FormActions, FormHost, FormKindId } from "@elkdonis/studio-forms";
import type { BlocksSlot, BodySlot, MaterialsSlot, MediaSlot } from "@elkdonis/studio-forms";
import type { HostItemRef, StudioLinkRequest } from "@elkdonis/utils/host";
import { setStudioBackParams } from "@elkdonis/utils/studio-back";

/** The kinds a site binds; each needs the FormActions its own server file builds (studio-forms adapters). */
export interface SiteKindBinding {
  actions: FormActions;
}

export interface SiteFormSite {
  orgId: string;
  orgName: string;
  timeZone: string;
  /** "Goes on". */
  feeds: Array<{ slug: string; name: string }>;
  kinds: Partial<Record<FormKindId, SiteKindBinding>>;
  /**
   * The arts-collective Studio, for "More options in Studio". `carry` passes the sign-in over (sunjay:
   * `/api/auth/handoff?to=<url>`); `back` returns to this site (default: the current page, read when the link is built).
   */
  network?: {
    origin: string;
    carry?: (url: string) => string;
    backLabel?: string;
  };
  /** Replaces the network Studio link entirely. */
  studioHref?: (o: StudioLinkRequest) => string;
  /** The site's own page for an item. Default: the record's `href`. */
  viewHref?: (ref: HostItemRef) => string | null;
  loginHref?: (next: string) => string;
  /**
   * Widgets the site bundles. `media` is the picker; `body` the toolbar editor (norm tier only);
   * `blocks` the essay Canvas, left unset unless the site mounts it (then it also imports studio-forms/canvas.css).
   * Unset slots fall back to the surface connectors' composeSlots (media, body).
   */
  slots?: { media?: MediaSlot; body?: BodySlot; blocks?: BlocksSlot };
  /**
   * Who can see a NEW item until the person picks (2026-11-14): a site that is private by default
   * (innergathering) passes 'members'. Also offers "Members only" in Who can see it. Unset: Public.
   * An item being edited keeps what it has.
   */
  defaultAudience?: "everyone" | "followers" | "members";
  /**
   * Files a post can carry (2026-11-14): the site's upload (its /api/upload, answering with the media row).
   * Set, the post form shows a Materials row; the save attaches them (services attachMaterials).
   */
  materials?: MaterialsSlot;
  /** Meeting-form rows only some sites have. `cycleBadge`: innergathering's "Confirmed / Not yet confirmed" badge. */
  meetingOptions?: { cycleBadge?: boolean };
}

/** A default audience as the form's answers (thread-audience.ts audienceToStorage). */
export function audienceAnswers(a: SiteFormSite["defaultAudience"]): Record<string, unknown> {
  if (a === "members") return { visibility: "INVITE_ONLY", min_role: "member" };
  if (a === "followers") return { visibility: "ORGANIZATION", min_role: null };
  if (a === "everyone") return { visibility: "PUBLIC", min_role: null };
  return {};
}

// The Studio's `?kind=` for each form. Event, series and workshop have no Studio form: "" opens the Studio itself.
const STUDIO_KIND: Partial<Record<FormKindId, string>> = {
  post: "",
  meeting: "meeting",
  event: "",
  series: "",
  workshop: "",
  artwork: "artwork-form",
  service: "service-form",
};

/** Builds the FormHost from the site's own data. No blocks slot unless the site passes one. */
export function makeFormHost(site: SiteFormSite, fallbackSlots?: SiteFormSite["slots"]): FormHost {
  const actions: FormHost["actions"] = {};
  for (const [k, v] of Object.entries(site.kinds)) if (v) actions[k as FormKindId] = v.actions;
  const slots = { ...(fallbackSlots ?? {}), ...(site.slots ?? {}), ...(site.materials ? { materials: site.materials } : {}) };
  const studioHref =
    site.studioHref ??
    ((o: StudioLinkRequest) => {
      if (!site.network) return "#";
      const q = new URLSearchParams();
      const kind = STUDIO_KIND[o.kind as FormKindId] ?? o.kind;
      if (kind) q.set("kind", kind);
      if (o.id) q.set("id", o.id);
      q.set("org", site.orgId);
      if (o.preset) q.set("preset", o.preset);
      if (o.focus) q.set("focus", "1");
      // Built on click or render in the browser; the Studio checks `back` against its allowed hosts.
      const here = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : null;
      setStudioBackParams(q, { back: here, backLabel: site.network.backLabel ?? site.orgName });
      const url = `${site.network.origin}/studio?${q.toString()}`;
      return site.network.carry ? site.network.carry(url) : url;
    });
  return {
    studioHref,
    viewHref: site.viewHref ?? ((ref) => ref.href ?? null),
    loginHref: site.loginHref ?? ((next) => `/login?next=${encodeURIComponent(next)}`),
    preview: {},
    feeds: site.feeds,
    actions,
    slots: Object.keys(slots).length ? slots : undefined,
  };
}
