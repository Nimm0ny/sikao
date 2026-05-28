/*
 * peek/useCalendarPeek.ts — SIK-138 W6.
 *
 * Why: thin context-consuming hook. Throws when called outside a provider
 *      so misuse fails loudly — chip components depend on the peek state
 *      and must mount under <CalendarPeekProvider>.
 */

import { useContext } from 'react';

import { CalendarPeekContext } from './CalendarPeekContext';
import type { CalendarPeekContextValue } from './types';

export function useCalendarPeek(): CalendarPeekContextValue {
  const value = useContext(CalendarPeekContext);
  if (value === null) {
    throw new Error(
      'useCalendarPeek must be used inside a <CalendarPeekProvider>',
    );
  }
  return value;
}
