import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFbCurrentVisibleObserver } from '../useFbSession';
import type { FlatQuestion } from '../useFbSession';

const flatQuestions: readonly FlatQuestion[] = [
  {
    question: {
      questionId: 101,
      paperRevisionId: 'revision-a',
      sectionId: 'section-a',
      blockId: 'block-a',
      questionNo: 1,
      questionKind: 'single_choice',
      rendererKey: 'choice',
      content: { stem: 'Question 101', options: [] },
    },
    displayNo: 1,
    sectionId: 'section-a',
    sectionTitle: 'Section A',
  },
];

class StubIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = '';
  thresholds: ReadonlyArray<number> = [];
  constructor(_cb: IntersectionObserverCallback) {
    void _cb;
  }
}

class MissingQuestionIdIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe = (target: Element): void => {
    this.callback([makeIntersectionEntry(target)], this);
  };

  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn((): IntersectionObserverEntry[] => []);
}

function makeIntersectionEntry(target: Element): IntersectionObserverEntry {
  const rect = new DOMRectReadOnly();
  return {
    boundingClientRect: rect,
    intersectionRatio: 1,
    intersectionRect: rect,
    isIntersecting: true,
    rootBounds: null,
    target,
    time: 0,
  };
}

function makeQuestionCardNode(questionId: string): HTMLElement {
  const node = document.createElement('article');
  node.dataset.questionId = questionId;
  return node;
}

function MissingIntersectionObserver() {
  useFbCurrentVisibleObserver({
    flatQuestions,
    isPaused: false,
    currentQid: null,
    getQuestionCardNode: makeQuestionCardNode,
    onChange: vi.fn(),
  });
  return null;
}

function MissingQuestionIdTargetObserver() {
  useFbCurrentVisibleObserver({
    flatQuestions,
    isPaused: false,
    currentQid: null,
    getQuestionCardNode: () => document.createElement('article'),
    onChange: vi.fn(),
  });
  return null;
}

function MissingQuestionCardObserver() {
  useFbCurrentVisibleObserver({
    flatQuestions,
    isPaused: false,
    currentQid: null,
    getQuestionCardNode: () => undefined,
    onChange: vi.fn(),
  });
  return null;
}

describe('useFbCurrentVisibleObserver', () => {
  afterEach(() => {
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    delete (window as { IntersectionObserver?: unknown }).IntersectionObserver;
  });

  it('throws when IntersectionObserver is unavailable', () => {
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    delete (window as { IntersectionObserver?: unknown }).IntersectionObserver;

    expect(() => render(<MissingIntersectionObserver />)).toThrow(
      'IntersectionObserver is required for practice visible question tracking.',
    );
  });

  it('throws when an observed target is missing data-question-id', () => {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver =
      MissingQuestionIdIntersectionObserver;

    expect(() => render(<MissingQuestionIdTargetObserver />)).toThrow(
      'Visible observer target is missing data-question-id.',
    );
  });

  it('throws when a question card node is not mounted before IO observation', () => {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver =
      StubIntersectionObserver;

    expect(() => render(<MissingQuestionCardObserver />)).toThrow(
      'Question card 101 is not mounted for visible observer.',
    );
  });
});
