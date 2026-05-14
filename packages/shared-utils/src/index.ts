// @sikao/shared-utils — barrel
// 通用工具: cn / logger / toast / motion / timing / retry / 设备 hooks
export * from './cn';
export * from './logger';
export * from './toast';
export * from './motion';
export * from './timing';
export * from './queryRetry';
export * from './isAuthError';
export * from './useReducedMotion';
export * from './silent-refresh';
// ToastHost: 仅作向后兼容转发 (实际 SSOT 在 @sikao/ui/ui/ToastHost)
export { ToastHost } from './ToastHost';

// hooks 子目录单独命名空间。使用者可 `import { useDevice } from '@sikao/shared-utils/hooks/useDevice'`
// 高频 hook 也从顶层 re-export，保持与 new_web 调用习惯一致
export { useDevice } from './hooks/useDevice';
export { useOrientation } from './hooks/useOrientation';
export { useOnline } from './hooks/useOnline';
export { useLongPress } from './hooks/useLongPress';
export { useSwipeAction } from './hooks/useSwipeAction';
export { usePullToRefresh } from './hooks/usePullToRefresh';
export { useInputMode } from './hooks/useInputMode';
export { useTweaks } from './hooks/useTweaks';
export { useScrollSpyTab } from './hooks/useScrollSpyTab';
