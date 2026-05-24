import { useState } from 'react';
import { Modal } from '../Modal';

/*
 * ConfirmDialog — V5 D.3.22 overlay (skeleton).
 *
 * Why: enforced-pattern second-confirmation surface for irreversible
 *      operations (交卷 / 退出考试 / 删除笔记 / 注销账号). Per spec §D.3.22
 *      this is a "快捷封装" that wraps Modal — we MUST NOT re-implement
 *      dialog chrome; instead we delegate to Modal.primaryAction /
 *      secondaryAction so a11y wiring, scroll lock, FocusTrap stay
 *      consistent.
 *
 *      destructive=true forces the confirm button to `variant='danger'`
 *      AND disables overlay click-to-close (the user MUST press a button).
 *      destructive=false uses `variant='primary'` and leaves overlay click
 *      enabled (the default Modal behavior).
 *
 *      onConfirm may return Promise<void>. When it does, we set internal
 *      loading state, await the promise, and onClose on resolution. On
 *      rejection we still onClose (and re-throw so callers can observe).
 *      External `loading` prop has priority over internal state.
 */

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description: string;
  readonly confirmText: string;
  readonly cancelText?: string;
  readonly destructive?: boolean;
  readonly onConfirm: () => void | Promise<void>;
  readonly loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmText,
  cancelText = '取消',
  destructive = false,
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const effectiveLoading = loading ?? internalLoading;

  const handleConfirm = () => {
    if (effectiveLoading) return;
    let result: void | Promise<void>;
    try {
      result = onConfirm();
    } catch (err) {
      onClose();
      throw err;
    }
    if (result !== undefined && typeof (result as Promise<void>).then === 'function') {
      setInternalLoading(true);
      (result as Promise<void>)
        .then(() => {
          setInternalLoading(false);
          onClose();
        })
        .catch((err: unknown) => {
          setInternalLoading(false);
          onClose();
          // Surface failure to caller-installed handlers; do not swallow.
          throw err;
        });
      return;
    }
    onClose();
  };

  const handleCancel = () => {
    if (effectiveLoading) return;
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      closeOnOverlay={!destructive}
      primaryAction={{
        label: effectiveLoading ? '处理中…' : confirmText,
        onClick: handleConfirm,
        variant: destructive ? 'danger' : 'primary',
      }}
      secondaryAction={{ label: cancelText, onClick: handleCancel }}
    />
  );
}
