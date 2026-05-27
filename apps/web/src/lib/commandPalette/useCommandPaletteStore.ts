import { create } from 'zustand';

/*
 * useCommandPaletteStore — SIK-122 Topbar (cmd-k surface).
 *
 * Why: the cmd-k palette is owned at RootLayout scope but multiple
 *      surfaces need to open it (Rail cmd row + Home topbar search box,
 *      and future per-view triggers). A small zustand store lets any
 *      component fire .openPalette() without drilling props through
 *      Outlet / Workspace.
 *
 *      RootLayout reads `open` to drive <CommandPalette open={...}> and
 *      writes via setOpen(false) on close. Triggers call openPalette()
 *      to show the palette. The Ctrl/Meta+K shortcut also routes through
 *      here.
 */

interface CommandPaletteState {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly openPalette: () => void;
  readonly closePalette: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  openPalette: () => set({ open: true }),
  closePalette: () => set({ open: false }),
}));
