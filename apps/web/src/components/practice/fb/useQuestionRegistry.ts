import { useCallback, useRef } from 'react';

export interface QuestionRegistryEntry {
  readonly questionId: string;
  readonly node: HTMLElement;
  readonly scrollTo: () => void;
}

export interface QuestionRegistry {
  readonly registerQuestion: (entry: QuestionRegistryEntry) => void;
  readonly unregisterQuestion: (questionId: string) => void;
  readonly getQuestionNode: (questionId: string) => HTMLElement | undefined;
  readonly scrollToQuestion: (questionId: string) => void;
}

export function useQuestionRegistry(): QuestionRegistry {
  const entries = useRef(new Map<string, QuestionRegistryEntry>());

  const registerQuestion = useCallback((entry: QuestionRegistryEntry) => {
    entries.current.set(entry.questionId, entry);
  }, []);

  const unregisterQuestion = useCallback((questionId: string) => {
    entries.current.delete(questionId);
  }, []);

  const getQuestionNode = useCallback((questionId: string) => {
    return entries.current.get(questionId)?.node;
  }, []);

  const scrollToQuestion = useCallback((questionId: string) => {
    const entry = entries.current.get(questionId);
    if (entry === undefined) {
      throw new Error(`Question ${questionId} is not registered.`);
    }
    entry.scrollTo();
  }, []);

  return { registerQuestion, unregisterQuestion, getQuestionNode, scrollToQuestion };
}
