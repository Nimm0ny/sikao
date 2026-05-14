import { useNavigate } from 'react-router-dom';
import { useStudyPlanToday, usePatchStudyTask } from '@sikao/api-client/queries/studyPlanQueries';
import { useStudyPlanRouting } from '@sikao/domain/study-record/useStudyPlanRouting';
import { STUDY_COPY } from '@/lib/ui-copy';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';
import type { StudyTaskResponse } from '@sikao/api-client/types/study-plan';

// PR-2 MVP: today task list
const KIND_LABEL: Record<string, string> = { practice: '行测练习', review_wrong: '错题复习', essay_writing: '申论练习' };
export default function StudyToday() {
  const navigate = useNavigate();
  const { data: plan, isLoading, isError, refetch } = useStudyPlanToday();
  const patchTask = usePatchStudyTask();
  const { handleTaskClick, startingTaskId } = useStudyPlanRouting();
  const tasks: StudyTaskResponse[] = (plan?.tasks ?? []) as StudyTaskResponse[];
  const pending = tasks.filter((t) => t.status === 'pending');
  const done = tasks.filter((t) => t.status !== 'pending');
  function handleSkip(taskId: number) {
    patchTask.mutate({ id: taskId, status: 'skipped' }, {
      onError: (err) => { logger.error('skip task failed', { err: String(err) }); toast.error('跳过任务失败'); },
    });
  }
  const cs = { background: 'var(--paper-2)', boxShadow: 'var(--shadow-card)' };
  const ts = { ...cs, border: '1px solid var(--line-1)' };
  if (isLoading) {
    return (
      <div className='min-h-screen' style={{ background: 'var(--paper-1)' }}>
        <div className='max-w-lg mx-auto px-4 py-8'>
          <div className='p-6 rounded-card' style={cs}>
            <p style={{ color: 'var(--ink-3)', fontSize: 'var(--t-body)' }}>正在生成今日任务…</p>
          </div>
        </div>
      </div>
    );
  }
  if (isError) {
    return (
      <div className='min-h-screen' style={{ background: 'var(--paper-1)' }}>
        <div className='max-w-lg mx-auto px-4 py-8'>
          <h1 className='font-bold mb-4' style={{ fontSize: 'var(--t-h2)', color: 'var(--ink-1)' }}>{STUDY_COPY.TODAY.TITLE}</h1>
          <div className='p-6 rounded-card' style={ts}>
            <p className='font-bold mb-1' style={{ fontSize: 'var(--t-body)', color: 'var(--ink-1)' }}>今日任务加载失败</p>
            <p className='mb-4' style={{ fontSize: 'var(--t-small)', color: 'var(--ink-3)' }}>检查本地服务后重试，或先进入练习中心。</p>
            <div className='flex gap-2'>
              <button className='py-2 px-4 rounded-tiny font-medium' style={{ background: 'var(--accent-1)', color: '#fff', fontSize: 'var(--t-small)' }} onClick={() => void refetch()}>重试</button>
              <button className='py-2 px-4 rounded-tiny' style={{ fontSize: 'var(--t-small)', color: 'var(--ink-4)', border: '1px solid var(--line-2)' }} onClick={() => navigate('/practice/center')}>{STUDY_COPY.TODAY.GO_PRACTICE}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className='min-h-screen' style={{ background: 'var(--paper-1)' }}>
      <div className='max-w-lg mx-auto px-4 py-8'>
        <h1 className='font-bold mb-4' style={{ fontSize: 'var(--t-h2)', color: 'var(--ink-1)' }}>{STUDY_COPY.TODAY.TITLE}</h1>
        {tasks.length === 0 && (<div className='p-6 rounded-card mb-4' style={cs}><p className='font-bold mb-1' style={{ fontSize: 'var(--t-body)', color: 'var(--ink-2)' }}>{STUDY_COPY.TODAY.EMPTY_TITLE}</p><button className='mt-3 py-2 px-4 rounded-tiny font-medium' style={{ background: 'var(--accent-1)', color: '#fff', fontSize: 'var(--t-body)' }} onClick={() => navigate('/practice/center')}>{STUDY_COPY.TODAY.GO_PRACTICE}</button></div>)}
        {tasks.length > 0 && pending.length === 0 && (<div className='p-4 rounded-card mb-4' style={cs}><p className='font-bold' style={{ color: 'var(--ok)', fontSize: 'var(--t-h3)' }}>{STUDY_COPY.TODAY.ALL_DONE_TITLE}</p></div>)}
        <div className='space-y-3 mb-6'>
          {pending.map((t) => (<div key={t.id} className='p-4 rounded-card' style={ts}><p className='font-medium mb-1' style={{ fontSize: 'var(--t-body)', color: 'var(--ink-1)' }}>{t.payload.title || (KIND_LABEL[t.taskKind] ?? t.taskKind)}</p>{t.payload.subtitle ? <p className='mb-3' style={{ fontSize: 'var(--t-small)', color: 'var(--ink-3)' }}>{t.payload.subtitle}</p> : <p className='mb-3' style={{ fontSize: 'var(--t-small)', color: 'var(--ink-3)' }}>{KIND_LABEL[t.taskKind] ?? t.taskKind}</p>}<div className='flex gap-2'><button className='flex-1 py-2 rounded-tiny font-medium' style={{ background: 'var(--accent-1)', color: '#fff', fontSize: 'var(--t-small)' }} onClick={() => handleTaskClick(t)} disabled={startingTaskId !== null || patchTask.isPending}>{STUDY_COPY.TODAY.TASK_START}</button><button className='py-2 px-3 rounded-tiny' style={{ fontSize: 'var(--t-small)', color: 'var(--ink-4)', border: '1px solid var(--line-2)' }} onClick={() => handleSkip(t.id)} disabled={patchTask.isPending || startingTaskId !== null}>{STUDY_COPY.TODAY.TASK_SKIP}</button></div></div>))}
          {done.map((t) => (<div key={t.id} className='p-4 rounded-card opacity-60' style={{ background: 'var(--paper-2)' }}><p style={{ fontSize: 'var(--t-body)', color: 'var(--ink-3)', textDecoration: t.status === 'completed' ? 'line-through' : 'none' }}>{t.payload.title || (KIND_LABEL[t.taskKind] ?? t.taskKind)}</p></div>))}
        </div>
        <div className='flex gap-3'>
          <button className='py-2 px-4 rounded-tiny' style={{ fontSize: 'var(--t-body)', color: 'var(--ink-3)', border: '1px solid var(--line-1)' }} onClick={() => navigate('/plan')}>{STUDY_COPY.DIAGNOSIS.VIEW_PLAN}</button>
          <button className='py-2 px-4 rounded-tiny' style={{ fontSize: 'var(--t-body)', color: 'var(--ink-3)', border: '1px solid var(--line-1)' }} onClick={() => navigate('/progress')}>{STUDY_COPY.TODAY.GO_PROGRESS}</button>
        </div>
      </div>
    </div>
  );
}
