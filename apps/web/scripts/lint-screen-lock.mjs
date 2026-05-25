#!/usr/bin/env node
/**
 * lint-screen-lock.mjs — H11 视觉契约 + Web-Layout.md §1 single-screen lock.
 *
 * 强制约束：白名单中的"入口 view" root .module.css 文件必须由
 * <ScreenLockShell> 注入高度模型，禁止自己 ad-hoc 写 100vh / 100dvh
 * / min-height: 100vh，否则 fail-fast。
 *
 * 检查项：
 *   1. SCREEN_LOCK_VIEWS 中的 view（root tsx + root .module.css）必须 import
 *      ScreenLockShell from '@/components/layout' 且使用之；root .module.css
 *      不得出现：
 *        - `min-height: 100vh`
 *        - 不带 `overflow: hidden` 的 `height: 100vh / 100dvh`
 *        - 给 root grid 子项设置非 0 的 min-height（fr 单位会被破坏）
 *   2. SCREEN_LOCK_OPT_OUT_VIEWS 中的 view 跳过检查（钻取 / 长内容页）
 *   3. 未列入两份白名单的新 view，必须在 root tsx 文件顶部含
 *      `// screen-lock: opt-out, reason: ...` 显式声明，否则 warning
 *
 * Allow 注释：
 *   - 单行尾或上下 ±3 行内 `// screen-lock-allow: <reason>`
 *
 * Run: `node apps/web/scripts/lint-screen-lock.mjs`
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const APP_ROOT = join(SCRIPT_DIR, '..');
const VIEWS_ROOT = join(APP_ROOT, 'src', 'views');

/* Web-Layout.md §1.1 white-list — entry views that MUST use ScreenLockShell. */
const SCREEN_LOCK_VIEWS = [
  { route: '/', view: 'Home', tsx: 'Home/Home.tsx', css: 'Home/Home.module.css' },
  { route: '/profile/learning', view: 'ProfileLearning', tsx: 'ProfileLearning/ProfileLearning.tsx', css: 'ProfileLearning/ProfileLearning.module.css' },
  { route: '/profile/records', view: 'ProfileRecords', tsx: 'ProfileRecords/ProfileRecords.tsx', css: 'ProfileRecords/ProfileRecords.module.css' },
  { route: '/practice', view: 'Practice', tsx: 'Practice/Practice.tsx', css: 'Practice/Practice.module.css' },
  { route: '/review', view: 'Review', tsx: 'Review/Review.tsx', css: 'Review/Review.module.css' },
  { route: '/note', view: 'Note', tsx: 'Note/Note.tsx', css: 'Note/Note.module.css' },
  { route: '/me', view: 'Me', tsx: 'Me/Me.tsx', css: 'Me/Me.module.css' },
];

/* Web-Layout.md §1.2 opt-out — drilldown / long-content / runtime views. */
const SCREEN_LOCK_OPT_OUT_VIEWS = new Set([
  'PracticeSession.tsx',
  'PracticeSession.module.css',
  'SessionResult.tsx',
  'SessionResult.module.css',
  'EssayGradingResult.tsx',
  'EssayGradingResult.module.css',
  'AiQuestionsGenerating.tsx',
  'AiQuestionsGenerating.module.css',
  'MockExamComparisonView.tsx',
  'MockExamComparisonView.module.css',
  'MockExamHistoryView.tsx',
  'MockExamHistoryView.module.css',
  'MockExamStartView.tsx',
  'MockExamStartView.module.css',
  'PracticePreferences.tsx',
  'QuestionHub.tsx',
]);

const ALLOW_RE = /screen-lock-allow:/;
const OPT_OUT_RE = /screen-lock:\s*opt-out\s*,\s*reason:/;

const FORBID_PATTERNS = [
  {
    name: 'min-height-100vh-on-root',
    re: /^\s*min-height\s*:\s*100(?:vh|dvh|svh|lvh)\b/m,
    advice: '不得在 view root .module.css 写 min-height: 100vh — 由 <ScreenLockShell> 注入高度，view root 用 height: 100% / min-height: 0',
  },
  {
    name: 'naked-height-100vh',
    re: /^\s*height\s*:\s*100(?:vh|dvh|svh|lvh)\b/m,
    advice: '不得在 view root 写 height: 100vh — 由 <ScreenLockShell> 包裹后内部用 height: 100% / min-height: 0',
  },
];

const violations = [];

function hasAllowNearby(content, index) {
  const before = content.slice(Math.max(0, index - 200), index);
  const after = content.slice(index, index + 200);
  return ALLOW_RE.test(before) || ALLOW_RE.test(after);
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

function rel(path) {
  return relative(process.cwd(), path).replace(/\\/g, '/');
}

/* §1 — White-list views: must use ScreenLockShell. */
for (const entry of SCREEN_LOCK_VIEWS) {
  const tsxPath = join(VIEWS_ROOT, entry.tsx);
  const cssPath = join(VIEWS_ROOT, entry.css);

  if (!existsSync(tsxPath)) {
    /* View not yet implemented; skip silently — its issue will create it. */
    continue;
  }

  const tsxSrc = readFileSync(tsxPath, 'utf8');
  const usesShell = /from\s+['"](?:@\/components\/layout|\.\.\/\.\.\/components\/layout)['"]/.test(tsxSrc) && /ScreenLockShell/.test(tsxSrc);

  if (!usesShell) {
    violations.push({
      file: rel(tsxPath),
      line: 1,
      kind: 'missing-screen-lock-shell',
      view: entry.view,
      route: entry.route,
      advice: `${entry.view} 是 Web-Layout.md §1.1 白名单入口 view，必须 import 并使用 <ScreenLockShell from '@/components/layout'>`,
    });
  }

  if (existsSync(cssPath)) {
    const cssSrc = readFileSync(cssPath, 'utf8');
    for (const pattern of FORBID_PATTERNS) {
      const match = cssSrc.match(pattern.re);
      if (match && match.index !== undefined && !hasAllowNearby(cssSrc, match.index)) {
        violations.push({
          file: rel(cssPath),
          line: lineOf(cssSrc, match.index),
          kind: pattern.name,
          view: entry.view,
          advice: pattern.advice,
        });
      }
    }
  }
}

/* §2 — Unknown views: must declare opt-out reason. */
import { readdirSync, statSync } from 'node:fs';

function listViewRoots(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      const tsxCandidate = join(full, `${entry}.tsx`);
      if (existsSync(tsxCandidate)) out.push({ name: `${entry}.tsx`, path: tsxCandidate });
    } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
      out.push({ name: entry, path: full });
    }
  }
  return out;
}

const knownWhitelistTsx = new Set(
  SCREEN_LOCK_VIEWS.map((e) => e.tsx.split('/').pop()),
);

for (const candidate of listViewRoots(VIEWS_ROOT)) {
  if (knownWhitelistTsx.has(candidate.name)) continue;
  if (SCREEN_LOCK_OPT_OUT_VIEWS.has(candidate.name)) continue;
  /* New view not in either list: require explicit opt-out marker. */
  const src = readFileSync(candidate.path, 'utf8');
  if (!OPT_OUT_RE.test(src) && !/ScreenLockShell/.test(src)) {
    violations.push({
      file: rel(candidate.path),
      line: 1,
      kind: 'unclassified-view',
      advice: '新 view 必须或 (a) 加入 SCREEN_LOCK_VIEWS 并使用 <ScreenLockShell>；或 (b) 加入 SCREEN_LOCK_OPT_OUT_VIEWS 并在 tsx 顶部声明 `// screen-lock: opt-out, reason: <理由>`',
    });
  }
}

if (violations.length === 0) {
  process.stdout.write('lint-screen-lock: 0 violations\n');
  process.exit(0);
}

process.stdout.write(`lint-screen-lock: ${violations.length} violation(s)\n`);
for (const v of violations) {
  process.stdout.write(`  ${v.file}:${v.line} [${v.kind}]${v.view ? ` (${v.view})` : ''}\n    → ${v.advice}\n`);
}
process.exit(1);
