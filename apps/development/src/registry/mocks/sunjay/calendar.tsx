"use client";

import { HubCalendar } from "@elkdonis/cms-ui/hubsite";
import { Surface } from "./surface";
import { monthEvents } from "./sample";

// Real: cms-ui's HubCalendar on a month of invented gatherings.
export default function Calendar() {
  return (
    <Surface>
      <HubCalendar initialEvents={monthEvents()} />
    </Surface>
  );
}
