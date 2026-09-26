/**
 * Which step of the booking a customer may stand on.
 *
 * Pure, and separate from the component, for one reason: the clamp below is
 * the thing that keeps a stepped form honest, and it is much easier to be sure
 * of as a function than as a render branch. Emptying the basket while standing
 * on "Confirm" must drop the customer back to step 1 *during that same
 * render* — doing it in an effect would flash a screen that has no data behind
 * it, and would trip React 19's set-state-in-effect rule besides.
 *
 * GLAMNET has no "choose your professional" step, which a salon marketplace
 * would put between services and time. Booking broadcasts to every eligible
 * provider and the first to accept takes the job, so offering a picker would
 * sell a choice the matching engine does not make.
 */

export const BOOKING_STEPS = ["Services", "Time", "Confirm"] as const;

export type BookingStep = 1 | 2 | 3;

export interface StepState {
  /** The step actually rendered — never beyond what the data supports. */
  activeStep: BookingStep;
  /** The furthest step currently reachable. */
  furthestStep: BookingStep;
  /** Why Continue is inert, in the customer's words. Null when it is not. */
  blockedReason: string | null;
}

export function resolveStep(input: {
  /** What the customer has navigated to; may be stale. */
  requestedStep: number;
  serviceCount: number;
  hasSlot: boolean;
}): StepState {
  const furthestStep: BookingStep = input.hasSlot
    ? 3
    : input.serviceCount > 0
      ? 2
      : 1;

  // Clamped at both ends: below 1 is nonsense, above `furthestStep` is a step
  // whose screen has nothing to show.
  const activeStep = Math.min(
    Math.max(Math.trunc(input.requestedStep) || 1, 1),
    furthestStep,
  ) as BookingStep;

  const blockedReason =
    activeStep === 1 && input.serviceCount === 0
      ? "Choose at least one service"
      : activeStep === 2 && !input.hasSlot
        ? "Pick a time to continue"
        : null;

  return { activeStep, furthestStep, blockedReason };
}
