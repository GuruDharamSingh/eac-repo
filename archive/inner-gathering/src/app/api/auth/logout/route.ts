import { handleLogout } from '@elkdonis/auth-server';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  return handleLogout(req);
}
