"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import type { WizardAnswers } from "@/lib/schema";
import { TOTAL_STEPS } from "@/lib/schema";

type WizardState = {
  step: number;
  answers: Partial<WizardAnswers>;
};

type WizardContextValue = WizardState & {
  totalSteps: number;
  patch: (fields: Partial<WizardAnswers>) => void;
  setStep: (step: number) => void;
  next: () => void;
  back: () => void;
  reset: () => void;
};

const Ctx = React.createContext<WizardContextValue | null>(null);

const storageKey = (userId: string) => `eac:wizard:${userId}`;

type Props = {
  userId: string;
  initialAnswers?: Partial<WizardAnswers>;
  children: React.ReactNode;
};

export function WizardProvider({ userId, initialAnswers, children }: Props) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    answers: initialAnswers ?? {},
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.step === "number" && parsed.answers) {
          setState({
            step: Math.max(1, Math.min(TOTAL_STEPS, parsed.step)),
            answers: { ...(initialAnswers ?? {}), ...parsed.answers },
          });
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(state));
    } catch {
      // ignore quota / security errors
    }
  }, [state, userId, hydrated]);

  const patch = useCallback((fields: Partial<WizardAnswers>) => {
    setState((s) => ({ ...s, answers: { ...s.answers, ...fields } }));
  }, []);

  const setStep = useCallback((step: number) => {
    setState((s) => ({
      ...s,
      step: Math.max(1, Math.min(TOTAL_STEPS, step)),
    }));
  }, []);

  const next = useCallback(() => {
    setState((s) => ({ ...s, step: Math.min(TOTAL_STEPS, s.step + 1) }));
  }, []);

  const back = useCallback(() => {
    setState((s) => ({ ...s, step: Math.max(1, s.step - 1) }));
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(userId));
    } catch {}
    setState({ step: 1, answers: {} });
  }, [userId]);

  return (
    <Ctx.Provider
      value={{
        step: state.step,
        answers: state.answers,
        totalSteps: TOTAL_STEPS,
        patch,
        setStep,
        next,
        back,
        reset,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWizard() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useWizard must be used inside WizardProvider");
  return ctx;
}
