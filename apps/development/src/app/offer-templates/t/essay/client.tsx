"use client";
import { EssayTemplate } from "@elkdonis/cms-ui/offer-templates/essay";
import { TemplateFrame } from "@/offer-templates/Frame";
export function View() { return <TemplateFrame template="essay">{(data) => <EssayTemplate data={data} />}</TemplateFrame>; }
