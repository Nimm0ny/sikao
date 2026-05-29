/*
 * useCalendarDragSensors tests — SIK-139 W1.
 *
 * Why: Requirement 5 (a11y) demands the drag surface ships BOTH a
 *      PointerSensor and a KeyboardSensor — keyboard reschedule must be
 *      reachable, not pointer-only. dnd-kit's sensor descriptors expose
 *      their `sensor` constructor, so we assert the set contains exactly
 *      those two sensor classes and that the pointer activation distance
 *      keeps plain clicks from being eaten as drags.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { KeyboardSensor, PointerSensor } from '@dnd-kit/core';

import {
  POINTER_ACTIVATION_DISTANCE_PX,
  useCalendarDragSensors,
} from './useCalendarDragSensors';

describe('useCalendarDragSensors (SIK-139 W1)', () => {
  it('wires both a PointerSensor and a KeyboardSensor (a11y, Requirement 5)', () => {
    const { result } = renderHook(() => useCalendarDragSensors());
    const sensorClasses = result.current.map((d) => d.sensor);
    expect(sensorClasses).toContain(PointerSensor);
    expect(sensorClasses).toContain(KeyboardSensor);
    expect(result.current).toHaveLength(2);
  });

  it('gates the PointerSensor behind a small activation distance so clicks still open the Peek', () => {
    const { result } = renderHook(() => useCalendarDragSensors());
    const pointer = result.current.find((d) => d.sensor === PointerSensor);
    expect(pointer).toBeDefined();
    expect(pointer?.options.activationConstraint).toEqual({
      distance: POINTER_ACTIVATION_DISTANCE_PX,
    });
    expect(POINTER_ACTIVATION_DISTANCE_PX).toBeGreaterThan(0);
  });
});
