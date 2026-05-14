import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotesToolbar } from '../NotesToolbar';

const COUNTS = { all: 10, xingce: 3, essay: 7 };

describe('NotesToolbar', () => {
  it('渲 search input + 3 source filter chips + sort select', () => {
    render(
      <NotesToolbar
        search=""
        onSearchChange={() => {}}
        sourceDomain="all"
        onSourceDomainChange={() => {}}
        sortMode="created-desc"
        onSortModeChange={() => {}}
        sourceCounts={COUNTS}
      />,
    );
    expect(screen.getByTestId('notes-toolbar-search')).toBeInTheDocument();
    expect(screen.getByTestId('notes-toolbar-source-all')).toBeInTheDocument();
    expect(screen.getByTestId('notes-toolbar-source-xingce')).toBeInTheDocument();
    expect(screen.getByTestId('notes-toolbar-source-essay')).toBeInTheDocument();
    expect(screen.getByTestId('notes-toolbar-sort')).toBeInTheDocument();
  });

  it('source filter click 触发 onSourceDomainChange', () => {
    const handle = vi.fn();
    render(
      <NotesToolbar
        search=""
        onSearchChange={() => {}}
        sourceDomain="all"
        onSourceDomainChange={handle}
        sortMode="created-desc"
        onSortModeChange={() => {}}
        sourceCounts={COUNTS}
      />,
    );
    fireEvent.click(screen.getByTestId('notes-toolbar-source-xingce'));
    expect(handle).toHaveBeenCalledWith('xingce');
  });

  it('search change 触发 onSearchChange', () => {
    const handle = vi.fn();
    render(
      <NotesToolbar
        search=""
        onSearchChange={handle}
        sourceDomain="all"
        onSourceDomainChange={() => {}}
        sortMode="created-desc"
        onSortModeChange={() => {}}
        sourceCounts={COUNTS}
      />,
    );
    fireEvent.change(screen.getByTestId('notes-toolbar-search'), {
      target: { value: '治理' },
    });
    expect(handle).toHaveBeenCalledWith('治理');
  });

  it('sort select 触发 onSortModeChange', () => {
    const handle = vi.fn();
    render(
      <NotesToolbar
        search=""
        onSearchChange={() => {}}
        sourceDomain="all"
        onSourceDomainChange={() => {}}
        sortMode="created-desc"
        onSortModeChange={handle}
        sourceCounts={COUNTS}
      />,
    );
    fireEvent.change(screen.getByTestId('notes-toolbar-sort'), {
      target: { value: 'updated-desc' },
    });
    expect(handle).toHaveBeenCalledWith('updated-desc');
  });

  it('counts 渲到 chip 内', () => {
    render(
      <NotesToolbar
        search=""
        onSearchChange={() => {}}
        sourceDomain="all"
        onSourceDomainChange={() => {}}
        sortMode="created-desc"
        onSortModeChange={() => {}}
        sourceCounts={{ all: 99, xingce: 33, essay: 66 }}
      />,
    );
    expect(screen.getByTestId('notes-toolbar-source-all')).toHaveTextContent('99');
    expect(screen.getByTestId('notes-toolbar-source-xingce')).toHaveTextContent('33');
    expect(screen.getByTestId('notes-toolbar-source-essay')).toHaveTextContent('66');
  });
});
