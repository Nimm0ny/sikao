import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XCloseIcon } from '@sikao/ui/icons';
import { cn } from '@sikao/shared-utils';

// Phase 6.6 fenbi-merge — 图推题图放大 lightbox.
//
// 全屏 modal, ESC 关闭, click outside 关闭. 仅显 src + alt, 不带额外控件 (旋转/
// 缩放推 follow-up). 桌面 + mobile 通用.
//
// 用法: caller 控制 src/alt 状态, 点击 stem/选项 img 时 setSrc(url).

export interface ImageLightboxProps {
  readonly src: string | null;
  readonly alt?: string;
  readonly onClose: () => void;
  readonly className?: string;
}

export function ImageLightbox({ src, alt = '题图', onClose, className }: ImageLightboxProps) {
  useEffect(() => {
    if (src === null) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose]);
  return (
    <AnimatePresence initial={false}>
      {src !== null ? (
        <motion.div
          key="img-lightbox"
          role="dialog"
          aria-label="放大题图"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center',
            'bg-sidebar/85 p-4 md:p-8',
            className,
          )}
          data-testid="image-lightbox"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭放大图"
            className={cn(
              'absolute inset-0 cursor-zoom-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
            data-testid="image-lightbox-scrim"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className={cn(
              'absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center',
              'rounded-pill bg-surface/90 text-ink shadow-card hover:bg-surface',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
            data-testid="image-lightbox-close"
          >
            <XCloseIcon className="h-5 w-5" />
          </button>
          <img
            src={src}
            alt={alt}
            className="relative max-h-[90vh] max-w-[95vw] object-contain rounded-card shadow-pop bg-surface"
            data-testid="image-lightbox-img"
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
