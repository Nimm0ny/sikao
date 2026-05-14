import { useNavigate } from 'react-router-dom';
import { NavBackIcon } from '@sikao/ui/icons';
import { Button, EmptyState } from '@sikao/ui/ui';

// 404 catchall — 任何 require-auth layout 下 unmatched path (例: /essay/practice
// 单题路由下线后访客直接访问) 会落到这里, 替代 react-router 默认的
// "Hey developer 👋" 开发者提示, 让用户能找到回去的路.

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto" data-testid="not-found">
      <EmptyState
        icon={<NavBackIcon size={32} />}
        title="页面不见了"
        description="链接可能已过期或被下线。可以回到题库中心继续。"
        action={
          <Button
            variant="primary"
            onClick={() => navigate('/app')}
            data-testid="not-found-back-home"
          >
            返回题库中心
          </Button>
        }
      />
    </div>
  );
}
