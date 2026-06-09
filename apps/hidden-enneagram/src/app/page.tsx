import { SilexSiteBySlug } from "@elkdonis/silex-render";
import { AuthNav } from "@/components/auth-nav";
import { ORG_SLUG } from "@/lib/session";

// Session-dependent nav + live embeds → always render fresh.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <AuthNav />
      <SilexSiteBySlug
        slug={ORG_SLUG}
        cssLinks={["/api/silex/templates/enneagram.css"]}
      />
    </>
  );
}
