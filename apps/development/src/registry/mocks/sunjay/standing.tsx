"use client";

import { StandingMeetingFace, type HubStandingMeeting } from "@elkdonis/cms-ui/hub";
import { Surface } from "./surface";
import { STANDING } from "./sample";

// Real: cms-ui's StandingMeetingFace inside Sunjay's landing-standing wrapper. The meeting is invented.
export default function Standing() {
  return (
    <Surface>
      <div className="landing-standing">
        <StandingMeetingFace standing={STANDING as unknown as HubStandingMeeting} canEdit={false} timeZone="America/Toronto" />
      </div>
    </Surface>
  );
}
