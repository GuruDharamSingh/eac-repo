"use client";

import { SeriesTemplate } from "@elkdonis/cms-ui/offer-templates/series";
import { TemplateFrame } from "@/offer-templates/Frame";

export function View() {
  return <TemplateFrame template="series">{(data) => <SeriesTemplate data={data} />}</TemplateFrame>;
}
