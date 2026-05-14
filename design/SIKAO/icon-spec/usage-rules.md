---
type: design
status: active
owner: lhr
last-reviewed: 2026-05-09
---

# Icon Usage Rules — Engineer Quick Reference

> When you're about to add a button, an indicator, or a decoration, **start here**.
> If this doc doesn't answer your question in 30 seconds, ping the design system
> owner. Don't improvise.
>
> Companion docs:
> - `SVG-ICON-DESIGN-SYSTEM.md` (full spec)
> - `composite-icons-spec.md` (NumberCircle / MaterialBadge / QuestionBadge)
> - `icon-inventory.html` (visual catalog)

---

## 1. Choose an icon

### 1.1 Decision tree

```
Is the action one of the 24 SIKAO seed icons?
  → YES: Use that one. (See §6 inventory.)
  → NO: Continue.

Does it match a documented "new icon" from §11.1 of the design system doc?
  → YES: Use that. (Likely already implemented.)
  → NO: Continue.

Does it represent dynamic numbered data (题号 / 材料编号 / 问题编号)?
  → YES: Use composite primitive (NumberCircle / NumberSquare / MaterialBadge / QuestionBadge).
  → NO: Continue.

You need a NEW icon → bring up in design review.
  Don't draw it inline in the component file.
  Don't substitute emoji. Don't use a Tailwind icon library.
```

### 1.2 Top 8 most-used icons (memorize these)

| Action | Component | aria-label example |
|---|---|---|
| 收藏 / 取消收藏 | `<ActionStarIcon />` / `<ActionStarFilledIcon />` | `"收藏"` / `"取消收藏"` |
| 标记 / 取消标记 | `<ActionMarkIcon />` / `<ActionMarkFilledIcon />` | `"标记"` / `"取消标记"` |
| 笔记 | `<ActionNoteIcon />` (or `<ActionNoteEditIcon />` if已有笔记) | `"添加笔记"` / `"编辑笔记"` |
| 上一题 / 下一题 | `<NavPrevIcon />` / `<NavNextIcon />` | `"上一题"` / `"下一题"` |
| 答题卡 | `<NavAnswerCardIcon />` | `"打开答题卡"` |
| 关闭 | `<NavCloseIcon />` | `"关闭"` |
| 暂停 / 继续 | `<ToolPauseIcon />` / `<ToolPlayIcon />` | `"暂停计时"` / `"继续计时"` |
| 设置 | `<ToolSettingsIcon />` | `"设置"` |

### 1.3 Subtle distinctions

- `ActionMarkIcon` ≠ `ActionStarIcon`. **Mark** (旗标) = "I want to revisit
  this question later"; **Star** (收藏) = "I want this in my permanent set".
- `NavCloseIcon` ≠ `NavBackIcon`. Close = dismisses a modal/drawer; Back =
  navigates one step back in flow. Use the right one.
- AI / chat icons are not part of the Phase 3 xingce answering-system scope.
  Do not include them in toolbar, topbar, dock, drawer, or option-action lists.

---

## 2. The "SVG-only" constraint (xingce / essay 答题系统铁律)

### 2.1 Banned patterns

```tsx
// ❌ BANNED — text label without icon
<button onClick={save}>保存</button>

// ❌ BANNED — emoji as icon (always)
<button>📌 标记</button>

// ❌ BANNED — text + emoji combo
<button>⭐ 收藏</button>

// ❌ BANNED — native title attribute on icon button
<button title="收藏"><ActionStarIcon /></button>

// ❌ BANNED — bare svg without IconBtn wrapper
<button onClick={save}><svg>...</svg></button>
```

### 2.2 Approved patterns

```tsx
// ✅ Standalone icon button
<IconBtn aria-label="收藏" onClick={toggleStar}>
  <ActionStarIcon />
</IconBtn>

// ✅ Toggle icon button with state
<IconBtn aria-label={isStarred ? '取消收藏' : '收藏'} aria-pressed={isStarred} onClick={toggleStar}>
  {isStarred ? <ActionStarFilledIcon /> : <ActionStarIcon />}
</IconBtn>

// ✅ Tooltip (NOT title) for power users
<Tooltip label="收藏 (S)">
  <IconBtn aria-label="收藏" onClick={toggleStar}>
    <ActionStarIcon />
  </IconBtn>
</Tooltip>

// ✅ Sole exception: primary CTA with icon + text
<Button variant="primary" onClick={submit}>
  <NavSubmitIcon /> 提交
</Button>
```

### 2.3 The single allowed icon-text combo

In xingce / essay / result answering systems, you may have **at most one primary
CTA per view** using icon + text. It must be the destination action. Everything
else in toolbar / topbar / dock / drawer / option-actions / scratch trigger /
IconBtn is SVG-only.

| Surface | The one allowed combo |
|---|---|
| Xingce view | Only the dock submit footer may use `<Button.primary><NavSubmitIcon /> 提交</Button.primary>`. Topbar / dock triggers stay SVG-only `IconBtn`. |
| Essay view | Only the dock submit footer may use `<Button.primary><ToolSendIcon /> 提交答案</Button.primary>`. Topbar / dock triggers stay SVG-only `IconBtn`. |

Marketing pages may use icon+text CTAs by normal marketing rules, but that
exception does not apply to xingce / essay / result answering systems.

---

## 3. Composite icons (numbered)

For dynamic numbered data, use the composite primitive — never compose the look
manually with `NumberCircle` + a text node + chip wrapper.

### 3.1 题号 (questions list / FbDock / FbOpt)

```tsx
// FbDock — 35 题号
<NumberCircle
  number={22}
  status="current"               // 'unanswered' | 'answered' | 'marked' | 'current' | 'wrong'
  size="sm"                      // 'sm' (24) | 'md' (28) | 'lg' (32)
  ariaLabel="第 22 题, 当前题, 点击跳转"
  onClick={() => goto(22)}
/>

// FbOpt — A/B/C/D 选项 letter
<NumberCircle
  number="B"
  status={isSelected ? 'current' : 'unanswered'}
  size="md"
  ariaLabel={`选项 B${isSelected ? ', 已选中' : ''}`}
/>

// Tweaks: option-style="square"
<NumberSquare
  number="B"
  status="current"
  size="md"
  ariaLabel="选项 B, 已选中"
/>
```

ARIA label templates:

| State | Label |
|---|---|
| `unanswered` | `第 {N} 题, 未答, 点击跳转` |
| `answered` | `第 {N} 题, 已答, 点击跳转` |
| `marked` | `第 {N} 题, 已标记, 点击跳转` |
| `current` | `第 {N} 题, 当前题` |
| `wrong` | `第 {N} 题, 答错, 点击查看` |

### 3.2 申论材料编号 (MmStrip 左)

```tsx
<MaterialBadge
  index={3}
  status="marked"             // 'pending' | 'read' | 'marked' | 'active'
  count={2}                   // only for 'marked'; "2 处划重点"
  onClick={() => switchMaterial(3)}
  ariaLabel="材料 3, 已读, 内有 2 处划重点"
/>
```

### 3.3 申论问题编号 (MmStrip 右 / EditorPanel)

```tsx
<QuestionBadge
  index={3}
  status="writing"            // 'locked' | 'pending' | 'writing' | 'submitted'
  current={142}
  required={500}
  onClick={() => switchQuestion(3)}
  ariaLabel="问题 3, 正在作答, 142 字 共 500 字"
/>
```

### 3.4 Don't roll your own

Bad:

```tsx
// ❌ Do NOT do this
<button className="flex flex-col items-start ...">
  <span className="font-mono text-[11px]">M3</span>
  <span className="dot" />
  <span className="text-[9px] text-ink-4">2 处</span>
</button>
```

Use `<MaterialBadge>` instead. The styling rules in `composite-icons-spec.md` are
the contract; the wrapper enforces them.

---

## 4. Sizing

| Surface | Recommended size |
|---|---|
| Inline meta (chip / Tag content) | `sm` (16) |
| FbCard 操作条 (★ ⤴ 📝) | `sm` inside `IconBtn size="sm"` (28×28 outer) |
| Topbar buttons | `md` inside `IconBtn size="md"` (32×32 outer) |
| Sidebar nav | `lg` inside `IconBtn size="md"` |
| Marketing hero CTA glyph | `xl` (32) |
| 答题卡 NumberCircle | composite `sm` (24) |
| FbOpt 选项 letter | composite `md` (28) |

When in doubt: **md**. Bigger is rarely better.

---

## 5. ARIA labels — common templates

```tsx
// State toggle
aria-label={isOn ? '关闭夜读模式' : '开启夜读模式'}
aria-pressed={isOn}

// Quantitative
aria-label={`${count} 道错题待复盘`}

// Navigation
aria-label="返回学习中心"

// Destructive
aria-label="删除笔记"
// + add confirm dialog

// Disabled with reason
aria-label="提交（请先回答所有题目）"
disabled={!allAnswered}

// Read-only / informational
<XxxIcon role="img" aria-label="加载中" />
```

### 5.1 Don't do this

| Bad | Why |
|---|---|
| `aria-label="star"` | English; users read Chinese. |
| `aria-label="按钮"` | Doesn't say what the button does. |
| `aria-label=""` | Missing label = lint error. |
| `aria-label="Click here"` | Vague action. |
| (no aria-label, just `title="..."`) | `title` is hover-only; screen readers skip it inconsistently. |

---

## 6. Inventory cheatsheet (full atomic list)

### 6.1 Nav (5)
| Component | Purpose |
|---|---|
| `NavPrevIcon` | 上一题 / 上一步 / 返回顶部 |
| `NavNextIcon` | 下一题 / 下一步 |
| `NavBackIcon` | 返回 (arrow + dot or chevron) |
| `NavCloseIcon` | 关闭 (Drawer / Modal) |
| `NavAnswerCardIcon` | 答题卡 (打开浮动 dock) |
| `NavSubmitIcon` | 提交 (✓ check) |

### 6.2 Tool (15)
| Component | Purpose |
|---|---|
| `ToolPauseIcon` / `ToolPlayIcon` | timer 暂停 / 继续 |
| `ToolSettingsIcon` | 设置 (cog) |
| `ToolThemeIcon` | 主题切换 (sun/moon split) |
| `ToolScratchIcon` | 草稿纸 (隐藏 / 显示) |
| `ToolPinIcon` | 钉住 clip / 笔记 |
| `ToolUndoIcon` / `ToolRedoIcon` | 撤销 / 重做 |
| `ToolSearchIcon` | 搜索 |
| `ToolSortIcon` | 排序 (Wrongbook list) |
| `ToolFilterIcon` | 筛选 |
| `ToolDownloadIcon` | 下载 (题目导出) |
| `ToolEyeIcon` | 查看材料 / 预览 |
| `ToolSendIcon` | 发送 / 提交 (申论) |
| `ToolFullscreenIcon` | 全屏 / 专注大作文模式 |
| AI / chat icons | Out of Phase 3 xingce answering-system scope. |

### 6.3 Action (7)
| Component | Pair |
|---|---|
| `ActionStarIcon` / `ActionStarFilledIcon` | 收藏 toggle |
| `ActionMarkIcon` / `ActionMarkFilledIcon` | 标记 toggle |
| `ActionNoteIcon` / `ActionNoteEditIcon` | 笔记 (无 / 有) |
| `ActionBookmarkIcon` | 加入题库 (一次性,不像 star/mark 频繁切换) |

### 6.4 Status (5)
| Component | Where |
|---|---|
| `StatusDoneIcon` | ✓ 已答 / 正确 / 已提交 |
| `StatusWrongIcon` | ✗ 答错 |
| `StatusPendingIcon` | ○ 未答 / 待办 |
| `StatusCurrentIcon` | ● 当前题 (filled accent dot) |
| `StatusLockedIcon` | 🔒 未解锁 (Q4 大作文) |

### 6.5 Subject (7)
| Component | Sidebar route |
|---|---|
| `SubjectHomeIcon` | / |
| `SubjectXingceIcon` | /practice/xingce |
| `SubjectEssayIcon` | /essay |
| `SubjectWrongbookIcon` | /wrongbook |
| `SubjectDashboardIcon` | /dashboard |
| `SubjectPlanIcon` | /plan |
| `SubjectProfileIcon` | /profile |

### 6.6 Composite (4)
| Component | Where |
|---|---|
| `NumberCircle` | FbDock / FbOpt / FbGroupTabs / WrongBook list |
| `NumberSquare` | Same surfaces, square Tweaks toggle |
| `MaterialBadge` | EssayMmStrip 左 |
| `QuestionBadge` | EssayMmStrip 右 / EditorPanel |

---

## 7. Common pitfalls

### 7.1 "I need an icon that doesn't exist"

DO:
- Bring it up in design review.
- Sketch it on paper / Figma first; show the design system owner.
- Once approved, draw it matching the visual language (1.4 stroke, 24-grid,
  currentColor).

DON'T:
- Inline a one-off SVG path in a component file.
- Substitute with an emoji.
- Substitute with a Lucide / Heroicons import.
- Substitute with a Unicode glyph (`✓` `★` `○`) — use a real SVG icon.

### 7.2 "I need to color the icon differently"

The icon's color comes from the parent `color` CSS prop (because the SVG uses
`currentColor`). Don't hack the SVG itself.

```tsx
// ✅
<IconBtn aria-label="错题" tone="destructive">
  <ActionMarkIcon />
</IconBtn>

// ❌
<IconBtn aria-label="错题">
  <ActionMarkIcon style={{ color: 'red' }} />
</IconBtn>
```

If you find yourself writing `style={{ color: ... }}` inline, you're either
(a) bypassing the tone variant of `IconBtn` — fix the variant — or (b) using
a hex value that should be a token — fix the token.

### 7.3 "The icon is too small / too big"

Each icon has documented size tokens. If the design is asking for an in-between,
push back. The tokens exist to prevent visual drift.

### 7.4 "This icon button doesn't have a label — what do I write?"

Every icon needs a Chinese aria-label. If you can't think of one in 30 seconds,
the action is probably ambiguous and the icon is the wrong choice.

### 7.5 "The icon is supposed to flash / animate"

Use CSS `transition: 120ms ease`. If you need keyframes, use `@keyframes` not
JavaScript. Animation rules:

| Property | Allowed | Why |
|---|---|---|
| `transition: color`, `background`, `opacity` | ✅ | Already in `IconBtn` base. |
| `transition: transform` | ⚠️ Sparingly | Don't shake icons; only for press feedback (`scale(0.96)` on `:active`). |
| `transition: stroke-dashoffset` | ⚠️ Spec | E.g. checkmark draw-on entry — pre-approve in design. |
| Spinning loading spinner | ✅ | Use a dedicated `LoadingSpinner` component, not an animated icon. |
| `animation: bounce` | ❌ | Never. Inappropriate for SIKAO tone. |

---

## 8. Lint commands

Run these before pushing:

```bash
cd frontend
npm run lint:hardcode        # hex colors / Tailwind defaults / tracking-[Nem]
npm run lint:radius-token    # rounded-[Npx] / Tailwind rounded-md/lg outside SSOT
npm run lint:italic          # CJK italic
npm run lint:icon-tokens     # (planned) icon-specific token discipline
npx tsc -b --noEmit          # IconBtn aria-label compile-time check
```

**Zero violations** required to merge. Escape hatches:

```tsx
{/* hardcode-allow: design exception, see PR #123 */}
<svg style={{ stroke: '#ff0000' }}>...</svg>

{/* icon-allow: legacy SIKAO icon, conversion in flight */}
<svg viewBox="0 0 20 20">...</svg>
```

---

## 9. Examples — refactoring existing code

### 9.1 Before / after — FbCard 操作条

**Before** (typical naive implementation):
```tsx
<div className="flex gap-2">
  <button className="rounded-md p-1.5 hover:bg-gray-100"
          onClick={toggleStar}
          title="收藏">
    {isStarred ? '⭐' : '☆'}
  </button>
  <button className="rounded-md p-1.5 hover:bg-gray-100"
          onClick={toggleMark}
          title="标记">
    📌
  </button>
  <button className="rounded-md p-1.5 hover:bg-gray-100"
          onClick={openNotes}>
    📝 笔记
  </button>
</div>
```

**After** (compliant):
```tsx
<div className="flex gap-1" role="toolbar" aria-label="题目操作">
  <IconBtn aria-label={isStarred ? '取消收藏' : '收藏'} aria-pressed={isStarred} onClick={toggleStar}>
    {isStarred ? <ActionStarFilledIcon /> : <ActionStarIcon />}
  </IconBtn>
  <IconBtn aria-label={isMarked ? '取消标记' : '标记'} aria-pressed={isMarked} onClick={toggleMark}>
    {isMarked ? <ActionMarkFilledIcon /> : <ActionMarkIcon />}
  </IconBtn>
  <IconBtn aria-label={hasNote ? '编辑笔记' : '添加笔记'} onClick={openNotes}>
    {hasNote ? <ActionNoteEditIcon /> : <ActionNoteIcon />}
  </IconBtn>
</div>
```

Improvements:
- No emoji.
- No `title` (uses `aria-label`).
- Uses `IconBtn` wrapper (focus, hover, accent color all unified).
- Toggle state via `aria-pressed`.
- Group has `role="toolbar"` for AT.
- `rounded-md` removed — IconBtn handles radius via `var(--r-sm)` if `chip` variant.

### 9.2 Before / after — FbDock

**Before**:
```tsx
{questions.map((q, i) => (
  <button
    key={q.id}
    className={cn('w-6 h-6 rounded-full text-xs',
      q.answered ? 'bg-black text-white' : 'border')}
    onClick={() => goto(i + 1)}
  >
    {i + 1}
  </button>
))}
```

**After**:
```tsx
{questions.map((q, i) => (
  <NumberCircle
    key={q.id}
    number={i + 1}
    status={
      q.id === currentQid ? 'current' :
      q.marked ? 'marked' :
      q.answered ? 'answered' :
      'unanswered'
    }
    size="sm"
    ariaLabel={`第 ${i + 1} 题, ${labelFor(q)}, 点击跳转`}
    onClick={() => goto(i + 1)}
  />
))}
```

Improvements:
- 5 distinct states, not 2.
- All colors / fonts / sizes flow through tokens.
- `marked` and `current` are visible (was completely missing).
- Single primitive call site.

---

## 10. When in doubt — flow chart

```
"I want to put a clickable icon here."
                │
                ▼
   Does the action have an obvious aria-label
   you can write in < 5 seconds in Chinese?
                │
        NO ────┼──── YES
        │              │
        ▼              ▼
   The icon is        Use IconBtn + the right icon
   ambiguous.         from §6.
   Add a text label   Pass aria-label.
   (use a Button,     Pick size from §4.
   not IconBtn) or
   redesign.
```

For everything else, `composite-icons-spec.md` and `SVG-ICON-DESIGN-SYSTEM.md`
have the long-form answers.
