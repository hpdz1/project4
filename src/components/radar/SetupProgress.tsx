import { SETUP_STEPS, stepIndex, type SetupStepId } from "@/lib/client/setup";
import { cx } from "@/components/ui/cx";
import { CheckIcon } from "./icons";

export interface SetupProgressProps {
  current: SetupStepId;
  /** Steps the user may jump to (others render as plain text). */
  canVisit: (step: SetupStepId) => boolean;
  onSelect: (step: SetupStepId) => void;
}

/** "Step 2 of 4" progress indicator; earlier and reachable steps are buttons. */
export function SetupProgress({ current, canVisit, onSelect }: SetupProgressProps) {
  const at = stepIndex(current);
  return (
    <nav aria-label="Setup progress" className="space-y-3">
      <p className="text-sm font-semibold text-muted">
        Step {at + 1} of {SETUP_STEPS.length}
        <span className="sm:hidden">: {SETUP_STEPS[at].label}</span>
      </p>
      <ol className="grid grid-cols-4 gap-2">
        {SETUP_STEPS.map((step, i) => {
          const state = i < at ? "complete" : i === at ? "current" : "upcoming";
          const inner = (
            <>
              <span
                aria-hidden="true"
                className={cx(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                  state === "complete" && "border-accent bg-accent text-accent-contrast",
                  state === "current" && "border-accent bg-surface text-accent",
                  state === "upcoming" && "border-border-strong bg-surface text-muted",
                )}
              >
                {state === "complete" ? <CheckIcon /> : i + 1}
              </span>
              <span
                aria-hidden="true"
                className={cx(
                  "hidden text-left text-sm leading-tight sm:block",
                  state === "current" ? "font-semibold text-text" : "text-muted",
                )}
              >
                {step.label}
              </span>
              <span className="sr-only">
                {`${step.label}${state === "complete" ? " (done)" : state === "current" ? " (current step)" : ""}`}
              </span>
            </>
          );
          const bar = (
            <span
              aria-hidden="true"
              className={cx("mb-2 block h-1 rounded-full", i <= at ? "bg-accent" : "bg-border")}
            />
          );
          return (
            <li key={step.id} aria-current={state === "current" ? "step" : undefined}>
              {bar}
              {state !== "current" && canVisit(step.id) ? (
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  className="flex min-h-10 w-full items-center gap-2 rounded-lg text-left hover:bg-subtle"
                >
                  {inner}
                </button>
              ) : (
                <div className="flex min-h-10 items-center gap-2">{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
