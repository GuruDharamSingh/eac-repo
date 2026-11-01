import "@elkdonis/lms-ui/lms.css";
import { SiteShell } from "@/components/site-shell";
import { LearnHost } from "@/components/learn/LearnHost";
import { getLmsViewer } from "@/lib/lms/connectors";

/**
 * /learn — Sophia's learner pages on the network host, inside the network's
 * own chrome. The `.so-root` wrapper carries the LMS stylesheet's tokens;
 * LearnHost provides the surfaces a task step opens.
 */
export const dynamic = "force-dynamic";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getLmsViewer();
  return (
    <SiteShell wide>
      <LearnHost displayName={viewer.name} signedIn={Boolean(viewer.userId)}>
        <div className="so-root so-root--hosted">{children}</div>
      </LearnHost>
    </SiteShell>
  );
}
