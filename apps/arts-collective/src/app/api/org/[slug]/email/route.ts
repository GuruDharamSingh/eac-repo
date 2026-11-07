import { NextResponse } from "next/server";
import { guardOrgEmail, loadEmailSuite, emailRoutesFor } from "@/lib/email-suite";

/**
 * The suite's data, for a client that wants to refresh without a page reload.
 *
 * Owners and guides only: it carries the address book and the inbox.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const guard = await guardOrgEmail(slug);
  // One 404 for "not signed in", "no such org" and "not an editor" alike:
  // distinguishing them would enumerate the network's orgs and their rosters.
  if (!guard) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    data: await loadEmailSuite(guard, emailRoutesFor(guard.orgSlug)),
    canEdit: guard.canEdit,
  });
}
