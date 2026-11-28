/** What an org's site draws when the new page is off, as a phrase that finishes "Your site shows ...". Plain module (server and client). */
export function drawsInsteadOf(x: { silex: boolean; designed: boolean; offering: { pinned: boolean; title: string } | null }): string {
  if (x.silex) return "your published Silex page";
  if (x.designed) return "the landing page you designed";
  if (x.offering) return x.offering.pinned ? `the pinned item, “${x.offering.title}”` : `the newest published item, “${x.offering.title}”`;
  return "the default page built from your identity";
}
