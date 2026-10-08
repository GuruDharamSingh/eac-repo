export function SiteFooter() {
  const networkUrl = process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL;
  return (
    <footer className="ad-footer">
      <div className="ad-footer-inner">
        <p>
          ArtDirect is an open record kept by the people in it. Files can be opened by anyone, claimed by the
          artist, and vouched for by the network.
        </p>
        <p className="ad-footer-small">
          A commons of the{" "}
          {networkUrl ? <a href={networkUrl}>Elkdonis Arts Collective</a> : "Elkdonis Arts Collective"}.
        </p>
      </div>
    </footer>
  );
}
