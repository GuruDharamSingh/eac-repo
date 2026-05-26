import { redirect } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import { AdminDashboard } from "@/components/admin-dashboard";
import { canManageIfac, getContacts, getIfacUsers, getSiteContent, getUpcomingEvents } from "@/lib/data";

export const metadata = { title: "IFAC Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) {
    redirect("/login");
  }

  const [content, events, contacts, users] = await Promise.all([
    getSiteContent(),
    getUpcomingEvents(20),
    getContacts(),
    getIfacUsers(),
  ]);

  return (
    <AdminDashboard
      initialContent={content}
      initialEvents={events}
      initialContacts={contacts}
      initialUsers={users}
      userEmail={session.user?.email ?? "admin"}
    />
  );
}
