import "server-only";
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
} from "@elkdonis/email";
import type { EmailSuiteData } from "@elkdonis/cms-ui/email";
import { siteConfig } from "@/config/site";

// ============================================================================
// The email suite's server side, for a single-tenant site.
//
// Much smaller than arts-collective's equivalent, and deliberately: this app
// serves exactly one org, so the org is `siteConfig.orgId` rather than a slug
// re-derived per request, and the guard is the app's own `requireOrgEditor`
// rather than a bespoke one.
//
// This host supplies ALL FOUR routes, which is why it — not the network hub —
// is where the suite is fully integrated. The per-letter editors and the
// GrapesJS newsletter are org-IMPLIED routes (`/hub/email/<key>`,
// `/hub/newsletter`); on a multi-org console every one of them would need an
// `?org=` and a re-derivation, which is the work arts-collective has not done
// and why its Letters tab omits those links rather than showing three 404s.
// ============================================================================

/** Where this app's email pages live. All four exist here. */
export function emailRoutes() {
  return {
    suite: "/hub/email",
    newsletter: "/hub/newsletter",
    template: "/hub/email/{key}",
    templateLayout: "/hub/email/{key}/edit",
  };
}

/**
 * Everything the suite draws, in one pass.
 *
 * Seven queries in parallel rather than seven connector round-trips on open:
 * every tab is a view of the same organisation.
 */
export async function loadEmailSuite(): Promise<EmailSuiteData> {
  const orgId = siteConfig.orgId;
  const routes = emailRoutes();

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
    orgName: identity.fromName,
    identity: {
      fromEmail: identity.fromEmail,
      fromName: identity.fromName,
      replyTo: identity.replyTo ?? null,
      ownerEmails: identity.ownerEmails,
      fromIsOrgDomain: identity.fromIsOrgDomain,
      palette: identity.palette,
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
