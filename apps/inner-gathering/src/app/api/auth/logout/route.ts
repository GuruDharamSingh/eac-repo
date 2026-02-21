import { handleLogout } from '@elkdonis/auth-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Logout endpoint that returns HTML to trigger Nextcloud logout
 * This prevents the "wrong user" issue when switching accounts
 */
export async function POST(req: NextRequest) {
  // First, logout from inner-gathering
  const logoutResponse = await handleLogout(req);

  // If logout succeeded, return HTML that triggers Nextcloud logout
  if (logoutResponse.status === 200) {
    const nextcloudUrl = process.env.NEXT_PUBLIC_NEXTCLOUD_URL || 'http://localhost:8080';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Logging out...</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .message {
      text-align: center;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="message">
    <p>Logging out...</p>
  </div>
  <!-- Invisible iframe to trigger Nextcloud logout -->
  <iframe
    src="${nextcloudUrl}/logout"
    style="display:none;"
    onload="window.location.href='/'"
  ></iframe>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }

  // If logout failed, return the original response
  return logoutResponse;
}
