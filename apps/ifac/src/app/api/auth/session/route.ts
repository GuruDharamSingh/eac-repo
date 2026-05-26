import { handleGetSession } from "@elkdonis/auth-server";

type AuthRequest = Parameters<typeof handleGetSession>[0];

export async function GET(request: Request): Promise<Response> {
	return handleGetSession(request as AuthRequest) as Promise<Response>;
}
