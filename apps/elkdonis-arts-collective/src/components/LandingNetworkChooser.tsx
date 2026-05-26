"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "eac-chose";

export function LandingNetworkChooser() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  function stayHere() {
    localStorage.setItem(STORAGE_KEY, "true");
    setHidden(true);
  }

  if (hidden) return null;

  return (
    <aside className="chooser-band" aria-label="Landing and network chooser">
      <div className="chooser-inner">
        <p className="chooser-copy">
          We are Elkdonis Arts collective, a performance and visual arts group.
        </p>
        <div className="chooser-actions">
          <span className="chooser-status">Network coming soon</span>
          <button type="button" className="chooser-button" onClick={stayHere}>
            Stay here
          </button>
          <a
            className="chooser-link"
            href="https://meetings.elkdonis-arts.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Meetings
          </a>
        </div>
      </div>
    </aside>
  );
}
