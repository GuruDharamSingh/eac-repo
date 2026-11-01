import { createDeletionRequestHandler } from "@elkdonis/services";
import { siteConfig } from "@/config/site";

/**
 * The /data/delete form. Writes a data_deletion_requests row (migration 216)
 * and mails the collective's inbox; the mail is best-effort.
 */
export const POST = createDeletionRequestHandler({
  orgId: siteConfig.orgId,
  notify: async (request) => {
    const { sendEmail } = await import("@elkdonis/email");
    await sendEmail({
      to: siteConfig.fallbackNotifyEmail,
      subject: `Data deletion request ${request.confirmationCode} — ${siteConfig.orgName}`,
      html: `<p>A visitor asked for their data to be deleted.</p>
<p><strong>Email:</strong> ${request.email ?? "(none)"}<br/>
<strong>Code:</strong> ${request.confirmationCode}<br/>
<strong>Note:</strong> ${request.message ? request.message.replace(/</g, "&lt;") : "(none)"}</p>
<p>Verify the request, remove the account, then mark the row completed
(resolveDeletionRequest in @elkdonis/services; see packages/cms-ui/src/data-policy/README.md).</p>`,
      orgId: siteConfig.orgId,
      kind: "contact",
      replyTo: request.email ?? undefined,
    });
  },
});
