import { createDeletionRequestHandler } from "@elkdonis/services";

const NOTIFY_EMAIL = process.env.NETWORK_NOTIFY_EMAIL ?? "info@elkdonis-arts.org";

/**
 * The /data/delete form on the network host. Rows carry org_id NULL (the
 * network itself, as in analytics_events). Mail is best-effort.
 */
export const POST = createDeletionRequestHandler({
  orgId: null,
  notify: async (request) => {
    const { sendEmail } = await import("@elkdonis/email");
    await sendEmail({
      to: NOTIFY_EMAIL,
      subject: `Data deletion request ${request.confirmationCode} — arts-collective.com`,
      html: `<p>A visitor asked for their data to be deleted.</p>
<p><strong>Email:</strong> ${request.email ?? "(none)"}<br/>
<strong>Code:</strong> ${request.confirmationCode}<br/>
<strong>Note:</strong> ${request.message ? request.message.replace(/</g, "&lt;") : "(none)"}</p>
<p>Verify the request, remove the account, then mark the row completed
(resolveDeletionRequest in @elkdonis/services; see packages/cms-ui/src/data-policy/README.md).</p>`,
      kind: "contact",
      replyTo: request.email ?? undefined,
    });
  },
});
