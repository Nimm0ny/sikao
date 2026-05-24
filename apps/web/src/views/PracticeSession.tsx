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
import { DiscardSessionDialog } from '../components/practice/lifecycle/DiscardSessionDialog';
import { PauseResumeButton } from '../components/practice/lifecycle/PauseResumeButton';
import { ExamLayout } from '../layouts/ExamLayout';
import { fetchPracticeQuestionDetail } from '@sikao/api-client/queries/practiceQuestionQueries';
import {
  useFlagPracticeSessionAnswer,
  usePracticeSession,
  useSavePracticeSessionAnswers,
} from '@sikao/api-client/queries/sessionQueries';
import {
  useDiscardPracticeSession,
  usePausePracticeSession,
  usePracticeSessionCountdown,
  usePracticeSessionHeartbeat,
  usePracticeSessionLifecycle,
  useResumePracticeSession,
  useStartPracticeSession,
  useSubmitPracticeSession,
} from '@sikao/api-client/queries/sessionRuntimeQueries';
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
  const pauseSession = usePausePracticeSession();
  const resumeSession = useResumePracticeSession();
  const discardSession = useDiscardPracticeSession();
  const heartbeat = usePracticeSessionHeartbeat();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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

  const runtimeStatus = lifecycleQuery.data?.status ?? sessionQuery.data?.status;
  const lifecycleBusy =
    pauseSession.isPending ||
    resumeSession.isPending ||
    discardSession.isPending;

  useHeartbeatLoop({
    enabled: Boolean(
      sessionQuery.data &&
      runtimeStatus !== 'draft' &&
      runtimeStatus !== 'paused' &&
      runtimeStatus !== 'submitted' &&
      runtimeStatus !== 'abandoned' &&
      runtimeStatus !== 'expired',
    ),
    onHeartbeat: async () => {
      await heartbeat.mutateAsync(sessionId);
    },
    onError: (error) => {
      setActionError(String(error));
    },
  });

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return <Banner variant="err" title="Invalid session" description="Re-enter from Practice Center." />;
  }

  if (sessionQuery.isLoading) {
    return <Skeleton variant="text" lines={8} />;
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return <Banner variant="err" title="Runtime session failed to load" description="Retry from Practice Center." />;
  }

  const session = sessionQuery.data;
  const currentStatus = runtimeStatus ?? session.status;
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
        <strong>{session.track === 'essay' ? 'Essay' : 'Xingce'} Session #{session.id}</strong>
        <div className={styles.metaList}>
          <span className={styles.metaText}>Status: {currentStatus}</span>
          <span className={styles.metaText}>Mode: {session.practiceMode}</span>
          <Badge variant="neutral" size="sm">{session.sourceMode}</Badge>
        </div>
      </div>
      <div className={styles.topbarActions}>
        {countdownQuery.data ? (
          <TimerDisplay
            remainingMs={countdownQuery.data.remainingSeconds * 1000}
            paused={currentStatus === 'paused'}
          />
        ) : null}
        <PauseResumeButton
          status={currentStatus}
          busy={lifecycleBusy}
          onPause={() => {
            void (async () => {
              setActionError(null);
              try {
                await pauseSession.mutateAsync(session.id);
              } catch (error) {
                setActionError(String(error));
              }
            })();
          }}
          onResume={() => {
            void (async () => {
              setActionError(null);
              try {
                await resumeSession.mutateAsync(session.id);
              } catch (error) {
                setActionError(String(error));
              }
            })();
          }}
        />
        <Button variant="ghost" onClick={() => setDiscardOpen(true)} disabled={lifecycleBusy}>
          Discard
        </Button>
        <Button variant="secondary" onClick={() => navigate('/practice')}>Exit</Button>
        <Button
          variant="primary"
          onClick={async () => {
            await submitSession.mutateAsync(session.id);
            navigate(`/practice/sessions/${session.id}/result`);
          }}
        >
          Submit
        </Button>
      </div>
    </div>
  );

  const leftPane = currentQuestionQuery?.isLoading ? (
    <Skeleton variant="text" lines={8} />
  ) : currentQuestionQuery?.isError || !currentQuestion ? (
    <Banner variant="err" title="Question detail failed to load" description="Retry the runtime session." />
  ) : session.track === 'essay' ? (
    <div className={styles.pane}>
      <QuestionStem
        number={currentIndex + 1}
        type={currentQuestion.questionKind}
        content={currentQuestion.stemText ?? currentQuestion.content?.stem ?? ''}
      />
      <textarea
        className={styles.essayInput}
        aria-label="Essay answer input"
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
        difficulty={
          currentQuestion.difficultyCode === 'hard'
            ? 'hard'
            : currentQuestion.difficultyCode === 'easy'
              ? 'easy'
              : 'medium'
        }
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
          {currentItem.flagged ? 'Unmark' : 'Mark uncertain'}
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
        <EmptyState title="No questions in this session" description="Create a new session from Practice Center." />
      ) : null}
    </div>
  );

  return (
    <div className={styles.root} data-testid="practice-session-view">
      {actionError ? (
        <Banner
          variant="err"
          title="Runtime action failed"
          description={actionError}
          dismissible
          onDismiss={() => setActionError(null)}
        />
      ) : null}
      <ExamLayout topbar={topbar} leftPane={leftPane} rightPane={rightPane} />
      <DiscardSessionDialog
        open={discardOpen}
        loading={discardSession.isPending}
        onClose={() => setDiscardOpen(false)}
        onConfirm={async () => {
          setActionError(null);
          try {
            await discardSession.mutateAsync({
              sessionId: session.id,
              payload: { reason: 'user_discard' },
            });
            navigate('/practice');
          } catch (error) {
            setActionError(String(error));
          }
        }}
      />
    </div>
  );
}
