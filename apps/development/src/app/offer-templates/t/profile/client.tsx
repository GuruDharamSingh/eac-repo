"use client";

import { ProfileTemplate } from "@elkdonis/cms-ui/offer-templates/profile";
import { TemplateFrame } from "@/offer-templates/Frame";

export function View() {
  return <TemplateFrame template="profile">{(data) => <ProfileTemplate data={data} />}</TemplateFrame>;
}
