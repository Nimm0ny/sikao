import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { cn } from '@sikao/shared-utils';

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

type TooltipTriggerProps = {
  readonly 'aria-describedby'?: string;
  readonly onBlur?: (event: FocusEvent) => void;
  readonly onFocus?: (event: FocusEvent) => void;
  readonly onKeyDown?: (event: ReactKeyboardEvent) => void;
  readonly onMouseEnter?: (event: MouseEvent) => void;
  readonly onMouseLeave?: (event: MouseEvent) => void;
};

export interface TooltipProps {
  readonly label: string;
  readonly side?: TooltipSide;
  readonly children: ReactElement<TooltipTriggerProps>;
}

const POSITION: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  bottom: 'left-1/2 top-full mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
};

const TOOLTIP_CLASS =
  'pointer-events-none absolute z-50 whitespace-nowrap rounded-tiny bg-ink ' +
  'px-2 py-1 text-xs font-medium text-white shadow-pop';

export function Tooltip({ label, side = 'top', children }: TooltipProps) {
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);

  if (!isValidElement(children)) {
    throw new Error('Tooltip expects a single React element child.');
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const hideOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', hideOnEscape);
    return () => document.removeEventListener('keydown', hideOnEscape);
  }, [isOpen]);

  const trigger = cloneElement(children, {
    'aria-describedby': isOpen ? tooltipId : undefined,
    onBlur: (event: FocusEvent) => {
      children.props.onBlur?.(event);
      setIsOpen(false);
    },
    onFocus: (event: FocusEvent) => {
      children.props.onFocus?.(event);
      setIsOpen(true);
    },
    onKeyDown: (event: ReactKeyboardEvent) => {
      children.props.onKeyDown?.(event);
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    },
    onMouseEnter: (event: MouseEvent) => {
      children.props.onMouseEnter?.(event);
      setIsOpen(true);
    },
    onMouseLeave: (event: MouseEvent) => {
      children.props.onMouseLeave?.(event);
      setIsOpen(false);
    },
  });

  return (
    <span className="relative inline-flex">
      {trigger}
      {isOpen ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(TOOLTIP_CLASS, POSITION[side])}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
