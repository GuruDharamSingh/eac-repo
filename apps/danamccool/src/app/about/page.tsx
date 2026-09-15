import { redirect } from "next/navigation";

// Her real nav calls this "Biography" — redirect the old /about route there
// rather than duplicating the page.
export default function AboutRedirect() {
  redirect("/biography");
}
