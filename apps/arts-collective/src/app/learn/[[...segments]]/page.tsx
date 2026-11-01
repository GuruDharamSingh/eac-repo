import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { lmsRouteMetadata, renderLmsRoute } from "@elkdonis/lms-ui";
import { lmsConnectors, ONBOARDING_COURSE_SLUG, getLmsViewer } from "@/lib/lms/connectors";

type Props = { params: Promise<{ segments?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = await lmsRouteMetadata(lmsConnectors, (await params).segments ?? []);
  return (m as Metadata) ?? { title: "Learn" };
}

export default async function LearnPage({ params, searchParams }: Props) {
  const segments = (await params).segments ?? [];
  const q = await searchParams;
  // Back from Stripe: re-read the account before the step decides whether
  // "Get paid" is done (startPayoutsFor's note on return routes).
  if (q.payouts === "done") {
    const viewer = await getLmsViewer();
    if (viewer.userId) {
      const { refreshStripeAccountStatus } = await import("@elkdonis/checkout/stripe");
      await refreshStripeAccountStatus(viewer.userId).catch((err) => console.error("[learn] refreshStripeAccountStatus:", err));
    }
  }
  const r = await renderLmsRoute({
    c: lmsConnectors,
    segments,
    searchParams: q,
    autoEnrol: (course) => course.slug === ONBOARDING_COURSE_SLUG,
  });
  if (r.kind === "not-found") notFound();
  if (r.kind === "redirect") redirect(r.to);
  return r.node;
}
