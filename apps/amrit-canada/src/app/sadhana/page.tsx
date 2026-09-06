import { redirect } from "next/navigation";

/**
 * The Amrit Vela feed lived at /sadhana before the rebuild. Links to it have
 * been shared in group chats and emails, so the path is kept as a redirect
 * rather than left to 404.
 */
export default function SadhanaRedirect() {
  redirect("/amrit-vela");
}
