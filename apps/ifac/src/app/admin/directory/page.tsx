import { redirect } from "next/navigation";

/** Moved into the console as a tab — see ../page.tsx. */
export default function AdminDirectoryRedirect() {
  redirect("/manage/directory");
}
