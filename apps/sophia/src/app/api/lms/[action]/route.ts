import { handleLmsAction } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";

/** Every form in Sophia posts here: /api/lms/begin, /api/lms/respond, … */
export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return handleLmsAction({ request, action, connectors });
}
