import { handleContact } from "@/lib/contact";

/** The contact form (he-contact): lib/contact.ts. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  return handleContact(req, { slug });
}
