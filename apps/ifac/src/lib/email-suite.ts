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
  copySlotsFor,
  mergeFieldsFor,
  EMAIL_FONTS,
} from "@elkdonis/email";
import type { EmailSuiteData } from "@elkdonis/cms-ui/email";
import { siteConfig } from "@/config/site";

// ============================================================================
// IFAC's email, server side.
//
// This site has been SENDING for as long as the network has had SendGrid keys
// — every RSVP confirmation, every reminder, every provisioning letter goes
// out under IFAC's name — and until now there was nowhere on the site to read
// what had gone out, see what came back, or change a word of it. The suite
// existed (`@elkdonis/cms-ui/email`) and three other apps mounted it; IFAC,
// the most built-out site on the network, did not.
//
// Single-tenant, so the org is `siteConfig.orgId` rather than a slug re-derived
// per request, and the guard is the app's own `getApiEditor`/`requireOrgEditor`
// rather than a bespoke one — the same shape innergathering uses.
//
// THREE of the four routes exist here. The newsletter is deliberately omitted:
// IFAC has no `/hub/newsletter`, and the Letters tab draws no link at all for a
// route a host does not serve rather than one that 404s.
// ============================================================================

/** Where this app's email pages live. */
export function emailRoutes() {
  return {
    // /manage/email, not /hub/email. The suite moved there 2026-09-19 and
    // /hub/email is now a redirect, so pointing at it made every link in the
    // suite a bounce — cheap, but it also meant the address bar disagreed
    // with itself for a moment on every click.
    suite: "/manage/email",
    template: "/hub/email/{key}",
    templateLayout: "/hub/email/{key}/edit",
  };
}

/**
 * Everything the suite draws, in one pass.
 *
 * Seven queries in parallel rather than seven connector round-trips on open:
 * every tab is a view of the same organisation, and splitting them would mean
 * a spinner per tab for data that was one join away.
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
    // The org's own name from its sending identity, not siteConfig's: the
    // Look tab can change it, and a suite that disagreed with the From line
    // would be describing a different organisation than the one sending.
    orgName: identity.fromName,
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
    templateHref: routes.template,
    templateLayoutHref: routes.templateLayout,
  };
}
