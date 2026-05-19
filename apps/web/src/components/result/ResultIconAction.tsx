import type { ReactElement } from 'react';
import { IconBtn, Tooltip, type IconBtnSize, type IconBtnVariant } from '@sikao/ui/ui';

export interface ResultIconActionProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly size?: IconBtnSize;
  readonly variant?: IconBtnVariant;
  readonly testId?: string;
  readonly className?: string;
  readonly tooltipLabel?: string;
  readonly children: ReactElement;
}

export function ResultIconAction({
  label,
  onClick,
  disabled = false,
  size = 'sm',
  variant = 'default',
  testId,
  className,
  tooltipLabel,
  children,
}: ResultIconActionProps) {
  const button = (
    // svg-only-allow: shared result wrapper injects audited svg icon at each callsite
    <IconBtn
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      size={size}
      variant={variant}
      data-testid={testId}
      className={className}
    >
      {children}
    </IconBtn>
  );

  return (
    <Tooltip label={tooltipLabel ?? label}>
      {disabled ? <span className="inline-flex">{button}</span> : button}
    </Tooltip>
  );
}
