import { handleLogout, handleLogoutRedirect } from "@elkdonis/auth-server";

type AuthRequest = Parameters<typeof handleLogout>[0];

export async function POST(request: Request): Promise<Response> {
	return handleLogout(request as AuthRequest) as Promise<Response>;
}

/** The hub drawer's plain "Sign out" link (HubDrawer.tsx); only POST existed before, so it answered 405. */
export async function GET(request: Request): Promise<Response> {
	return handleLogoutRedirect(request as AuthRequest) as Promise<Response>;
}
