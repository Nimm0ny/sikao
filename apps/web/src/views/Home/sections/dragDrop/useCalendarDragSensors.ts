/*
 * useCalendarDragSensors — SIK-139 W1.
 *
 * Why: requirements.md Requirement 5 (a11y) + design.md Decisions (2) lock
 *      the keyboard reschedule entry to dnd-kit's KeyboardSensor. The drag
 *      surface therefore needs BOTH a PointerSensor (mouse / touch / pen)
 *      and a KeyboardSensor so chip reschedule is reachable without a
 *      pointer. This factory centralizes sensor wiring so MonthGridDnd
 *      stays declarative and the sensor contract is unit-testable in
 *      isolation.
 *
 *      AGENT-H7: Wave 1 keeps the sensors pure setup — no onDragEnd side
 *      effects, no store writes. The full keyboard reschedule orchestration
 *      (arrow-step preview + Enter/Esc + aria-live) lands in Wave 4; here we
 *      only guarantee the KeyboardSensor is present and activated by
 *      Space/Enter per dnd-kit defaults.
 */
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';

import { dayCellCoordinateGetter } from './keyboardReschedule';

/**
 * PointerSensor activation distance (px). A small drag threshold keeps a
 * plain click on the chip from being swallowed as a drag, so the existing
 * onClick → Peek path (SIK-138) survives alongside draggable (visual
 * contract §2: drag and click must not be mutually exclusive).
 */
export const POINTER_ACTIVATION_DISTANCE_PX = 5;

/**
 * Build the calendar drag sensor set: PointerSensor (distance-gated so
 * clicks still open the Peek) + KeyboardSensor (a11y reschedule entry).
 * Returned shape is dnd-kit's `SensorDescriptor[]`, fed straight to
 * `<DndContext sensors={...}>`.
 *
 * SIK-139 W4: the KeyboardSensor takes a custom `coordinateGetter`
 * (`dayCellCoordinateGetter`) so arrow keys step by WHOLE DAY cells (one day
 * left/right, one week up/down) instead of dnd-kit's default fixed-pixel
 * translate, which can't reliably cross a 7-col grid cell or jump a week
 * (Requirement 5 / design.md "W4 Keyboard Reschedule Design").
 */
export function useCalendarDragSensors(): SensorDescriptor<SensorOptions>[] {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: POINTER_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: dayCellCoordinateGetter,
    }),
  );
}
