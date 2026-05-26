import { handleLogin } from "@elkdonis/auth-server";

type AuthRequest = Parameters<typeof handleLogin>[0];

export async function POST(request: Request): Promise<Response> {
	return handleLogin(request as AuthRequest) as Promise<Response>;
}
