"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TUTORIAL_STEPS,
  isTutorialDone,
  markTutorialDone,
  type TutorialStep,
} from "@/lib/demo";

interface TutorialOverlayProps {
  onHighlight?: (area: TutorialStep["highlight"] | null) => void;
}

export default function TutorialOverlay({ onHighlight }: TutorialOverlayProps) {
  const [step, setStep] = useState(() => (isTutorialDone() ? -1 : 0));
  const [visible, setVisible] = useState(() => !isTutorialDone());

  useEffect(() => {
    if (step >= 0 && step < TUTORIAL_STEPS.length) {
      onHighlight?.(TUTORIAL_STEPS[step].highlight ?? null);
    } else {
      onHighlight?.(null);
    }
  }, [step, onHighlight]);

  const advance = useCallback(() => {
    const next = step + 1;
    if (next >= TUTORIAL_STEPS.length) {
      markTutorialDone();
      setVisible(false);
      onHighlight?.(null);
      setStep(-1);
    } else {
      setStep(next);
    }
  }, [step, onHighlight]);

  const dismiss = useCallback(() => {
    markTutorialDone();
    setVisible(false);
    onHighlight?.(null);
    setStep(-1);
  }, [onHighlight]);

  if (!visible || step < 0 || step >= TUTORIAL_STEPS.length) return null;

  const current = TUTORIAL_STEPS[step];

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-4 sm:pb-6">
      <div className="w-full max-w-lg animate-[slideUp_300ms_ease-out] border border-[#0c6d1f] bg-[#030d03] p-4 shadow-[0_0_40px_rgba(0,255,65,0.12)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[8px] uppercase tracking-[0.3em] text-[#ffb000] sm:text-[9px]">
              Tutorial - Step {step + 1} of {TUTORIAL_STEPS.length}
            </div>
            <h3 className="mt-1 font-[family-name:var(--font-vt323)] text-xl tracking-[0.14em] text-[#00ff41] sm:text-2xl">
              {current.title}
            </h3>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 border border-[#0e2a0e] bg-[#021202] px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#0c6d1f] hover:border-[#0c6d1f] hover:text-[#00aa2a]"
          >
            Skip
          </button>
        </div>
        <p className="mt-3 text-xs leading-6 text-[#00cc33]">
          {current.message}
        </p>
        <div className="mt-4 flex justify-end">
          <button
            onClick={advance}
            className="border border-[#0c6d1f] bg-[rgba(0,255,65,0.05)] px-5 py-2 text-[10px] uppercase tracking-[0.24em] text-[#00ff41] hover:bg-[rgba(0,255,65,0.1)]"
          >
            {step === TUTORIAL_STEPS.length - 1 ? "Start Playing" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
