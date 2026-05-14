/**
 * PR-1 MVP: /study/diagnosis-result
 * Shows initial diagnosis after onboarding.
 */
import { useNavigate } from 'react-router-dom';
import { useUserGoal } from '@sikao/api-client/queries/onboardingQueries';
import { useStudyPlanToday } from '@sikao/api-client/queries/studyPlanQueries';
import { STUDY_COPY } from '@/lib/ui-copy';

export default function DiagnosisResult() {
  const navigate = useNavigate();
  const { data: goal } = useUserGoal();
  const { data: plan } = useStudyPlanToday();

  const tasks = plan?.tasks ?? [];
  const practiceCount = tasks.filter((t: { taskKind: string }) => t.taskKind === 'practice').length;
  const essayCount = tasks.filter((t: { taskKind: string }) => t.taskKind === 'essay_writing').length;

  const cardStyle = { background: 'var(--paper-2)', boxShadow: 'var(--shadow-card)' };

  return (
    <div className='min-h-screen flex items-center justify-center' style={{ background: 'var(--paper-1)' }}>
      <div className='w-full max-w-md p-8 rounded-card-lg' style={cardStyle}>
        <h1 className='font-bold mb-1' style={{ fontSize: 'var(--t-h2)', color: 'var(--ink-1)' }}>
          {STUDY_COPY.DIAGNOSIS.TITLE}
        </h1>
        <p className='mb-6' style={{ fontSize: 'var(--t-small)', color: 'var(--ink-3)' }}>
          {STUDY_COPY.DIAGNOSIS.SUBTITLE}
        </p>

        {goal?.hasGoal && (
          <div className='mb-4 p-4 rounded-card' style={{ background: 'var(--paper-3)', border: '1px solid var(--line-1)' }}>
            <p style={{ fontSize: 'var(--t-small)', color: 'var(--ink-3)' }}>目标分数</p>
            <p className='font-bold' style={{ fontSize: 'var(--t-h2)', color: 'var(--accent-1)' }}>
              {goal.targetScore} 分
            </p>
          </div>
        )}

        {tasks.length > 0 && (
          <div className='mb-6 p-4 rounded-card' style={{ background: 'var(--paper-3)', border: '1px solid var(--line-1)' }}>
            <p className='font-medium mb-2' style={{ fontSize: 'var(--t-body)', color: 'var(--ink-2)' }}>
              今日推荐任务 ({tasks.length} 项)
            </p>
            {practiceCount > 0 && <p style={{ fontSize: 'var(--t-small)', color: 'var(--ink-3)' }}>{STUDY_COPY.DIAGNOSIS.XINGCE_FOCUS}: {practiceCount} 套行测</p>}
            {essayCount > 0 && <p style={{ fontSize: 'var(--t-small)', color: 'var(--ink-3)' }}>{STUDY_COPY.DIAGNOSIS.ESSAY_FOCUS}: {essayCount} 篇申论</p>}
          </div>
        )}

        <div className='flex gap-3'>
          <button className='flex-1 py-2 rounded-tiny font-medium'style={{ background: 'var(--accent-1)', color: '#fff', fontSize: 'var(--t-body)' }}
            onClick={() => navigate('/study/today')}>
            {STUDY_COPY.DIAGNOSIS.START_TODAY}
          </button>
          <button className='py-2 px-4 rounded-tiny' style={{ fontSize: 'var(--t-body)', color: 'var(--ink-3)', border: '1px solid var(--line-1)' }}
            onClick={() => navigate('/plan')}>
            {STUDY_COPY.DIAGNOSIS.VIEW_PLAN}
          </button>
        </div>
      </div>
    </div>
  );
}