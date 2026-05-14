import { useNavigate } from 'react-router-dom';
import { useStudyPlanToday, usePatchStudyTask } from '@sikao/api-client/queries/studyPlanQueries';
import { STUDY_COPY } from '@/lib/ui-copy';
import { logger } from '@sikao/shared-utils';
import { toast } from '@sikao/shared-utils';

// PR-2 MVP: today task list
const KIND_LABEL: Record<string, string> = { practice: '行测练习', review_wrong: '错题复习', essay_writing: '申论练习', wrongbook_review: '错题本精读', progress_review: '进度回顾' };
const KIND_PATH: Record<string, string> = { practice: '/practice/center', review_wrong: '/wrong-book', essay_writing: '/practice/center/essay/categories', wrongbook_review: '/wrong-book', progress_review: '/progress' };
type TaskStatus = 'pending' | 'completed' | 'skipped';
interface Task { id: number; taskKind: string; status: TaskStatus; }
export default function StudyToday() {
  const navigate = useNavigate();
  const { data: plan, isLoading } = useStudyPlanToday();
  const patchTask = usePatchStudyTask();
  const tasks: Task[] = (plan?.tasks ?? []) as Task[];
  const pending = tasks.filter((t) => t.status === 'pending');
  const done = tasks.filter((t) => t.status !== 'pending');
  function handleAction(taskId: number, status: 'completed' | 'skipped', kind: string) {
    patchTask.mutate({ taskId, body: { status } }, {
      onSuccess: () => { if (status === 'completed') navigate(KIND_PATH[kind] ?? '/practice/center'); },
      onError: (err) => { logger.error('patch task failed', err); toast.error('更新任务失败'); },
    });
  }
  if (isLoading) return <div style={{ padding: 40 }}>加载中…</div>;
  const cs = { background: 'var(--paper-2)', boxShadow: 'var(--shadow-card)' };
  const ts = { ...cs, border: '1px solid var(--line-1)' };
  return (
    <div className='min-h-screen' style={{ background: 'var(--paper-1)' }}>
      <div className='max-w-lg mx-auto px-4 py-8'>
        <h1 className='font-bold mb-4' style={{ fontSize: 'var(--t-h2)', color: 'var(--ink-1)' }}>{STUDY_COPY.TODAY.TITLE}</h1>
        {tasks.length === 0 && (<div className='p-6 rounded-card mb-4' style={cs}><p className='font-bold mb-1' style={{ fontSize: 'var(--t-body)', color: 'var(--ink-2)' }}>{STUDY_COPY.TODAY.EMPTY_TITLE}</p><button className='mt-3 py-2 px-4 rounded-tiny font-medium' style={{ background: 'var(--accent-1)', color: '#fff', fontSize: 'var(--t-body)' }} onClick={() => navigate('/practice/center')}>{STUDY_COPY.TODAY.GO_PRACTICE}</button></div>)}
        {tasks.length > 0 && pending.length === 0 && (<div className='p-4 rounded-card mb-4' style={cs}><p className='font-bold' style={{ color: 'var(--ok)', fontSize: 'var(--t-h3)' }}>{STUDY_COPY.TODAY.ALL_DONE_TITLE}</p></div>)}
        <div className='space-y-3 mb-6'>
          {pending.map((t) => (<div key={t.id} className='p-4 rounded-card' style={ts}><p className='font-medium mb-3' style={{ fontSize: 'var(--t-body)', color: 'var(--ink-1)' }}>{KIND_LABEL[t.taskKind] ?? t.taskKind}</p><div className='flex gap-2'><button className='flex-1 py-2 rounded-tiny font-medium' style={{ background: 'var(--accent-1)', color: '#fff', fontSize: 'var(--t-small)' }} onClick={() => handleAction(t.id, 'completed', t.taskKind)} disabled={patchTask.isPending}>{STUDY_COPY.TODAY.TASK_DONE}</button><button className='py-2 px-3 rounded-tiny' style={{ fontSize: 'var(--t-small)', color: 'var(--ink-4)', border: '1px solid var(--line-2)' }} onClick={() => handleAction(t.id, 'skipped', t.taskKind)} disabled={patchTask.isPending}>{STUDY_COPY.TODAY.TASK_SKIP}</button></div></div>))}
          {done.map((t) => (<div key={t.id} className='p-4 rounded-card opacity-60' style={{ background: 'var(--paper-2)' }}><p style={{ fontSize: 'var(--t-body)', color: 'var(--ink-3)', textDecoration: t.status === 'completed' ? 'line-through' : 'none' }}>{KIND_LABEL[t.taskKind] ?? t.taskKind}</p></div>))}
        </div>
        <div className='flex gap-3'>
          <button className='py-2 px-4 rounded-tiny' style={{ fontSize: 'var(--t-body)', color: 'var(--ink-3)', border: '1px solid var(--line-1)' }} onClick={() => navigate('/plan')}>{STUDY_COPY.DIAGNOSIS.VIEW_PLAN}</button>
          <button className='py-2 px-4 rounded-tiny' style={{ fontSize: 'var(--t-body)', color: 'var(--ink-3)', border: '1px solid var(--line-1)' }} onClick={() => navigate('/progress')}>{STUDY_COPY.TODAY.GO_PROGRESS}</button>
        </div>
      </div>
    </div>
  );
}