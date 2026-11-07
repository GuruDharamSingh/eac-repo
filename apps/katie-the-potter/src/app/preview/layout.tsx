import type { Metadata } from "next";

/**
 * /preview — the landing and the detail page drawn with the six SAMPLE
 * pieces, so the card and popup design can be looked at before the store has
 * listings. Public but not for search engines: noindex here, and an
 * X-Robots-Tag header from next.config.ts. The live `/` is untouched.
 */
export const metadata: Metadata = {
  title: { absolute: "Preview — sample pieces · Katie the Potter" },
  robots: { index: false, follow: false, nocache: true },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <p className="ktp-preview-ribbon" role="note">
        Preview — sample pieces. Nothing here is for sale; the real pieces come from the store.
      </p>
      {children}
    </>
  );
}
