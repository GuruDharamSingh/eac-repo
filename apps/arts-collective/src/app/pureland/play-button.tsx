"use client";

import { useEffect, useState } from "react";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "breath-loader": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        label?: string;
        theme?: string;
        fullscreen?: boolean;
        indeterminate?: boolean;
      };
    }
  }
}

/**
 * Play Pureland: covers the page at once with the same breathing loader the game's own page
 * shows (public/breath-loader.js, from BuddhasEngines8 godot/web/breath-loader/), then goes to
 * /pureland/play/, whose shell paints that loader on its first frame and keeps it until the
 * valley is built and drawing smoothly.
 */
export function PlayButton({ ready }: { ready: boolean }) {
  const [going, setGoing] = useState(false);

  useEffect(() => {
    if (document.querySelector('script[data-breath-loader]')) return;
    const script = document.createElement("script");
    script.src = "/breath-loader.js";
    script.dataset.breathLoader = "";
    document.head.appendChild(script);
  }, []);

  // Back from the game (bfcache): take the cover off again.
  useEffect(() => {
    const show = (e: PageTransitionEvent) => { if (e.persisted) setGoing(false); };
    window.addEventListener("pageshow", show);
    return () => window.removeEventListener("pageshow", show);
  }, []);

  return (
    <>
      <a
        className="pl-button pl-play"
        href="/pureland/play/"
        aria-disabled={!ready}
        onClick={(e) => {
          if (!ready) {
            e.preventDefault();
            return;
          }
          setGoing(true);
        }}
      >
        Play Pureland
      </a>
      {going && <breath-loader fullscreen theme="dark" indeterminate label="Loading Pureland…" />}
    </>
  );
}
