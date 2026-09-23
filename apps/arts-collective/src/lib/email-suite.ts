import "server-only";
import { db } from "@elkdonis/db";
import { getOrgRole, type OrgRole } from "@elkdonis/services";
import {
  getOrgEmailIdentity,
  listInbox,
  unreadCount,
  listAddressBook,
  recentActivity,
  deliveryStats,
  listOrgTemplates,
  inboundAddressFor,
  inboundEnabled,
  TEMPLATE_META,
  copySlotsFor,
  mergeFieldsFor,
  EMAIL_FONTS,
} from "@elkdonis/email";
import type { EmailSuiteData } from "@elkdonis/cms-ui/email";
import { getCurrentUser } from "@/lib/session";

// ============================================================================
// The email suite's server side, for the network hub.
//
// One loader and one guard, used by the page and by every route under
// /api/org/[slug]/email. The hub is MULTI-ORG — it shows whichever org the
// `?org=` switcher selected — so nothing here may read an org from a constant
// the way the single-tenant template apps do; every entry point takes a slug
// and re-derives the viewer's role in THAT org.
// ============================================================================

/** Who may send in an org's name, and read what comes back to it. */
const EDITOR_ROLES: OrgRole[] = ["owner", "guide"];

export interface EmailGuard {
  userId: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: OrgRole;
  canEdit: boolean;
}

/**
 * Resolve the org behind a slug and the viewer's standing in it.
 *
 * Returns null rather than throwing for every failure — not signed in, no such
 * org, not a member — because the caller turns all three into the same 404.
 * Distinguishing them in the response would tell a stranger which org slugs
 * exist and who is in them.
 */
export async function guardOrgEmail(slug: string): Promise<EmailGuard | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const [org] = await db<Array<{ id: string; name: string; slug: string }>>`
    SELECT id, name, slug FROM organizations WHERE slug = ${slug} LIMIT 1
  `;
  if (!org) return null;

  const role = await getOrgRole(user.id, org.id);
  if (!role) return null;

  return {
    userId: user.id,
    orgId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
    role,
    canEdit: EDITOR_ROLES.includes(role),
  };
}

/** A write. Same as the above but refuses anyone who cannot send. */
export async function guardOrgEmailWrite(slug: string): Promise<EmailGuard | null> {
  const guard = await guardOrgEmail(slug);
  return guard?.canEdit ? guard : null;
}

/**
 * Where this host's email pages live.
 *
 * Passed in rather than hardcoded, because they differ per host and getting
 * that wrong is not a typo — it is a dead link in a console. The first version
 * of this file hardcoded innergathering's `/hub/email/<key>` routes into the
 * arts-collective loader, and the Letters tab shipped with three 404s on every
 * row. A host that does not serve a route OMITS it, and the tab draws no link
 * at all rather than one that goes nowhere.
 */
export interface EmailSuiteRoutes {
  /** The full-page suite. */
  suite: string;
  /** The GrapesJS newsletter editor. */
  newsletter?: string;
  /** Write one letter's own words. `{key}` is substituted. */
  template?: string;
  /** Lay one letter out in the editor. `{key}` is substituted. */
  templateLayout?: string;
}

/**
 * Everything the suite draws, in one pass.
 *
 * Seven queries in parallel rather than seven connector round-trips on open:
 * every tab is a view of the same organisation, and splitting them would mean
 * the popup showed a spinner per tab for data that was one join away.
 */
export async function loadEmailSuite(
  guard: EmailGuard,
  routes: EmailSuiteRoutes
): Promise<EmailSuiteData> {
  const { orgId, orgName } = guard;

  const [identity, activity, inbox, unread, addresses, overrides, stats] =
    await Promise.all([
      getOrgEmailIdentity(orgId),
      recentActivity(orgId, 12),
      listInbox(orgId, { limit: 40 }),
      unreadCount(orgId),
      listAddressBook(orgId),
      listOrgTemplates(orgId),
      deliveryStats(orgId),
    ]);

  const overrideFor = new Map(overrides.map((o) => [o.templateKey, o]));

  return {
    orgId,
    orgName,
    identity: {
      fromEmail: identity.fromEmail,
      fromName: identity.fromName,
      replyTo: identity.replyTo ?? null,
      ownerEmails: identity.ownerEmails,
      fromIsOrgDomain: identity.fromIsOrgDomain,
      palette: identity.palette,
      // The faces an org may choose between, straight from the sending
      // package — the suite never invents a font stack of its own.
      fonts: Object.entries(EMAIL_FONTS).map(([id, font]) => ({
        id,
        label: font.label,
        hint: font.hint,
      })),
      inboundReplies: identity.inboundReplies,
      // Null when the network has no Inbound Parse host configured at all —
      // the Inbox tab then says so plainly instead of advertising an address
      // that nothing would ever deliver to.
      inboundAddress: inboundEnabled() ? inboundAddressFor(orgId) : null,
    },
    activity,
    inbox,
    unread,
    addresses,
    templates: TEMPLATE_META.map((meta) => {
      const override = overrideFor.get(meta.key);
      return {
        key: meta.key,
        title: meta.title,
        trigger: meta.trigger,
        recipient: meta.recipient,
        editable: meta.editable,
        editHint: meta.editHint,
        // The words themselves, so the Letters tab's editor opens on what the
        // org actually says today rather than on an empty box.
        bodyText: override?.bodyText ?? null,
        // The rich version too, so the Letters tab's editor opens on the
        // formatting the org actually wrote rather than on its flattened twin.
        bodyHtml: override?.bodyHtml ?? null,
        // Every sentence of this letter, with whatever this org has already
        // rewritten. The registry is the source of truth for WHICH blocks
        // exist; the override supplies only the words.
        slots: copySlotsFor(meta.key).map((slot) => ({
          id: slot.id,
          label: slot.label,
          hint: slot.hint,
          kind: slot.kind,
          fallback: slot.value.join("\n\n"),
          text: override?.copy?.[slot.id]?.text ?? null,
          html: override?.copy?.[slot.id]?.html ?? null,
          tokens: slot.tokens,
        })),
        // What this letter fills in per recipient — the token palette.
        mergeFields: mergeFieldsFor(meta.key).map((f) => ({
          name: f.name,
          label: f.label,
        })),
        override: override?.html ? "layout" : override?.bodyText ? "words" : "default",
      };
    }),
    stats,
    suiteHref: routes.suite,
    newsletterHref: routes.newsletter,
    templateHref: routes.template,
    templateLayoutHref: routes.templateLayout,
  };
}

/**
 * This host's routes for one org.
 *
 * arts-collective serves the suite itself and the per-letter PREVIEW, but not
 * the per-letter editors or the newsletter — those live in the single-tenant
 * apps. So they are omitted, and the Letters tab shows each letter, which layer
 * is winning and a working "Read it", with no links that 404.
 */
export function emailRoutesFor(orgSlug: string): EmailSuiteRoutes {
  return { suite: `/email?org=${encodeURIComponent(orgSlug)}` };
}
