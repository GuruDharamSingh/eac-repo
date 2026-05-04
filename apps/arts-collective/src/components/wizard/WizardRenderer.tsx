"use client";

import { useWizard } from "./WizardProvider";
import { StepIndicator } from "./StepIndicator";
import { Step1Identity } from "./steps/Step1Identity";
import { Step2Practice } from "./steps/Step2Practice";
import { Step3Audience } from "./steps/Step3Audience";
import { Step4Goals } from "./steps/Step4Goals";
import { Step5World } from "./steps/Step5World";
import { Step6Needs } from "./steps/Step6Needs";
import { Step7Features } from "./steps/Step7Features";
import { Step8Template } from "./steps/Step8Template";

export function WizardRenderer() {
  const { step } = useWizard();
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10">
      <StepIndicator />
      {step === 1 && <Step1Identity />}
      {step === 2 && <Step2Practice />}
      {step === 3 && <Step3Audience />}
      {step === 4 && <Step4Goals />}
      {step === 5 && <Step5World />}
      {step === 6 && <Step6Needs />}
      {step === 7 && <Step7Features />}
      {step === 8 && <Step8Template />}
    </div>
  );
}
