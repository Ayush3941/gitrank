import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

const steps = [
  { key: "sign-in", label: "Sign in" },
  { key: "connect", label: "Connect GitHub" },
  { key: "analyze", label: "Analyze evidence" },
  { key: "reveal", label: "Reveal profile" },
] as const;

export type OnboardingStepKey = (typeof steps)[number]["key"];

export function OnboardingStepper({
  currentStep,
  className,
}: {
  currentStep: OnboardingStepKey;
  className?: string;
}) {
  const currentIndex = steps.findIndex((step) => step.key === currentStep);

  return (
    <nav aria-label="Onboarding progress" className={cn("w-full", className)}>
      <ol className="scrollbar-thin flex w-full items-center gap-2 overflow-x-auto pb-1 sm:gap-3">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isDone = index < currentIndex;
          return (
            <li key={step.key} aria-current={isCurrent ? "step" : undefined} className="min-w-0 flex-1">
              <div
                className={cn(
                  "flex min-w-[9rem] items-center gap-2 border px-3 py-2 text-sm font-medium",
                  isDone
                    ? "neon-chip neon-chip-success border-emerald-300/40 text-emerald-50"
                    : isCurrent
                      ? "neon-chip neon-chip-info border-cyan-300/40 text-cyan-100"
                      : "neon-chip neon-chip-muted text-slate-300",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <span className="neon-track inline-flex h-5 w-5 shrink-0 items-center justify-center text-xs font-semibold">
                    {index + 1}
                  </span>
                )}
                <span className="truncate">{step.label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
