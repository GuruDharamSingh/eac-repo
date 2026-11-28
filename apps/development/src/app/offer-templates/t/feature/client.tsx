"use client";
import { FeatureTemplate } from "@elkdonis/cms-ui/offer-templates/feature";
import { TemplateFrame } from "@/offer-templates/Frame";
export function View() { return <TemplateFrame template="feature">{(data) => <FeatureTemplate data={data} />}</TemplateFrame>; }
