import { siteConfig } from "@/config/site";

/** Just her name, bottom-left of the content column — that's all her real footer was. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>{siteConfig.orgName}</p>
    </footer>
  );
}
