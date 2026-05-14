#!/usr/bin/env bash
# Final import-rewrite for sikao apps/web + packages.
# Run AFTER fix_encoding_v2.py to canonicalize all @/ imports to @sikao/* paths.
set -euo pipefail

cd "$(dirname "$0")/../.."

find apps/web/src packages -name "*.ts" -o -name "*.tsx" | while read -r f; do
  sed -i \
    -e "s|from '@/utils/request'|from '@sikao/api-client/request'|g" \
    -e "s|from '@/utils/apiQueries'|from '@sikao/api-client/apiQueries'|g" \
    -e "s|from '@/types/api'|from '@sikao/api-client/types/api'|g" \
    -e "s|from '@/types/api.generated'|from '@sikao/api-client/types/api.generated'|g" \
    -e "s|from '@/types/study-plan'|from '@sikao/api-client/types/study-plan'|g" \
    -e "s|from '@/test-utils/renderWithProviders'|from '@sikao/test-utils/renderWithProviders'|g" \
    -e "s|from '@/test-utils/server'|from '@sikao/test-utils/server'|g" \
    -e "s|from '@/test-utils/handlers'|from '@sikao/test-utils/handlers'|g" \
    -e "s|from '@/components/practice/ViewModeToggle'|from '@sikao/domain/xingce/viewMode'|g" \
    -e "s|from '@/lib/cn'|from '@sikao/shared-utils'|g" \
    -e "s|from '@/lib/logger'|from '@sikao/shared-utils'|g" \
    -e "s|from '@/lib/motion'|from '@sikao/shared-utils'|g" \
    -e "s|from '@/lib/toast'|from '@sikao/shared-utils'|g" \
    -e "s|from '@/lib/timing'|from '@sikao/shared-utils'|g" \
    -e "s|from '@/lib/silent-refresh'|from '@sikao/shared-utils'|g" \
    -e "s|from '@/lib/queryRetry'|from '@sikao/shared-utils'|g" \
    -e "s|from '@/lib/isAuthError'|from '@sikao/shared-utils'|g" \
    -e "s|from '@/lib/useReducedMotion'|from '@sikao/shared-utils'|g" \
    -e "s|from '@/lib/ToastHost'|from '@sikao/shared-utils'|g" \
    -e "s|from '@/lib/exam-countdown'|from '@sikao/domain/study-record/exam-countdown'|g" \
    -e "s|from '@/lib/exam-tracking'|from '@sikao/domain/study-record/exam-tracking'|g" \
    -e "s|from '@/lib/exam-calendar'|from '@sikao/domain/study-record/exam-calendar'|g" \
    -e "s|from '@/lib/category-canonicalize'|from '@sikao/domain/question-bank/category-canonicalize'|g" \
    -e "s|from '@/lib/viewMode'|from '@sikao/domain/xingce/viewMode'|g" \
    -e "s|from '@/lib/practiceFontSize'|from '@sikao/domain/xingce/practiceFontSize'|g" \
    -e "s|from '@/lib/isGraphicReasoning'|from '@sikao/answer-engine/graphic-detect/isGraphicReasoning'|g" \
    -e "s|from '@/components/icons'|from '@sikao/ui/icons'|g" \
    -e "s|from '@/components/icons/|from '@sikao/ui/icons/|g" \
    -e "s|from '@/components/ui'|from '@sikao/ui/ui'|g" \
    -e "s|from '@/components/ui/|from '@sikao/ui/ui/|g" \
    -e "s|from '@/components/brand|from '@sikao/ui/brand|g" \
    -e "s|from '@/components/TweaksDrawer'|from '@sikao/ui/ui/TweaksDrawer'|g" \
    -e "s|from '@/components/QuestionDispatcher'|from '@/components/questions/QuestionDispatcher'|g" \
    -e "s|from '@/components/MaterialGroupContainer'|from '@/components/questions/MaterialGroupContainer'|g" \
    -e "s|from '@/components/wrongbook'|from '@/components/wrong-book'|g" \
    -e "s|from '@/hooks/useDevice'|from '@sikao/shared-utils/hooks/useDevice'|g" \
    -e "s|from '@/hooks/useOrientation'|from '@sikao/shared-utils/hooks/useOrientation'|g" \
    -e "s|from '@/hooks/useOnline'|from '@sikao/shared-utils/hooks/useOnline'|g" \
    -e "s|from '@/hooks/useLongPress'|from '@sikao/shared-utils/hooks/useLongPress'|g" \
    -e "s|from '@/hooks/useSwipeAction'|from '@sikao/shared-utils/hooks/useSwipeAction'|g" \
    -e "s|from '@/hooks/usePullToRefresh'|from '@sikao/shared-utils/hooks/usePullToRefresh'|g" \
    -e "s|from '@/hooks/useInputMode'|from '@sikao/shared-utils/hooks/useInputMode'|g" \
    -e "s|from '@/hooks/useTweaks'|from '@sikao/shared-utils/hooks/useTweaks'|g" \
    -e "s|from '@/hooks/useScrollSpyTab'|from '@sikao/shared-utils/hooks/useScrollSpyTab'|g" \
    -e "s|from '@/hooks/useAskSession'|from '@sikao/domain/llm/useAskSession'|g" \
    -e "s|from '@/hooks/useEssayDraft'|from '@sikao/domain/shenlun/useEssayDraft'|g" \
    -e "s|from '@/hooks/useEssaySessionElapsed'|from '@sikao/domain/shenlun/useEssaySessionElapsed'|g" \
    -e "s|from '@/hooks/useWrongQuestionItem'|from '@sikao/domain/wrong-book/useWrongQuestionItem'|g" \
    -e "s|from '@/hooks/useWrongBookHeatmap'|from '@sikao/domain/wrong-book/useWrongBookHeatmap'|g" \
    -e "s|from '@/hooks/useCommunityNotes'|from '@sikao/domain/notes/useCommunityNotes'|g" \
    -e "s|from '@/hooks/useHomeData'|from '@sikao/domain/dashboard/useHomeData'|g" \
    -e "s|from '@/hooks/useStudyPlanRouting'|from '@sikao/domain/study-record/useStudyPlanRouting'|g" \
    -e "s|from '@/hooks/useFbSettings'|from '@sikao/domain/xingce/useFbSettings'|g" \
    -e "s|from '@/store/useAuthStore'|from '@sikao/domain/auth/useAuthStore'|g" \
    -e "s|from '@/store/usePracticeStore'|from '@sikao/domain/answer-session/usePracticeStore'|g" \
    -e "s|from '@/store/useHighlightStore'|from '@sikao/domain/xingce/useHighlightStore'|g" \
    -e "s|from '@/store/useThemeStore'|from '@/styles/useThemeStore'|g" \
    -e "s|from '@/api/wrongBookQueries'|from '@sikao/api-client/queries/wrongBookQueries'|g" \
    -e "s|from '@/api/studyPlanQueries'|from '@sikao/api-client/queries/studyPlanQueries'|g" \
    -e "s|from '@/api/essaySpecialtyQueries'|from '@sikao/api-client/queries/essaySpecialtyQueries'|g" \
    -e "s|from '@/api/xingceSpecialtyQueries'|from '@sikao/api-client/queries/xingceSpecialtyQueries'|g" \
    -e "s|from '@/api/examEventsQueries'|from '@sikao/api-client/queries/examEventsQueries'|g" \
    -e "s|from '@/api/notebookQueries'|from '@sikao/api-client/queries/notebookQueries'|g" \
    -e "s|from '@/features/essay-exam/hooks/useExamSession'|from '@sikao/domain/shenlun/useExamSession'|g" \
    -e "s|from '@/features/essay-exam/types'|from '@sikao/domain/shenlun/types'|g" \
    -e "s|from '@/features/essay-exam/lib/bodyChars'|from '@sikao/answer-engine/word-limit/bodyChars'|g" \
    -e "s|from '@/features/essay-exam/lib/wordLimits'|from '@sikao/answer-engine/word-limit/wordLimits'|g" \
    -e "s|from '@/features/essay-exam/lib/gridLayout'|from '@sikao/answer-engine/grid-layout/gridLayout'|g" \
    -e "s|from '@/features/essay-exam/lib/highlightRanges'|from '@sikao/answer-engine/highlight/highlightRanges'|g" \
    -e "s|from '@/features/essay-exam/lib/EssayClient'|from '@sikao/api-client/essay-client'|g" \
    -e "s|from '@/features/essay-exam/lib/mapBackendPaper'|from '@sikao/domain/shenlun/mapBackendPaper'|g" \
    -e "s|from '@/features/essay-exam/lib/examScore'|from '@sikao/answer-engine/scoring/shenlun'|g" \
    -e "s|from '@/features/essay-exam/ExamShell'|from '@sikao/editor'|g" \
    -e "s|from '@/features/essay-exam/TopBar'|from '@sikao/editor/TopBar'|g" \
    -e "s|from '@/features/essay-exam/modals/|from '@sikao/editor/modals/|g" \
    -e "s|from '@/features/essay-exam/panels/|from '@sikao/editor/panels/|g" \
    -e "s|from '@/features/essay-exam/pieces/|from '@sikao/editor/pieces/|g" \
    -e "s|from '@/components/essay/sikao/types'|from '@sikao/domain/shenlun/sikaoTypes'|g" \
    -e "s|from './lib/ToastHost'|from '@sikao/shared-utils'|g" \
    -e "s|from './lib/logger'|from '@sikao/shared-utils'|g" \
    -e "s|from './lib/queryRetry'|from '@sikao/shared-utils'|g" \
    -e "s|from './lib/silent-refresh'|from '@sikao/shared-utils'|g" \
    "$f"
done

# Internal api-client: convert @sikao/api-client/* back to relative paths.
cd packages/api-client/src
sed -i \
  -e "s|from '@sikao/api-client/types/api'|from './types/api'|g" \
  -e "s|from '@sikao/api-client/types/study-plan'|from './types/study-plan'|g" \
  -e "s|from '@sikao/api-client/apiQueries'|from './apiQueries'|g" \
  -e "s|from '@sikao/api-client/request'|from './request'|g" \
  apiQueries.ts queries/*.ts essay-client.ts queries/__tests__/*.tsx 2>/dev/null || true

echo "import rewrite complete"
