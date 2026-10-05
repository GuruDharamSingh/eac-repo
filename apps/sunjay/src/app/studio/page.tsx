import { redirect } from "next/navigation";

/** The page list lives in Manage, beside the site copy and the content. */
export default function StudioIndex() {
  redirect("/manage/builder");
}
