import { redirect } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import { canManageIfac } from "@/lib/data";
import { listAllDirectory } from "@/lib/directory-admin";
import { DirectoryManager } from "@/components/directory-manager";

export const metadata = { title: "IFAC Directory Admin" };
export const dynamic = "force-dynamic";

export default async function DirectoryAdminPage() {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) {
    redirect("/login");
  }

  const profiles = await listAllDirectory();

  return <DirectoryManager initialProfiles={profiles} />;
}
