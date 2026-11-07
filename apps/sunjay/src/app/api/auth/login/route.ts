import { createLoginHandler } from "@elkdonis/auth-server";
import { siteConfig } from "@/config/site";

type AuthRequest = Parameters<ReturnType<typeof createLoginHandler>>[0];

// Signing in here makes an existing network account one of the org's viewers:
// the series' join link and materials go to anyone with a role. A row that
// already exists keeps its role.
const login = createLoginHandler({
  joinOrgs: [{ id: siteConfig.orgId, role: "viewer" }],
});

export async function POST(request: Request): Promise<Response> {
  return login(request as AuthRequest) as Promise<Response>;
}
