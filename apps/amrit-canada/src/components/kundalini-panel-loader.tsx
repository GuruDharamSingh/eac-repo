"use client";

import dynamic from "next/dynamic";

/**
 * paper.js's package resolves to a jsdom-dependent Node build when Next
 * tries to include it in a "use client" component's SSR pass. ssr:false
 * keeps it out of the server bundle entirely -- it only loads once the
 * client hydrates. `dynamic()` with ssr:false isn't allowed directly inside
 * a Server Component, hence this dedicated client-boundary file.
 */
export const KundaliniPanel = dynamic(
  () => import("./kundalini-panel").then((mod) => mod.KundaliniPanel),
  {
    ssr: false,
    // Otherwise this renders nothing at all until the paper.js chunk
    // finishes downloading -- a blank strip the same color as the header
    // behind it, easy to mistake for "the banner isn't there."
    loading: () => (
      <div
        className="h-full w-full"
        style={{
          background:
            "linear-gradient(90deg, #10151a 0%, #36454f 50%, #7a3616 100%)",
        }}
      />
    ),
  }
);
