import { redirect } from 'next/navigation';
import { getServerSession } from '@elkdonis/auth-server';
import { siteConfig } from '@/config/site';
import { getUpcomingMeetings } from '@/lib/data';
import { AdminDashboard } from '@/components/admin-dashboard';

export const metadata = { title: 'Admin | Amrit Vela Toronto' };

export default async function AdminPage() {
  const session = await getServerSession();

  if (
    !session?.user ||
    !siteConfig.ownerEmails.includes(session.user.email)
  ) {
    redirect('/login');
  }

  const meetings = await getUpcomingMeetings(20);

  return (
    <AdminDashboard 
      userEmail={session.user.email} 
      meetings={meetings} 
    />
  );
}
