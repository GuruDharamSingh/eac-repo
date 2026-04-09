import { getServerSession } from '@elkdonis/auth-server';

export async function GET() {
  const session = await getServerSession();
  return Response.json(session);
}
