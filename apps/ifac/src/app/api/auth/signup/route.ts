import { handleSignup } from "@elkdonis/auth-server";

type AuthRequest = Parameters<typeof handleSignup>[0];

export async function POST(request: Request): Promise<Response> {
	return handleSignup(request as AuthRequest) as Promise<Response>;
}
