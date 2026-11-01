import { isValidNewsletterSlug } from "@elkdonis/newsletter";
import { sendNewsletter } from "@elkdonis/newsletter/server";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { findIfacSeries } from "@/lib/series-letters-store";
import { MAILING_BASE_URL, mailingUnsubscribeUrl, seriesAudience } from "@/lib/series-letters-mailings";

/**
 * Send one mailing: a test to the editor's own address, or the real send to
 * the series' subscribers (minus org-unsubscribed addresses; `listRecipients`).
 * The editor saves first and asks for confirmation before a real send; the
 * server refuses broken thread cards and placeholder copy unless `force`.
 *
 * Every copy carries the series' one-click unsubscribe link, and the
 * `email_sends` rows are recorded against the series thread (`threadId`).
 * Owner or guide only.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const viewer = await getApiEditor();
  if (!viewer) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id, slug } = await params;
  if (!isValidNewsletterSlug(slug)) return Response.json({ error: "Invalid name" }, { status: 400 });
  const series = await findIfacSeries(id);
  if (!series) return Response.json({ error: "Not an IFAC series" }, { status: 404 });

  let body: { testTo?: unknown; force?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // An empty body means a real send.
  }

  const testTo = Array.isArray(body.testTo)
    ? body.testTo.filter((x): x is string => typeof x === "string" && x.includes("@")).slice(0, 3)
    : undefined;

  const result = await sendNewsletter({
    // Only set after the author was shown what the server refused and chose to send anyway.
    force: body.force === true,
    orgId: siteConfig.orgId,
    orgName: siteConfig.orgName ?? siteConfig.orgId,
    slug,
    audience: seriesAudience(series.id),
    baseUrl: MAILING_BASE_URL,
    unsubscribeUrl: mailingUnsubscribeUrl(series.id),
    testTo,
  });

  return Response.json(result, { status: result.ok ? 200 : 400 });
}
