"use client";
import { StageView } from "@elkdonis/cms-ui/offer-templates/stage";
import { TemplateFrame } from "@/offer-templates/Frame";
export function View() { return <TemplateFrame template="essay">{(data) => <StageView data={data} />}</TemplateFrame>; }
