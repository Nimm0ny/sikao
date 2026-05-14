// Frontend Style Guide v1 (PR3) — ToastHost 转发到 components/ui/ToastHost.
//
// 历史: 本文件原是 toast host 实现 (lib 内). PR3 把规范 §5 toast primitive 落到
// components/ui/ToastHost.tsx 作为新 SSOT (跟 §5 .toast ink-1 实底 + dot + 无 close 对齐).
// 本文件保留为转发壳, 兼容 main.tsx 现有 import (`@/lib/ToastHost`);
// 后续 cleanup commit 直接 import @/components/ui/ToastHost 时删本文件.
//
// outer toast API (`toast.info / .warn / .error`) 不动, 仍在 lib/toast.ts.
//
// @deprecated import from '@sikao/ui/ui/ToastHost' instead.

export { ToastHost } from '@sikao/ui/ui/ToastHost';
