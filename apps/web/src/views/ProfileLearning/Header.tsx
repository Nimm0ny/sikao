// lint-allow-ui-copy: V5 ProfileLearning header copy. CJK strings are
// visual contract from `.tmp_review/out/Tab5-Profile/Profile Learning v1.html`.
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout';
import { Button } from '../../components/form';
import type { DashboardProgressResponseV2 } from '@sikao/api-client/types/home';

/*
 * ProfileLearning Header.
 * Why: page chrome (title + summary line + back link). Summary line
 *      surfaces the all-time itemsAnswered + practiceMinutes derived
 *      from useProgressOverview.summary.allTime so the user sees their
 *      total commitment before drilling into segments.
 */

interface HeaderProps {
  readonly overview: DashboardProgressResponseV2 | undefined;
}

function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

export function Header({ overview }: HeaderProps) {
  const all = overview?.summary.allTime;
  const subtitle = all
    ? `累计练习 ${all.itemsAnswered} 题 · ${formatHours(all.minutesPracticed)} 小时 · ${all.sessionsCount} 次会话`
    : '累计学习数据加载中…';

  return (
    <PageHeader
      title="学习详情"
      subtitle={subtitle}
      actions={
        <Link to="/">
          <Button variant="secondary" size="sm">返回首页</Button>
        </Link>
      }
    />
  );
}
