import { networkUrl } from "@/lib/org-url";

/**
 * Every org subdomain is hosted by the collective and says so — the network
 * link is the one piece of chrome the org does not control.
 */
export function SiteFooter({
  orgName,
  mainSiteUrl,
}: {
  orgName: string;
  mainSiteUrl?: string | null;
}) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground">
        <span>
          © {new Date().getFullYear()} {orgName}
          {mainSiteUrl && (
            <>
              {" · "}
              <a className="underline underline-offset-4" href={mainSiteUrl}>
                {mainSiteUrl.replace(/^https?:\/\//, "")}
              </a>
            </>
          )}
        </span>
        <a className="underline underline-offset-4" href={networkUrl()}>
          Part of the Elkdonis Arts Collective
        </a>
      </div>
    </footer>
  );
}
