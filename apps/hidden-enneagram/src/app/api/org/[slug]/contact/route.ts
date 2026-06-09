import { handleOrgContact } from "@elkdonis/silex-render";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return handleOrgContact(req, { slug });
}
