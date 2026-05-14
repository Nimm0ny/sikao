import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WrongBookFilters } from '../WrongBookFilters';
import type { WrongQuestionFilters } from '@sikao/api-client/apiQueries';

// Phase B.2 — subtype chip selector test 覆盖.

const baseFilters: WrongQuestionFilters = { page: 1, pageSize: 20 };

describe('WrongBookFilters · subtype chips', () => {
  it('hides subtype chips when subject=all (no narrow context)', () => {
    render(
      <WrongBookFilters
        value={baseFilters}
        onChange={vi.fn()}
        availableSubjects={['判断推理', '资料分析']}
        availableSubtypes={['图形推理', '增长率']}
        total={5}
      />,
    );
    expect(screen.queryByTestId('wrong-book-subtype-chips')).not.toBeInTheDocument();
  });

  it('shows subtype chips when a subject is selected', () => {
    render(
      <WrongBookFilters
        value={{ ...baseFilters, subject: '判断推理' }}
        onChange={vi.fn()}
        availableSubjects={['判断推理']}
        availableSubtypes={['图形推理', '逻辑判断']}
        total={3}
      />,
    );
    expect(screen.getByTestId('wrong-book-subtype-chips')).toBeInTheDocument();
    expect(screen.getByTestId('wrong-book-subtype-图形推理')).toBeInTheDocument();
    expect(screen.getByTestId('wrong-book-subtype-逻辑判断')).toBeInTheDocument();
  });

  it('clicking a subtype chip emits filter with that subtype + page=1', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <WrongBookFilters
        value={{ ...baseFilters, subject: '判断推理', page: 3 }}
        onChange={onChange}
        availableSubjects={['判断推理']}
        availableSubtypes={['图形推理']}
        total={1}
      />,
    );
    await user.click(screen.getByTestId('wrong-book-subtype-图形推理'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '判断推理',
        subtype: '图形推理',
        page: 1, // pagination resets when filter changes
      }),
    );
  });

  it('clicking the active subtype chip clears it (toggle off)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <WrongBookFilters
        value={{ ...baseFilters, subject: '判断推理', subtype: '图形推理' }}
        onChange={onChange}
        availableSubjects={['判断推理']}
        availableSubtypes={['图形推理']}
        total={1}
      />,
    );
    await user.click(screen.getByTestId('wrong-book-subtype-图形推理'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ subtype: undefined }),
    );
  });

  it('changing subject clears any selected subtype', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <WrongBookFilters
        value={{ ...baseFilters, subject: '判断推理', subtype: '图形推理' }}
        onChange={onChange}
        availableSubjects={['判断推理', '资料分析']}
        availableSubtypes={['图形推理']}
        total={1}
      />,
    );
    // Click the "资料分析" subject pipe
    await user.click(screen.getByText('资料分析'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '资料分析',
        subtype: undefined, // cleared on subject change
      }),
    );
  });
});
