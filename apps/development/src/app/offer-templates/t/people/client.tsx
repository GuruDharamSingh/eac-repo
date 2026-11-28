"use client";

import { OfferSurfaceRoot } from "@elkdonis/cms-ui/offer-surface";
import { sampleActions, sampleData } from "@elkdonis/cms-ui/offer-templates/sample";
import { PersonName } from "../../../../../../../packages/cms-ui/src/offer-surface/layers-people";
import * as React from "react";

// Demo of PersonName, the hover card (5d) and the member layer (5c). The sample site has no
// member, so one is added here ("m1") with the replies the packet draws.
export function View() {
  const data = React.useMemo(() => {
    const d = sampleData("profile", {});
    return {
      ...d,
      people: { ...d.people, m1: { id: "m1", name: "Name", role: "Posts in the talk · since Sep 2026" } },
      memberReplies: {
        m1: [
          { on: "Event title", ago: "2h", text: "Looking forward to this one." },
          { on: "Event title", ago: "3d", text: "Is there step-free access at the venue?" },
          { on: "Title of the piece", ago: "20 Sep", text: "This one stayed with me all week." },
        ],
      },
    };
  }, []);
  return (
    <div className="ot-frame">
      <OfferSurfaceRoot data={data} actions={sampleActions}>
        <div style={{ padding: 48, display: "grid", gap: 20, maxWidth: 640, fontFamily: "var(--fb)", fontSize: 13 }}>
          <p>
            Hosted by <PersonName id={data.owner.id} /> and <PersonName id="guest" />. Hover a name for the card; click opens the profile surface.
          </p>
          <p>
            <PersonName id="m1" /> · 2h · Looking forward to this one.
          </p>
        </div>
      </OfferSurfaceRoot>
    </div>
  );
}
