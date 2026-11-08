import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Data } from "@puckeditor/core";
import { getServiceOffering } from "@elkdonis/services";
import { PuckPage, pageData } from "@/lib/puck/render";
import { SERVICE_SLUG } from "@/lib/puck/store";
import { DEFAULT_SERVICE_PAGE } from "@/lib/default-pages";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceOffering(siteConfig.orgId, slug);
  if (!service) return {};
  return {
    title: service.title,
    description: service.descriptionShort ?? undefined,
    openGraph: service.coverImageUrl ? { images: [service.coverImageUrl] } : undefined,
  };
}

type Node = { type?: string; props?: Record<string, unknown> };

/** Hand the address to every he-service block, slots included (the resolver reads it; never stored). */
function withRoute(nodes: unknown, slug: string, query: Record<string, string | undefined>): unknown {
  if (!Array.isArray(nodes)) return nodes;
  return nodes.map((n: Node) => {
    if (!n || typeof n !== "object" || !n.props) return n;
    const props: Record<string, unknown> = { ...n.props };
    for (const [k, v] of Object.entries(props)) if (Array.isArray(v)) props[k] = withRoute(v, slug, query);
    if (n.type === "he-service") Object.assign(props, { routeSlug: slug, routeQuery: query });
    return { ...n, props };
  });
}

/**
 * /services/<slug> (round 3): the studio document `service` (one template for
 * every service; DEFAULT_SERVICE_PAGE until published) around he-service,
 * which draws this service and "Book and pay". Stripe returns here with
 * `?booked=1&order=<id>` (app/api/checkout/return).
 */
export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ booked?: string; order?: string; card?: string; payment?: string }>;
}) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const service = await getServiceOffering(siteConfig.orgId, slug);
  if (!service) notFound();
  const data = await pageData(SERVICE_SLUG, DEFAULT_SERVICE_PAGE);
  if (!data) notFound();
  const query = { booked: q.booked, order: q.order, card: q.card, payment: q.payment };
  const routed = { ...data, content: withRoute(data.content, service.slug, query) } as Data;
  return <PuckPage slug={SERVICE_SLUG} data={routed} />;
}
