import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getEditableOrgsForUser } from "@/lib/org";

export default async function HubPage() {
  const user = await getCurrentUser();

  // Signed out, /hub lands on the organization tab, which renders the join
  // tiers. Bouncing to /login here would make the tiers unreachable from the
  // hub link that every signed-out visitor sees in the header.
  if (!user) redirect("/hub/organization");

  const editableOrgs = await getEditableOrgsForUser(user.id);
  redirect(editableOrgs.length > 0 ? "/hub/organization" : "/hub/network");
}
