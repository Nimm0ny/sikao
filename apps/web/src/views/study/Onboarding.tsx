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
import { STUDY_COPY } from '@/lib/ui-copy';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';

type Step = 'goal' | 'exam';

const inputCls = 'w-full border rounded-tiny px-3 py-2';
const inputSty = { fontSize: 'var(--t-body)', color: 'var(--ink-1)', borderColor: 'var(--line-1)', background: 'var(--paper-1)' };
const primarySty = { background: 'var(--accent-1)', color: '#fff', fontSize: 'var(--t-body)' };
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
    if (isNaN(score) || score < 0 || score > 150) { toast.error('目标分数必须在 0-150 之间'); return; }
    setGoalMutation.mutate({ targetScore: score }, {
      onSuccess: () => setStep('exam'),
      onError: (err) => { logger.error('goal save failed', err); toast.error('保存目标失败，请重试'); },
    });
  }

  function handleExamSelect(id: string) {
    const ev = examEvents?.items.find((e) => String(e.id) === id);
    setExamEventId(id);
    if (ev) { setExamName(ev.name); setExamDate(ev.examDate.slice(0, 10)); }
  }

  function handleExamSubmit(e: FormEvent) {
    e.preventDefault();
    if (!examName.trim() || !examDate) { toast.error('请填写考试名称和日期'); return; }
    createExamMutation.mutate(
      { name: examName.trim(), examDate, ...(examEventId ? { examEventId: parseInt(examEventId, 10) } : {}) },
      {
        onSuccess: () => navigate('/study/diagnosis-result'),
        onError: (err) => { logger.error('exam save failed', err); toast.error('保存考试失败，请重试'); },
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
            <label className="block font-medium mb-2" style={{ fontSize: 'var(--t-body)', color: 'var(--ink-2)' }}>
              {STUDY_COPY.ONBOARDING.GOAL_LABEL}
            </label>
            <input type="number" min={0} max={150} className={inputCls + ' mb-1'} style={inputSty}
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
              <button type="button" className="py-2 px-4 rounded-tiny" style={ghostSty}
                onClick={() => navigate('/dashboard')}>
                {STUDY_COPY.ONBOARDING.SKIP}
              </button>
            </div>
          </form>
        )}

        {step === 'exam' && (
          <form onSubmit={handleExamSubmit}>
            {examEvents && examEvents.items.length > 0 && (
              <div className="mb-4">
                <label className="block font-medium mb-2" style={{ fontSize: 'var(--t-body)', color: 'var(--ink-2)' }}>
                  {STUDY_COPY.ONBOARDING.SELECT_EXAM}
                </label>
                <select className={inputCls} style={inputSty} value={examEventId}
                  onChange={(e) => handleExamSelect(e.target.value)}>
                  <option value="">— 手动填写 —</option>
                  {examEvents.items.map((ev) => (
                    <option key={ev.id} value={String(ev.id)}>{ev.name} ({ev.examDate.slice(0, 7)})</option>
                  ))}
                </select>
              </div>
            )}
            <label className="block font-medium mb-2" style={{ fontSize: 'var(--t-body)', color: 'var(--ink-2)' }}>
              {STUDY_COPY.ONBOARDING.EXAM_LABEL}
            </label>
            <input type="text" className={inputCls + ' mb-4'} style={inputSty}
              placeholder={STUDY_COPY.ONBOARDING.EXAM_NAME_PLACEHOLDER}
              value={examName} onChange={(e) => setExamName(e.target.value)} required />
            <label className="block font-medium mb-2" style={{ fontSize: 'var(--t-body)', color: 'var(--ink-2)' }}>
              {STUDY_COPY.ONBOARDING.EXAM_DATE_LABEL}
            </label>
            <input type="date" className={inputCls + ' mb-6'} style={inputSty}
              value={examDate} onChange={(e) => setExamDate(e.target.value)} required />
            <div className="flex gap-3">
              <button type="submit" className="flex-1 py-2 rounded-tiny font-medium" style={primarySty}
                disabled={createExamMutation.isPending}>
                {createExamMutation.isPending ? '保存中…' : STUDY_COPY.ONBOARDING.CONFIRM}
              </button>
              <button type="button" className="py-2 px-4 rounded-tiny" style={ghostSty}
                onClick={() => navigate('/dashboard')}>
                {STUDY_COPY.ONBOARDING.SKIP}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
