"use client";

import { ArtworkTemplate } from "@elkdonis/cms-ui/offer-templates/artwork";
import { TemplateFrame } from "@/offer-templates/Frame";

export function View() {
  return <TemplateFrame template="artwork">{(data) => <ArtworkTemplate data={data} />}</TemplateFrame>;
}
