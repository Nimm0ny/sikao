import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { ExamShell } from '../ExamShell';
import { ScratchPanel } from '../panels/ScratchPanel';
import { PrestartModal } from '../modals/PrestartModal';
import { SubmitDialog } from '../modals/SubmitDialog';
import { useExamSession } from '../hooks/useExamSession';
import { mockPaper } from '../data/essayExamMock';

afterEach(() => {
  cleanup();
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  useExamSession.setState({
    paper: null,
    phase: 'prestart',
    currentQ: 0,
    textsByQ: [],
    elapsedByQ: [],
    warned5min: {},
    scratch: '',
    highlights: {},
    leftMode: 'normal',
    leftWidthPx: 320,
    matIdx: 0,
    drawerOpen: false,
    overview: false,
    marking: false,
    query: '',
    fontSize: 15,
    gridFontSize: 18,
    rightOpen: true,
    celebrateQ: -1,
    warnToastQ: -1,
  });
});

function setup(phase: 'prestart' | 'running' | 'paused' | 'submitted' = 'prestart') {
  useExamSession.getState().hydrate(mockPaper);
  useExamSession.setState({ phase });
}

describe('PrestartModal (PR6 F6.1)', () => {
  it('disables 开始作答 during the 3s read countdown', () => {
    render(
      <PrestartModal
        question={mockPaper.questions[0]}
        onStart={() => {}}
        onPreview={() => {}}
      />,
    );
    const startBtn = screen.getByTestId('exam-prestart-start-btn');
    expect(startBtn).toBeDisabled();
    expect(startBtn).toHaveTextContent(/请阅读… 3s/);
  });

  it('mounts in ExamShell when phase=prestart', () => {
    setup('prestart');
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    expect(screen.getByTestId('exam-prestart-modal')).toBeInTheDocument();
  });

  it('exposes role=dialog + aria-modal + labelledby and focuses the safe action', () => {
    render(
      <PrestartModal
        question={mockPaper.questions[0]}
        onStart={() => {}}
        onPreview={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    if (labelId) {
      // labelled by the question title (not the eyebrow)
      expect(document.getElementById(labelId)?.textContent).toBe(mockPaper.questions[0].title);
    }
    expect(screen.getByTestId('exam-prestart-preview-btn')).toHaveFocus();
  });

  it('shows max-only word limits without minimum wording', () => {
    render(
      <PrestartModal
        question={{
          ...mockPaper.questions[0],
          minWords: undefined,
          maxWords: 300,
          requirements: ['要求全面准确', '不超过 300 字'],
        }}
        onStart={() => {}}
        onPreview={() => {}}
      />,
    );

    const modal = screen.getByTestId('exam-prestart-modal');
    expect(modal).toHaveTextContent('不超过 300 字');
    expect(modal).not.toHaveTextContent('不少于 300 字');
  });
});

describe('SubmitDialog (PR6 F6.3)', () => {
  it('shows 字数 / 剩余时间 + warns when 字数 short of target', () => {
    render(
      <SubmitDialog
        written={120}
        minWords={200}
        remaining={300}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByTestId('exam-submit-dialog-words')).toHaveTextContent('120');
    expect(screen.getByTestId('exam-submit-dialog-words')).toHaveTextContent('/ 200');
    expect(screen.getByTestId('exam-submit-dialog-warn')).toHaveTextContent('还差 80 字');
  });

  it('hides the warn block once 字数 reaches the target', () => {
    render(
      <SubmitDialog
        written={250}
        minWords={200}
        remaining={300}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByTestId('exam-submit-dialog-warn')).not.toBeInTheDocument();
  });

  it('does not warn about short words when only maxWords exists', () => {
    render(
      <SubmitDialog
        written={120}
        maxWords={300}
        remaining={300}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByTestId('exam-submit-dialog-words')).toHaveTextContent('120');
    expect(screen.getByTestId('exam-submit-dialog-words')).toHaveTextContent('/ 300');
    expect(screen.queryByTestId('exam-submit-dialog-warn')).not.toBeInTheDocument();
  });

  it('fires onConfirm via 确认交卷 click', async () => {
    const user = userEvent.setup();
    let confirmed = false;
    render(
      <SubmitDialog
        written={250}
        minWords={200}
        remaining={300}
        onCancel={() => {}}
        onConfirm={() => { confirmed = true; }}
      />,
    );
    await user.click(screen.getByTestId('exam-submit-dialog-confirm'));
    expect(confirmed).toBe(true);
  });

  it('exposes role=dialog + aria-modal and focuses 再检查 (safer default)', () => {
    render(
      <SubmitDialog
        written={120}
        minWords={200}
        remaining={300}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByTestId('exam-submit-dialog-cancel')).toHaveFocus();
  });

  it('guards onConfirm against double-click — only fires once + flips to 提交中…', async () => {
    const user = userEvent.setup();
    let confirmCount = 0;
    render(
      <SubmitDialog
        written={250}
        minWords={200}
        remaining={300}
        onCancel={() => {}}
        onConfirm={() => { confirmCount += 1; }}
      />,
    );
    const btn = screen.getByTestId('exam-submit-dialog-confirm');
    await user.click(btn);
    await user.click(btn);
    await user.click(btn);
    expect(confirmCount).toBe(1);
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('提交中…');
  });

  it('PR3 D7=B 拦截: 有未答题时列题号 + 红底"提交未答题"', () => {
    render(
      <SubmitDialog
        written={250}
        minWords={200}
        remaining={300}
        unansweredQuestionNumbers={['第二题', '第四题']}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    const banner = screen.getByTestId('exam-submit-dialog-unanswered');
    expect(banner).toHaveTextContent('以下题目未作答');
    expect(banner).toHaveTextContent('第二题 / 第四题');
    expect(banner).toHaveAttribute('role', 'alert');
    // banner 不再含"弃考"措辞 (PR3 review P1 #8 — 备考同伴调性)
    expect(banner).not.toHaveTextContent('弃考');
    const confirmBtn = screen.getByTestId('exam-submit-dialog-confirm');
    expect(confirmBtn).toHaveTextContent('提交未答题');
    // 红底视觉警示 (--danger token) 保留 — banner 信息密度有价值
    expect(confirmBtn.className).toContain('bg-err');
  });

  it('PR3 D7=B 不传 unansweredQuestionNumbers → 维持原"确认交卷" 黑底 (单题路径)', () => {
    render(
      <SubmitDialog
        written={250}
        minWords={200}
        remaining={300}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByTestId('exam-submit-dialog-unanswered')).not.toBeInTheDocument();
    const confirmBtn = screen.getByTestId('exam-submit-dialog-confirm');
    expect(confirmBtn).toHaveTextContent('确认交卷');
    expect(confirmBtn.className).toContain('bg-ink');
  });

  it('PR3 D7=B unansweredQuestionNumbers 空数组 → 也维持 "确认交卷" (没未答相当于全答了)', () => {
    render(
      <SubmitDialog
        written={250}
        minWords={200}
        remaining={300}
        unansweredQuestionNumbers={[]}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByTestId('exam-submit-dialog-unanswered')).not.toBeInTheDocument();
    expect(screen.getByTestId('exam-submit-dialog-confirm')).toHaveTextContent('确认交卷');
  });
});

describe('PausedOverlay (PR6 F6.2)', () => {
  it('mounts when phase=paused and resume button flips back to running', async () => {
    const user = userEvent.setup();
    setup('paused');
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    expect(screen.getByTestId('exam-paused-overlay')).toBeInTheDocument();
    await user.click(screen.getByTestId('exam-paused-resume-btn'));
    expect(useExamSession.getState().phase).toBe('running');
  });

  it('exposes role=dialog + aria-modal and auto-focuses 继续答题', () => {
    setup('paused');
    renderWithProviders(<ExamShell onSubmit={() => {}} />);
    const overlay = screen.getByTestId('exam-paused-overlay');
    expect(overlay).toHaveAttribute('role', 'dialog');
    expect(overlay).toHaveAttribute('aria-modal', 'true');
    expect(overlay.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByTestId('exam-paused-resume-btn')).toHaveFocus();
  });
});

describe('ScratchPanel (PR6 F5)', () => {
  it('shows char count and the 导入答题卡 button when scratch has content', () => {
    setup('running');
    useExamSession.setState({ scratch: '立意 · 分论点' });
    renderWithProviders(<ScratchPanel />);
    expect(screen.getByTestId('exam-scratch-charcount')).toHaveTextContent('字');
    expect(screen.getByTestId('exam-scratch-import-btn')).toBeInTheDocument();
  });

  it('appends scratch to the active question text on import click', async () => {
    const user = userEvent.setup();
    setup('running');
    useExamSession.getState().setCurrentQ(0);
    useExamSession.setState({ scratch: '立意一\n立意二' });
    renderWithProviders(<ScratchPanel />);
    await user.click(screen.getByTestId('exam-scratch-import-btn'));
    const text = useExamSession.getState().textsByQ[0];
    expect(text).toContain('　　立意一');
    expect(text).toContain('　　立意二');
  });

  it('clear button empties scratch', async () => {
    const user = userEvent.setup();
    setup('running');
    useExamSession.setState({ scratch: '一些笔记' });
    renderWithProviders(<ScratchPanel />);
    await user.click(screen.getByTestId('exam-scratch-clear-btn'));
    expect(useExamSession.getState().scratch).toBe('');
  });

  it('drop appends to scratch when nothing is focused', () => {
    setup('running');
    renderWithProviders(<ScratchPanel />);
    const dropArea = screen.getByTestId('exam-scratch-droparea');
    // jsdom doesn't ship a DataTransfer constructor — stub the small surface
    // ScratchPanel.onDrop reads (types[] + getData('text/plain')).
    const data = {
      types: ['text/plain'],
      getData: () => '「划线段」',
      setData: () => {},
      dropEffect: 'copy',
      effectAllowed: 'copy',
    };
    const evt = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(evt, 'dataTransfer', { value: data });
    act(() => {
      dropArea.dispatchEvent(evt);
    });
    expect(useExamSession.getState().scratch).toContain('「划线段」');
  });
});
