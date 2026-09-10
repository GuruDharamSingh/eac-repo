import { handleForumAction } from "@elkdonis/forum-ui";
import { getForumConnectors } from "@/lib/forum";

export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return handleForumAction({ request, action, connectors: await getForumConnectors() });
}
