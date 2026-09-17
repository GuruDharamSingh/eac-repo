import { headers } from "next/headers";
import { isValidNewsletterSlug, publicBaseUrl } from "@elkdonis/newsletter";
import { sendNewsletter } from "@elkdonis/newsletter/server";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Send one letter — a test to named addresses, or the real thing to the org's
 * contacts.
 *
 * A test is capped at three addresses and does NOT mark the letter sent; the
 * distinction is made in sendNewsletter, which is the only thing that writes
 * that record.
 *
 * `baseUrl` is derived from the request rather than configured, because the
 * unsubscribe link has to point back at the host the recipient's org actually
 * answers on — this app serves one org, but the same package is meant to be
 * mounted by several.
 */
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const viewer = await getApiEditor();
  if (!viewer) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  if (!isValidNewsletterSlug(slug)) {
    return Response.json({ error: "Invalid name" }, { status: 400 });
  }

  let body: { testTo?: unknown; force?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // An empty body means a real send.
  }

  const testTo = Array.isArray(body.testTo)
    ? body.testTo.filter((x): x is string => typeof x === "string" && x.includes("@")).slice(0, 3)
    : undefined;

  const h = await headers();
  // Not simply NEXT_PUBLIC_APP_URL: it is a localhost default here, and it was
  // winning over the real host — which would have put an unreachable
  // unsubscribe link in every letter. See publicBaseUrl.
  const baseUrl = publicBaseUrl(
    process.env.NEXT_PUBLIC_APP_URL,
    h.get("x-forwarded-proto"),
    h.get("x-forwarded-host") ?? h.get("host")
  );

  const result = await sendNewsletter({
    // Only ever set by the author confirming a letter the server already
    // refused once, having been shown exactly what was wrong with it.
    force: body.force === true,
    orgId: siteConfig.orgId,
    orgName: siteConfig.orgName ?? siteConfig.orgId,
    slug,
    baseUrl,
    testTo,
  });

  return Response.json(result, { status: result.ok ? 200 : 400 });
}
