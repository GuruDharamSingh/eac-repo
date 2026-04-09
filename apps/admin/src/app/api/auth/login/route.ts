import { NextRequest } from 'next/server';
import { handleLogin } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  let email: string | null = null;
  try {
    email = (JSON.parse(bodyText) as { email?: string })?.email ?? null;
  } catch { /* ignore */ }

  const forwardedReq = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: bodyText,
  });

  const response = await handleLogin(forwardedReq);

  // On successful login, backfill any unlinked contact records for this email
  if (response.ok && email) {
    try {
      const { user } = await response.clone().json() as { user?: { id: string } };
      if (user?.id) {
        await db`
          UPDATE contacts
          SET status = 'joined', user_id = ${user.id}
          WHERE email = ${email.trim().toLowerCase()}
            AND user_id IS NULL
        `;
      }
    } catch (err) {
      console.error('[login] contact linking failed:', err);
    }
  }

  return response;
}
