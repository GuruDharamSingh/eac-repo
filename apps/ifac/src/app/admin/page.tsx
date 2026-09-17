import { redirect } from "next/navigation";

/**
 * /admin was the console. It is /manage now — one gated surface with tabs,
 * instead of two screens that each linked to the other and disagreed about what
 * "role" meant.
 *
 * Kept as a redirect rather than deleted: this URL is in people's bookmarks and
 * in the link an earlier hub tile pointed at.
 */
export default function AdminRedirect() {
  redirect("/manage");
}
