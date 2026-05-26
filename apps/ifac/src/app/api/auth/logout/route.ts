import { handleLogout } from "@elkdonis/auth-server";

type AuthRequest = Parameters<typeof handleLogout>[0];

export async function POST(request: Request): Promise<Response> {
	return handleLogout(request as AuthRequest) as Promise<Response>;
}
