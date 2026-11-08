import { redirect } from "next/navigation";

/** The content list is /manage (round 4 keeps that address); this one, and its ?kind=, land there. */
export default async function ManageContentIndex({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  redirect(kind === "post" || kind === "service" ? `/manage?kind=${kind}` : "/manage");
}
