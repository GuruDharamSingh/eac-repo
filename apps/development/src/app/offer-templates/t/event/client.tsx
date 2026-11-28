"use client";

import { EventTemplate } from "@elkdonis/cms-ui/offer-templates/event";
import { TemplateFrame } from "@/offer-templates/Frame";

export function View() {
  return <TemplateFrame template="event">{(data) => <EventTemplate data={data} />}</TemplateFrame>;
}
