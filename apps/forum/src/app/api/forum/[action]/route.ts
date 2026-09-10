import { handleForumAction } from "@elkdonis/forum-ui";
import { getConnectors } from "@/lib/connectors";

/**
 * Every form on the board posts here: /api/forum/reply, /api/forum/vote, …
 * The package decides what the fields mean; this file only supplies who is
 * asking, through the same connectors the pages use.
 */
export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return handleForumAction({ request, action, connectors: await getConnectors() });
}
