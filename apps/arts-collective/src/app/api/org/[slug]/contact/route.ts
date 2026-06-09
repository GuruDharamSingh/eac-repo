import { handleOrgContact } from "@elkdonis/silex-render";

/**
 * Public inquiry/contact endpoint for a Silex-published org page. The handler is
 * shared (@elkdonis/silex-render) so every host app exposes the same behavior.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return handleOrgContact(req, { slug });
}
