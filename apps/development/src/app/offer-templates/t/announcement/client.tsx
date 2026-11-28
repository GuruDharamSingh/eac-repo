"use client";

import { AnnouncementTemplate } from "@elkdonis/cms-ui/offer-templates/announcement";
import { TemplateFrame } from "@/offer-templates/Frame";

export function View() {
  return <TemplateFrame template="announcement">{(data) => <AnnouncementTemplate data={data} />}</TemplateFrame>;
}
