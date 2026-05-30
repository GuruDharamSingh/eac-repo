import { redirect } from 'next/navigation';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { WorkshopEditor } from '@/components/workshop-editor';

export default async function CreateWorkshopPage() {
  const session = await getServerSession();
  if (!session?.user) redirect('/login?returnTo=/workshops/create');

  // Only org members can create workshops
  const membership = await db`
    SELECT 1 FROM user_organizations
    WHERE user_id = ${session.user.id} AND org_id = 'inner_group'
    LIMIT 1
  `.catch(() => []);

  if (!membership.length) redirect('/');

  return <WorkshopEditor />;
}
