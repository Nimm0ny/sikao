/*
 * peek/CalendarPeekContext.ts — SIK-138 W6.
 *
 * Why: react-refresh/only-export-components requires component files to
 *      export only components. The context value is consumed by both the
 *      provider (which exports a component) and the hook (which doesn't),
 *      so the context lives in its own module.
 */

import { createContext } from 'react';

import type { CalendarPeekContextValue } from './types';

export const CalendarPeekContext = createContext<CalendarPeekContextValue | null>(null);
