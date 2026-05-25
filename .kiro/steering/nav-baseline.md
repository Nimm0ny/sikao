---
inclusion: fileMatch
fileMatchPattern: "**/RootLayout*,**/Rail*,**/BottomTabBar*,**/AppShell*"
---

# Nav Baseline Lock (SIK-121 固化)

> 本文件是 nav 基座不变量。任何 agent 在读取 RootLayout / Rail / BottomTabBar / AppShell 相关文件时自动加载。

## 不变量

1. **Nav 项数 = 4**：`[首页, 练习, 复盘, 笔记]`，顺序固定，不可增删。
2. **Nav 项 id**：`home / practice / review / note`，不可改名。
3. **Nav href**：`/ / /practice / /review / /note`，不可改路径。
4. **Me 入口唯一**：仅由 RailMe avatar slot 提供（`aria-label="我的"`），不在 navItems 数组中。
5. **BottomTabBar 同步**：移动端 tabBarItems 必须与 navItems 保持一致（同 4 项）。
6. **禁止「题库」回归**：任何 `id: 'question-bank'` / `id: 'qbank'` / label 含「题库」的 nav 项一律禁止。

## 触发条件

以下操作**必须先获得 lhr 明确批准**才能执行：

- 修改 `RootLayout.tsx` 中 `navItems` 数组的长度、顺序、id、label、href
- 修改 `RootLayout.tsx` 中 `tabBarItems` 数组
- 在 `Rail.tsx` 中新增 navItem 渲染逻辑
- 在任何文件中新增 `id: 'me'` 到 navItems

## 验证锚点

- `RootLayout.test.tsx`：`expect(labels).toEqual(['首页', '练习', '复盘', '笔记'])`
- `RootLayout.test.tsx`：`expect(labels).not.toContain('我的')`
- `RootLayout.test.tsx`：`getAllByLabelText('我的').toHaveLength(1)`
- `Rail.test.tsx`：navList 内 `aria-label="我的"` = 0

## 来源

- `docs/plan/sik-rail-v5-visual-contract.md` §6 H01/H02
- SIK-121 W1 commit `bbcfdf4f8`
- lhr 2026-05-25 拍板
