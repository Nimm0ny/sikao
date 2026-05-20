/**
 * PR-1 MVP: /study/onboarding
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useSetUserGoal,
  useExamEvents,
  useCreateUserExam,
} from '@sikao/api-client/queries/onboardingQueries';
import { trackEvent } from '@/lib/analytics';
import { STUDY_COPY } from '@/lib/ui-copy';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';

type Step = 'goal' | 'exam';

const inputCls = 'w-full border rounded-tiny px-3 py-2';
const inputSty = { fontSize: 'var(--t-body)', color: 'var(--ink-1)', borderColor: 'var(--line-1)', background: 'var(--paper-1)' };
const primarySty = {
  background: 'var(--accent-1)',
  color: 'var(--paper-1)',
  fontSize: 'var(--t-body)',
};
const ghostSty = { fontSize: 'var(--t-body)', color: 'var(--ink-3)', border: '1px solid var(--line-1)' };

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('goal');
  const [targetScore, setTargetScore] = useState('');
  const [examEventId, setExamEventId] = useState('');
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');
  const setGoalMutation = useSetUserGoal();
  const createExamMutation = useCreateUserExam();
  const { data: examEvents } = useExamEvents();

  function handleGoalSubmit(e: FormEvent) {
    e.preventDefault();
    const score = parseInt(targetScore, 10);
    if (isNaN(score) || score < 0 || score > 150) { toast.error(STUDY_COPY.ONBOARDING.GOAL_RANGE_ERROR); return; }
    setGoalMutation.mutate({ targetScore: score }, {
      onSuccess: () => {
        trackEvent({
          eventName: 'onboarding_goal_saved',
          properties: { targetScore: String(score) },
        });
        setStep('exam');
      },
      onError: (err) => { logger.error('goal save failed', { err: String(err) }); toast.error(STUDY_COPY.ONBOARDING.GOAL_SAVE_FAILED); },
    });
  }

  function handleExamSelect(id: string) {
    const ev = examEvents?.items.find((e) => String(e.id) === id);
    setExamEventId(id);
    if (ev) { setExamName(ev.name); setExamDate(ev.examDate.slice(0, 10)); }
  }

  function handleExamSubmit(e: FormEvent) {
    e.preventDefault();
    if (!examName.trim() || !examDate) { toast.error(STUDY_COPY.ONBOARDING.EXAM_REQUIRED); return; }
    createExamMutation.mutate(
      { name: examName.trim(), examDate, ...(examEventId ? { examEventId: parseInt(examEventId, 10) } : {}) },
      {
        onSuccess: () => {
          trackEvent({
            eventName: 'onboarding_exam_saved',
            properties: {
              examDate,
              hasExamEventId: examEventId ? 'true' : 'false',
            },
          });
          navigate('/study/diagnosis-result');
        },
        onError: (err) => { logger.error('exam save failed', { err: String(err) }); toast.error(STUDY_COPY.ONBOARDING.EXAM_SAVE_FAILED); },
      },
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper-1)' }}>
      <div className="w-full max-w-md p-8 rounded-card-lg" style={{ background: 'var(--paper-2)', boxShadow: 'var(--shadow-card)' }}>
        <h1 className="font-bold mb-1" style={{ fontSize: 'var(--t-h2)', color: 'var(--ink-1)' }}>
          {STUDY_COPY.ONBOARDING.TITLE}
        </h1>
        <p className="mb-6" style={{ fontSize: 'var(--t-small)', color: 'var(--ink-3)' }}>
          {STUDY_COPY.ONBOARDING.SUBTITLE}
        </p>

        {step === 'goal' && (
          <form onSubmit={handleGoalSubmit}>
            <label htmlFor="target-score" className="block font-medium mb-2" style={{ fontSize: 'var(--t-body)', color: 'var(--ink-2)' }}>
              {STUDY_COPY.ONBOARDING.GOAL_LABEL}
            </label>
            <input id="target-score" type="number" min={0} max={150} className={inputCls + ' mb-1'} style={inputSty}
              aria-label={STUDY_COPY.ONBOARDING.GOAL_LABEL}
              placeholder={STUDY_COPY.ONBOARDING.GOAL_PLACEHOLDER}
              value={targetScore} onChange={(e) => setTargetScore(e.target.value)} required />
            <p className="mb-6" style={{ fontSize: 'var(--t-tiny)', color: 'var(--ink-4)' }}>
              {STUDY_COPY.ONBOARDING.GOAL_HINT}
            </p>
            <div className="flex gap-3">
              <button type="submit" className="flex-1 py-2 rounded-tiny font-medium" style={primarySty}
                disabled={setGoalMutation.isPending}>
                {setGoalMutation.isPending ? '保存中…' : '下一步'}
              </button>
            </div>
          </form>
        )}

        {step === 'exam' && (
          <form onSubmit={handleExamSubmit}>
            {examEvents && examEvents.items.length > 0 && (
              <div className="mb-4">
                <label htmlFor="exam-event" className="block font-medium mb-2" style={{ fontSize: 'var(--t-body)', color: 'var(--ink-2)' }}>
                  {STUDY_COPY.ONBOARDING.SELECT_EXAM}
                </label>
                <select id="exam-event" className={inputCls} style={inputSty} value={examEventId}
                  aria-label={STUDY_COPY.ONBOARDING.SELECT_EXAM}
                  onChange={(e) => handleExamSelect(e.target.value)}>
                  <option value="">— 手动填写 —</option>
                  {examEvents.items.map((ev) => (
                    <option key={ev.id} value={String(ev.id)}>{ev.name} ({ev.examDate.slice(0, 7)})</option>
                  ))}
                </select>
              </div>
            )}
            <label htmlFor="exam-name" className="block font-medium mb-2" style={{ fontSize: 'var(--t-body)', color: 'var(--ink-2)' }}>
              {STUDY_COPY.ONBOARDING.EXAM_LABEL}
            </label>
            <input id="exam-name" type="text" className={inputCls + ' mb-4'} style={inputSty}
              aria-label={STUDY_COPY.ONBOARDING.EXAM_LABEL}
              placeholder={STUDY_COPY.ONBOARDING.EXAM_NAME_PLACEHOLDER}
              value={examName} onChange={(e) => setExamName(e.target.value)} required />
            <label htmlFor="exam-date" className="block font-medium mb-2" style={{ fontSize: 'var(--t-body)', color: 'var(--ink-2)' }}>
              {STUDY_COPY.ONBOARDING.EXAM_DATE_LABEL}
            </label>
            <input id="exam-date" type="date" className={inputCls + ' mb-6'} style={inputSty}
              aria-label={STUDY_COPY.ONBOARDING.EXAM_DATE_LABEL}
              value={examDate} onChange={(e) => setExamDate(e.target.value)} required />
            <div className="flex gap-3">
              <button type="submit" className="flex-1 py-2 rounded-tiny font-medium" style={primarySty}
                disabled={createExamMutation.isPending}>
                {createExamMutation.isPending ? '保存中…' : STUDY_COPY.ONBOARDING.CONFIRM}
              </button>
              <button type="button" className="py-2 px-4 rounded-tiny" style={ghostSty}
                onClick={() => setStep('goal')}>
                上一步
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
