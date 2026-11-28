"use client";

import { ServiceTemplate } from "@elkdonis/cms-ui/offer-templates/service";
import { TemplateFrame } from "@/offer-templates/Frame";

export function View() {
  return <TemplateFrame template="service">{(data) => <ServiceTemplate data={data} />}</TemplateFrame>;
}
