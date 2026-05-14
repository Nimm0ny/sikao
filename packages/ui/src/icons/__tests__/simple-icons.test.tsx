import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  NavPrevIcon,
  NavNextIcon,
  NavBackIcon,
  NavCloseIcon,
  NavSubmitIcon,
  NavAnswerCardIcon,
  ToolPauseIcon,
  ToolPlayIcon,
  ToolSettingsIcon,
  ToolThemeIcon,
  ToolChatIcon,
  ToolAiIcon,
  ToolScratchIcon,
  ToolPinIcon,
  ToolSearchIcon,
  ToolFilterIcon,
  ToolSortIcon,
  ToolDownloadIcon,
  ToolEyeIcon,
  ActionStarIcon,
  ActionStarFilledIcon,
  ActionMarkIcon,
  ActionNoteIcon,
  ActionNoteEditIcon,
  ActionGripIcon,
  ActionUndoIcon,
  ActionRedoIcon,
  StatusDoneIcon,
  StatusWrongIcon,
  StatusPendingIcon,
  SubjectXingceIcon,
  SubjectEssayIcon,
  SubjectWrongbookIcon,
  SubjectDashboardIcon,
  SubjectPlanIcon,
  SubjectProfileIcon,
  SubjectHomeIcon,
} from '../index';

// 1 测覆盖全部新增简单 icon 的 sanity:
//   - render without throwing
//   - default size 18 → svg width/height 18
//   - aria-hidden="true" (走 IconBtn 包装时由 button 提供 label)
//   - currentColor stroke / fill (color 由调用方 className 控制)
//
// 旧 lint:hardcode / lint:radius-token 已覆盖 token 维度. 此处只查 SVG 属性,
// 不重复.

const simpleIcons = [
  // Nav
  ['NavPrevIcon', NavPrevIcon],
  ['NavNextIcon', NavNextIcon],
  ['NavBackIcon', NavBackIcon],
  ['NavCloseIcon', NavCloseIcon],
  ['NavSubmitIcon', NavSubmitIcon],
  ['NavAnswerCardIcon', NavAnswerCardIcon],
  // Tool
  ['ToolPauseIcon', ToolPauseIcon],
  ['ToolPlayIcon', ToolPlayIcon],
  ['ToolSettingsIcon', ToolSettingsIcon],
  ['ToolThemeIcon', ToolThemeIcon],
  ['ToolChatIcon', ToolChatIcon],
  ['ToolAiIcon', ToolAiIcon],
  ['ToolScratchIcon', ToolScratchIcon],
  ['ToolPinIcon', ToolPinIcon],
  ['ToolSearchIcon', ToolSearchIcon],
  ['ToolFilterIcon', ToolFilterIcon],
  ['ToolSortIcon', ToolSortIcon],
  ['ToolDownloadIcon', ToolDownloadIcon],
  ['ToolEyeIcon', ToolEyeIcon],
  // Action
  ['ActionStarIcon', ActionStarIcon],
  ['ActionStarFilledIcon', ActionStarFilledIcon],
  ['ActionMarkIcon', ActionMarkIcon],
  ['ActionNoteIcon', ActionNoteIcon],
  ['ActionNoteEditIcon', ActionNoteEditIcon],
  ['ActionGripIcon', ActionGripIcon],
  ['ActionUndoIcon', ActionUndoIcon],
  ['ActionRedoIcon', ActionRedoIcon],
  // Status
  ['StatusDoneIcon', StatusDoneIcon],
  ['StatusWrongIcon', StatusWrongIcon],
  ['StatusPendingIcon', StatusPendingIcon],
  // Subject
  ['SubjectXingceIcon', SubjectXingceIcon],
  ['SubjectEssayIcon', SubjectEssayIcon],
  ['SubjectWrongbookIcon', SubjectWrongbookIcon],
  ['SubjectDashboardIcon', SubjectDashboardIcon],
  ['SubjectPlanIcon', SubjectPlanIcon],
  ['SubjectProfileIcon', SubjectProfileIcon],
  ['SubjectHomeIcon', SubjectHomeIcon],
] as const;

describe('SIKAO simple icons (atomic SVG)', () => {
  for (const [name, Icon] of simpleIcons) {
    it(`${name} renders default size 18 + aria-hidden`, () => {
      const { container } = render(<Icon />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('width')).toBe('18');
      expect(svg?.getAttribute('height')).toBe('18');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });
  }

  it('size prop overrides default', () => {
    const { container } = render(<NavPrevIcon size={24} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
  });

  it('className forwards to root svg', () => {
    const { container } = render(<NavCloseIcon className="text-accent" />);
    expect(container.querySelector('svg')?.classList.contains('text-accent')).toBe(
      true,
    );
  });

  it('Subject* uses stroke 1.5 (sidebar nav weight)', () => {
    const { container } = render(<SubjectHomeIcon />);
    expect(container.querySelector('svg')?.getAttribute('stroke-width')).toBe(
      '1.5',
    );
  });

  it('Nav* / Tool* / Status* uses stroke 1.4 (default)', () => {
    const cases = [NavPrevIcon, ToolPauseIcon, StatusDoneIcon];
    for (const Cmp of cases) {
      const { container } = render(<Cmp />);
      expect(container.querySelector('svg')?.getAttribute('stroke-width')).toBe(
        '1.4',
      );
    }
  });
});
