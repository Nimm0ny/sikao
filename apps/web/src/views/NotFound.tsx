import { useNavigate } from 'react-router-dom';
import { NavBackIcon } from '@sikao/ui/icons';
import { Button, EmptyState } from '@sikao/ui/ui';
import { NOT_FOUND_COPY } from '@/lib/ui-copy';

// 404 catchall — 任何 require-auth layout 下 unmatched path (例: /essay/practice
// 单题路由下线后访客直接访问) 会落到这里, 替代 react-router 默认的
// "Hey developer 👋" 开发者提示, 让用户能找到回去的路.

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto" data-testid="not-found">
      <EmptyState
        icon={<NavBackIcon size={32} />}
        title={NOT_FOUND_COPY.title}
        description={`${NOT_FOUND_COPY.descPart1}。${NOT_FOUND_COPY.descPart2}。`}
        action={
          <Button
            variant="primary"
            onClick={() => navigate('/app')}
            data-testid="not-found-back-home"
          >
            {NOT_FOUND_COPY.backCta}
          </Button>
        }
      />
    </div>
  );
}
