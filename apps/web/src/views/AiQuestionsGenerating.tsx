// lint-allow-ui-copy: runtime waiting page copy is temporary for SIK-28.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Banner } from '../components/overlay';
import { Button } from '../components/form/Button';
import { useGenerateAiQuestions } from '@sikao/api-client/queries/aiQuestionsQueries';
import { useCreatePracticeSession } from '@sikao/api-client/queries/sessionQueries';
import { useSessionConfigStore } from '@sikao/domain';
import styles from './AiQuestionsGenerating.module.css';

type Phase = 'analyzing' | 'rewriting' | 'auditing' | 'done' | 'failed';
type GenerateConfig = {
  readonly type: 'xingce' | 'essay';
  readonly categoryL1?: string;
  readonly categoryL2?: string;
  readonly yearRange: 'all' | 'recent_3' | 'recent_5' | 'recent_10';
  readonly difficultyRange: [number, number];
  readonly count: 5 | 10 | 15 | 20 | 30;
  readonly excludeAlreadyDone: boolean;
  readonly onlyWrong: boolean;
  readonly practiceMode: 'per_question' | 'full_set';
};

type ParseResult =
  | { readonly ok: true; readonly config: GenerateConfig }
  | { readonly ok: false; readonly error: string };

const ANALYZING_MESSAGE = '分析弱项...';
const REWRITING_MESSAGE = '改编题目...';
const AUDITING_MESSAGE = '审校质量...';
const VALID_YEAR_RANGES = ['all', 'recent_3', 'recent_5', 'recent_10'] as const;
const VALID_COUNTS = [5, 10, 15, 20, 30] as const;
const VALID_PRACTICE_MODES = ['per_question', 'full_set'] as const;
const generateRunCache = new Map<string, Promise<{ requestId: number }>>();
const sessionRunCache = new Map<string, Promise<{ id: number }>>();

function parseBoolean(
  value: string | null,
  fallback: boolean,
  name: string,
): { readonly ok: true; readonly value: boolean } | { readonly ok: false; readonly error: string } {
  if (value === null) {
    return { ok: true, value: fallback };
  }
  if (value === 'true' || value === 'false') {
    return { ok: true, value: value === 'true' };
  }
  return { ok: false, error: `${name} must be true or false` };
}

function parseEnum<T extends string>(
  value: string | null,
  validValues: readonly T[],
  fallback: T,
  name: string,
): { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string } {
  const nextValue = value ?? fallback;
  if (validValues.includes(nextValue as T)) {
    return { ok: true, value: nextValue as T };
  }
  return { ok: false, error: `${name} is invalid` };
}

function parseNumber(
  value: string | null,
  fallback: number,
  name: string,
): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly error: string } {
  if (value !== null && value.trim() === '') {
    return { ok: false, error: `${name} must be a finite number` };
  }
  const parsed = value === null ? fallback : Number(value);
  if (Number.isFinite(parsed)) {
    return { ok: true, value: parsed };
  }
  return { ok: false, error: `${name} must be a finite number` };
}

function parseCount(
  value: string | null,
): { readonly ok: true; readonly value: GenerateConfig['count'] } | { readonly ok: false; readonly error: string } {
  const parsed = parseNumber(value, 10, 'count');
  if (!parsed.ok) return parsed;
  if (VALID_COUNTS.includes(parsed.value as GenerateConfig['count'])) {
    return { ok: true, value: parsed.value as GenerateConfig['count'] };
  }
  return { ok: false, error: 'count must be one of 5, 10, 15, 20, 30' };
}

function parseDifficulty(
  value: string | null,
  fallback: number,
  name: string,
): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly error: string } {
  const parsed = parseNumber(value, fallback, name);
  if (!parsed.ok) return parsed;
  if (parsed.value >= 0 && parsed.value <= 1) {
    return { ok: true, value: parsed.value };
  }
  return { ok: false, error: `${name} must be between 0 and 1` };
}

function parseConfig(searchParams: URLSearchParams): ParseResult {
  const type = searchParams.get('type');
  if (type !== 'xingce' && type !== 'essay') {
    return { ok: false, error: 'type must be xingce or essay' };
  }

  const yearRange = parseEnum(
    searchParams.get('yearRange'),
    VALID_YEAR_RANGES,
    'recent_3',
    'yearRange',
  );
  if (!yearRange.ok) return yearRange;

  const practiceMode = parseEnum(
    searchParams.get('practiceMode'),
    VALID_PRACTICE_MODES,
    'full_set',
    'practiceMode',
  );
  if (!practiceMode.ok) return practiceMode;

  const count = parseCount(searchParams.get('count'));
  if (!count.ok) return count;

  const difficultyMin = parseDifficulty(searchParams.get('difficultyMin'), 0, 'difficultyMin');
  if (!difficultyMin.ok) return difficultyMin;

  const difficultyMax = parseDifficulty(searchParams.get('difficultyMax'), 1, 'difficultyMax');
  if (!difficultyMax.ok) return difficultyMax;

  if (difficultyMin.value > difficultyMax.value) {
    return { ok: false, error: 'difficultyMin must be less than or equal to difficultyMax' };
  }

  const excludeAlreadyDone = parseBoolean(
    searchParams.get('excludeDone'),
    true,
    'excludeDone',
  );
  if (!excludeAlreadyDone.ok) return excludeAlreadyDone;

  const onlyWrong = parseBoolean(searchParams.get('onlyWrong'), false, 'onlyWrong');
  if (!onlyWrong.ok) return onlyWrong;

  return {
    ok: true,
    config: {
      type,
      categoryL1: searchParams.get('categoryL1') || undefined,
      categoryL2: searchParams.get('categoryL2') || undefined,
      yearRange: yearRange.value,
      difficultyRange: [difficultyMin.value, difficultyMax.value],
      count: count.value,
      excludeAlreadyDone: excludeAlreadyDone.value,
      onlyWrong: onlyWrong.value,
      practiceMode: practiceMode.value,
    },
  };
}

function buildRunKey(config: GenerateConfig): string {
  return [
    config.type,
    config.categoryL1 ?? '',
    config.categoryL2 ?? '',
    config.yearRange,
    `${config.difficultyRange[0]}:${config.difficultyRange[1]}`,
    String(config.count),
    config.excludeAlreadyDone ? 'exclude' : 'include',
    config.onlyWrong ? 'wrong' : 'all',
    config.practiceMode,
  ].join('|');
}

function getOrStartRun<T>(cache: Map<string, Promise<T>>, key: string, factory: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const promise = factory().finally(() => {
    cache.delete(key);
  });
  cache.set(key, promise);
  return promise;
}

function renderFailureCard(
  description: string,
  navigate: ReturnType<typeof useNavigate>,
) {
  return (
    <div className={styles.root} data-testid="ai-questions-generating-view">
      <div className={styles.card}>
        <div className={styles.title}>AI 出题失败</div>
        <Banner variant="warn" title="AI 出题失败" description={description} />
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => navigate('/practice')}>返回练习中心</Button>
          <Button variant="primary" onClick={() => navigate('/practice')}>切回真题</Button>
        </div>
      </div>
    </div>
  );
}

export function AiQuestionsGenerating() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const configKey = searchParams.toString();
  const parsedConfig = useMemo(
    () => parseConfig(new URLSearchParams(configKey)),
    [configKey],
  );
  const generate = useGenerateAiQuestions();
  const createSession = useCreatePracticeSession();
  const [phase, setPhase] = useState<Phase>('analyzing');
  const [message, setMessage] = useState(ANALYZING_MESSAGE);
  const generateRef = useRef(generate);
  const createSessionRef = useRef(createSession);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    generateRef.current = generate;
  }, [generate]);

  useEffect(() => {
    createSessionRef.current = createSession;
  }, [createSession]);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    if (!parsedConfig.ok) {
      return;
    }

    const config = parsedConfig.config;
    const runKey = buildRunKey(config);
    let cancelled = false;
    let timeoutId: number | null = null;

    async function run() {
      try {
        setPhase('analyzing');
        setMessage(ANALYZING_MESSAGE);
        const generated = await getOrStartRun(generateRunCache, runKey, () =>
          generateRef.current.mutateAsync({
            payload: { config },
            idempotencyKey: `ai-generate:${runKey}`,
          }) as Promise<{ requestId: number }>,
        );
        if (cancelled) return;

        setPhase('rewriting');
        setMessage(REWRITING_MESSAGE);
        const session = await getOrStartRun(sessionRunCache, runKey, () =>
          createSessionRef.current.mutateAsync({
            track: config.type,
            entryKind: 'ai_questions',
            mode: 'ai_generated',
            practiceMode: config.practiceMode,
            config: { aiRequestId: generated.requestId },
          }) as Promise<{ id: number }>,
        );
        if (cancelled) return;

        await useSessionConfigStore.getState().patchDefaults({
          lastUsedSourceMode: 'ai_generated',
          lastUsedYearRange: config.yearRange,
          lastUsedDifficultyRange: config.difficultyRange,
          lastUsedCount: config.count,
          lastUsedPracticeMode: config.practiceMode,
          lastUsedExcludeDone: config.excludeAlreadyDone,
          lastUsedOnlyWrong: config.onlyWrong,
        });
        if (cancelled) return;

        setPhase('auditing');
        setMessage(AUDITING_MESSAGE);
        timeoutId = window.setTimeout(() => {
          if (cancelled) return;
          setPhase('done');
          navigateRef.current(`/practice/sessions/${session.id}`, { replace: true });
        }, 200);
      } catch (error) {
        if (cancelled) return;
        setPhase('failed');
        setMessage(String(error));
      }
    }

    void run();
    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [parsedConfig]);

  const steps = [
    { key: 'analyzing', label: '分析弱项' },
    { key: 'rewriting', label: '改编题目' },
    { key: 'auditing', label: '审校质量' },
  ] as const;

  if (!parsedConfig.ok) {
    return renderFailureCard(parsedConfig.error, navigate);
  }

  if (phase === 'failed') {
    return renderFailureCard(message, navigate);
  }

  return (
    <div className={styles.root} data-testid="ai-questions-generating-view">
      <div className={styles.card}>
        <div className={styles.title}>AI 出题准备中</div>
        <div className={styles.meta}>{message}</div>
        <div className={styles.steps} aria-live="polite">
          {steps.map((step) => (
            <div key={step.key} className={styles.step} data-active={phase === step.key || undefined}>
              <span>{step.label}</span>
              <span>{phase === step.key ? '进行中' : '待命'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
