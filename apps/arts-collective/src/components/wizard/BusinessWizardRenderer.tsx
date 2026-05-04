"use client";

import { useBusinessWizard } from "./BusinessWizardProvider";
import { StepIndicator } from "./StepIndicator";
import { BizStep1Economic } from "./steps/business/BizStep1Economic";
import { BizStep2Governance } from "./steps/business/BizStep2Governance";
import { BizStep3Logistics } from "./steps/business/BizStep3Logistics";
import { BizStep4Sustainability } from "./steps/business/BizStep4Sustainability";
import { BizStep5Resources } from "./steps/business/BizStep5Resources";

export function BusinessWizardRenderer() {
  const { step, totalSteps } = useBusinessWizard();
  
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl text-foreground">Structure Your Business</h1>
        <p className="text-sm text-muted-foreground">
          Aligning your creative practice with the collective&apos;s mutual aid model.
        </p>
      </div>
      
      <StepIndicator customStep={step} customTotal={totalSteps} />
      
      {step === 1 && <BizStep1Economic />}
      {step === 2 && <BizStep2Governance />}
      {step === 3 && <BizStep3Logistics />}
      {step === 4 && <BizStep4Sustainability />}
      {step === 5 && <BizStep5Resources />}
    </div>
  );
}
