import { FlyoverQueue } from "@/components/manage/flyover-queue";
import { listRenderRequests } from "@/lib/render-requests";
import { canAcceptFlyoversAction } from "@/lib/render-request-actions";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FlyoversPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const [requests, canAccept] = await Promise.all([listRenderRequests({ limit: 200 }), canAcceptFlyoversAction()]);
  return (
    <>
      <h2 className="font-serif text-2xl">Fly-overs</h2>
      <div className="mt-4"><FlyoverQueue requests={requests} canAccept={canAccept} /></div>
    </>
  );
}
