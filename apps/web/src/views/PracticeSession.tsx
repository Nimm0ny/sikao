// lint-allow-ui-copy: runtime session shell copy is temporary for SIK-28.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { AnswerSheet } from '../components/business/AnswerSheet';
import type { AnswerSheetQuestion } from '../components/business/AnswerSheet';
import { OptionItem } from '../components/business/OptionItem';
import { QuestionStem } from '../components/business/QuestionStem';
import { TimerDisplay } from '../components/business/TimerDisplay';
import { Badge, EmptyState, Skeleton } from '../components/atom';
import { Button } from '../components/form/Button';
import { Banner } from '../components/overlay';
import { ExamLayout } from '../layouts/ExamLayout';
import { fetchPracticeQuestionDetail } from '@sikao/api-client/queries/practiceQuestionQueries';
import { useFlagPracticeSessionAnswer, usePracticeSession, useSavePracticeSessionAnswers } from '@sikao/api-client/queries/sessionQueries';
import { usePracticeSessionCountdown, usePracticeSessionHeartbeat, usePracticeSessionLifecycle, useStartPracticeSession, useSubmitPracticeSession } from '@sikao/api-client/queries/sessionRuntimeQueries';
import type { PracticeSessionItemV2 } from '@sikao/api-client/types/practice';
import { useHeartbeatLoop } from '@sikao/domain/practice/useHeartbeatLoop';
import styles from './PracticeSession.module.css';

function buildHydratedAnswers(items: readonly PracticeSessionItemV2[]): Record<string, string[]> {
  const nextAnswers: Record<string, string[]> = {};
  for (const item of items) {
    if (item.selectedAnswerKeys.length > 0) {
      nextAnswers[item.questionKey] = [...item.selectedAnswerKeys];
      continue;
    }
    if (item.answerText !== null && item.answerText !== undefined) {
      nextAnswers[item.questionKey] = [item.answerText];
    }
  }
  return nextAnswers;
}

function hasLocalAnswer(
  item: Pick<PracticeSessionItemV2, 'answerKind' | 'questionKey'>,
  answers: Readonly<Record<string, string[]>>,
): boolean {
  const localAnswer = answers[item.questionKey];
  if (!localAnswer || localAnswer.length === 0) {
    return false;
  }
  if (item.answerKind === 'essay') {
    return localAnswer.some((value) => value.trim().length > 0);
  }
  return localAnswer.length > 0;
}

function hasLocalOverride(
  questionKey: string,
  answers: Readonly<Record<string, string[]>>,
): boolean {
  return Object.prototype.hasOwnProperty.call(answers, questionKey);
}

export function PracticeSession() {
  const navigate = useNavigate();
  const params = useParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);
  const sessionQuery = usePracticeSession(sessionId);
  const lifecycleQuery = usePracticeSessionLifecycle(sessionId);
  const countdownQuery = usePracticeSessionCountdown(sessionId);
  const startSession = useStartPracticeSession();
  const saveAnswers = useSavePracticeSessionAnswers();
  const flagAnswer = useFlagPracticeSessionAnswer();
  const submitSession = useSubmitPracticeSession();
  const heartbeat = usePracticeSessionHeartbeat();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const startSessionRef = useRef(startSession);
  const startedSessionIdRef = useRef<number | null>(null);
  const hydratedSessionIdRef = useRef<number | null>(null);

  useEffect(() => {
    startSessionRef.current = startSession;
  }, [startSession]);

  const questionIds = useMemo(
    () => (sessionQuery.data?.items ?? [])
      .map((item) => Number(item.questionKey))
      .filter((value) => Number.isInteger(value) && value > 0),
    [sessionQuery.data],
  );

  const questionQueries = useQueries({
    queries: questionIds.map((questionId) => ({
      queryKey: ['practice-runtime-question', questionId] as const,
      queryFn: () => fetchPracticeQuestionDetail(questionId),
      enabled: questionId > 0,
      staleTime: 1000 * 60 * 10,
    })),
  });

  useEffect(() => {
    if (sessionQuery.data?.status !== 'draft') {
      startedSessionIdRef.current = null;
      return;
    }
    if (startedSessionIdRef.current === sessionId) {
      return;
    }
    startedSessionIdRef.current = sessionId;
    void startSessionRef.current.mutateAsync(sessionId);
  }, [sessionId, sessionQuery.data?.status]);

  useEffect(() => {
    if (!sessionQuery.data) {
      return;
    }
    if (hydratedSessionIdRef.current === sessionQuery.data.id) {
      return;
    }
    hydratedSessionIdRef.current = sessionQuery.data.id;
    setAnswers(buildHydratedAnswers(sessionQuery.data.items));
  }, [sessionQuery.data]);

  useHeartbeatLoop({
    enabled: Boolean(sessionQuery.data && sessionQuery.data.status !== 'draft' && sessionQuery.data.status !== 'submitted'),
    onHeartbeat: async () => {
      await heartbeat.mutateAsync(sessionId);
    },
  });

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return <Banner variant="err" title="无效 session" description="请从练习中心重新进入。" />;
  }

  if (sessionQuery.isLoading) {
    return <Skeleton variant="text" lines={8} />;
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return <Banner variant="err" title="答题页加载失败" description="请返回练习中心重试。" />;
  }

  const session = sessionQuery.data;
  const currentItem = session.items[currentIndex];
  const currentQuestionQuery = questionQueries[currentIndex];
  const currentQuestion = currentQuestionQuery?.data;
  const answerSheetQuestions: AnswerSheetQuestion[] = session.items.map((item, index) => ({
    number: index + 1,
    state:
      index === currentIndex
        ? 'current'
        : hasLocalOverride(item.questionKey, answers)
          ? hasLocalAnswer(item, answers)
            ? 'answered'
            : item.flagged
              ? 'marked'
              : 'unanswered'
          : item.status === 'answered'
            ? 'answered'
            : item.flagged
              ? 'marked'
              : 'unanswered',
  }));

  const topbar = (
    <div className={styles.topbar}>
      <div>
        <strong>{session.track === 'essay' ? '申论' : '行测'} Session #{session.id}</strong>
        <div className={styles.metaList}>
          <span className={styles.metaText}>状态：{lifecycleQuery.data?.status ?? session.status}</span>
          <span className={styles.metaText}>模式：{session.practiceMode}</span>
          <Badge variant="neutral" size="sm">{session.sourceMode}</Badge>
        </div>
      </div>
      <div className={styles.topbarActions}>
        {countdownQuery.data ? (
          <TimerDisplay
            remainingMs={countdownQuery.data.remainingSeconds * 1000}
            paused={session.status === 'paused'}
          />
        ) : null}
        <Button variant="secondary" onClick={() => navigate('/practice')}>退出</Button>
        <Button variant="primary" onClick={async () => {
          await submitSession.mutateAsync(session.id);
          navigate(`/practice/sessions/${session.id}/result`);
        }}>
          提交
        </Button>
      </div>
    </div>
  );

  const leftPane = currentQuestionQuery?.isLoading ? (
    <Skeleton variant="text" lines={8} />
  ) : currentQuestionQuery?.isError || !currentQuestion ? (
    <Banner variant="err" title="题目详情加载失败" description="请返回重试。" />
  ) : session.track === 'essay' ? (
    <div className={styles.pane}>
      <QuestionStem
        number={currentIndex + 1}
        type={currentQuestion.questionKind}
        content={currentQuestion.stemText ?? currentQuestion.content?.stem ?? ''}
      />
      <textarea
        className={styles.essayInput}
        aria-label="申论作答输入"
        value={answers[currentItem.questionKey]?.[0] ?? ''}
        onChange={(event) => {
          const next = event.target.value.trim() === '' ? [] : [event.target.value];
          setAnswers((current) => ({ ...current, [currentItem.questionKey]: next }));
          void saveAnswers.mutateAsync({
            sessionId,
            payload: { answers: [{ questionKey: String(currentItem.questionKey), answer: { text: event.target.value } }] },
          });
        }}
      />
    </div>
  ) : (
    <div className={styles.pane}>
      <QuestionStem
        number={currentIndex + 1}
        type={currentQuestion.questionKind}
        difficulty={currentQuestion.difficultyCode === 'hard' ? 'hard' : currentQuestion.difficultyCode === 'easy' ? 'easy' : 'medium'}
        content={currentQuestion.stemText ?? currentQuestion.content?.stem ?? ''}
      />
      <div className={styles.options}>
        {currentQuestion.options.map((option) => (
          <OptionItem
            key={option.optionKey}
            label={option.optionKey}
            text={option.optionText}
            state={(answers[currentItem.questionKey] ?? []).includes(option.optionKey) ? 'selected' : 'rest'}
            onClick={() => {
              const next = [option.optionKey];
              setAnswers((current) => ({ ...current, [currentItem.questionKey]: next }));
              void saveAnswers.mutateAsync({
                sessionId,
                payload: { answers: [{ questionKey: String(currentItem.questionKey), answer: { selected: next } }] },
              });
            }}
          />
        ))}
      </div>
      <div className={styles.topbarActions}>
        <Button
          variant="ghost"
          onClick={() => void flagAnswer.mutateAsync({
            sessionId,
            answerId: currentItem.id,
            payload: { flagged: !currentItem.flagged },
          })}
        >
          {currentItem.flagged ? '取消标记' : '标记不确定'}
        </Button>
      </div>
    </div>
  );

  const rightPane = (
    <div className={styles.pane}>
      <AnswerSheet
        questions={answerSheetQuestions}
        cols={session.track === 'essay' ? 5 : 10}
        onJump={(questionNumber) => setCurrentIndex(questionNumber - 1)}
      />
      {session.items.length === 0 ? (
        <EmptyState title="当前 session 没有题目" description="请返回练习中心重新创建。" />
      ) : null}
    </div>
  );

  return (
    <div className={styles.root} data-testid="practice-session-view">
      <ExamLayout topbar={topbar} leftPane={leftPane} rightPane={rightPane} />
    </div>
  );
}
