import { NextRequest } from 'next/server';
import { handleSignup } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';

export async function POST(req: NextRequest) {
  // Read the body once, then reconstruct the request for handleSignup
  const bodyText = await req.text();
  let email: string | null = null;
  try {
    email = (JSON.parse(bodyText) as { email?: string })?.email ?? null;
  } catch { /* malformed body — handleSignup will reject it */ }

  const forwardedReq = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: bodyText,
  });

  const response = await handleSignup(forwardedReq);

  // On success, link any existing contact record with the new user
  if (response.ok && email) {
    try {
      const { user } = await response.clone().json() as { user?: { id: string } };
      if (user?.id) {
        await db`
          UPDATE contacts
          SET status = 'joined', user_id = ${user.id}
          WHERE email = ${email.trim().toLowerCase()}
            AND status != 'joined'
        `;
      }
    } catch (err) {
      console.error('[signup] contact linking failed:', err);
    }
  }

  return response;
}
