---
type: engineering
status: active
owner: lhr
last-reviewed: 2026-05-13
anchors:
  - CLAUDE.md §8 VPS / 部署铁律
  - CLAUDE.md §9 提交子仓的顺序铁律（submodule，sikao 单仓不适用）
  - CLAUDE.md §10 文档组织
---

# Git / GitHub 协作规矩

本文档是 **单人 + monorepo** 工作流下的 git 铁律。规则继承自 `web_new` 仓库 2026-04-23 的 git 体检事件（详见附录 A —— 10 个 commit 从未 push、3 个僵尸分支、2 个僵尸 worktree、66 个文件被 `skip-worktree` 位静默藏起、远端 3 个 commit 与本地架构硬对撞），固化清理后的规矩防复发。

> **本文规矩适用于 `sikao` 主仓**（<https://github.com/Nimm0ny/sikao>，npm workspaces 单仓，已无 submodule）。
>
> **当前状态**：sikao 主仓尚未初始化 git。本文是规范文档，git init 后立即生效。历史 `claude/*` 分支只存在于 `web_new` 仓库（<https://github.com/Nimm0ny/web_new>），sikao 不继承。

## 1. 分支生命周期

### 1.1 命名与语义

| 前缀 | 语义 | 生命周期 | 上游 |
|---|---|---|---|
| `main` | 唯一长命分支 / release 基线 | 永久 | 绑 `origin/main`，push 时自动 tracking |
| `codex/<slug>` | AI 会话工作分支（短命，每个 worktree 一枚） | **≤ 单个会话** | 不绑 upstream，不直接 push |
| `claude/*` | **历史遗留**（仅 `web_new`），sikao 不新建 | 限清理（如有迁移过来的） | 同上 |

### 1.2 短命分支强制生命周期

所有 `codex/*` 分支必须走完这条链路才能关窗口：

```
create branch (auto via worktree spawn)
  → commit(s) on branch
  → rebase onto main (or merge main in, if conflict-heavy)
  → merge back to main (--ff-only if possible)
  → 在主仓 worktree 里 push main 到 origin
  → 删分支 (git branch -D codex/<slug>)
  → 删 worktree (git worktree remove <worktree-root>/<slug>)
```

**禁止**：让 `codex/*` 分支独立存在 > 24h，或让它的 commit 绕过 main 直接 push 到 origin（GitHub 上只应该看到 `origin/main`，没有其它分支）。

### 1.3 忘了清理的事后补救

如果发现本仓有多个 `codex/*` 或历史 `claude/*` 僵尸分支：

```bash
# 先备份（90 天内可 git push origin <tag>:main --force 恢复）
git tag backup/<branch-sanitized>-$(date +%Y%m%d) <branch>

# 若分支挂在 worktree 上，先断 worktree
git worktree remove --force <worktree-root>/<slug>

# 再删分支
git branch -D <branch>
```

**例外**：如果僵尸分支包含 main 不含的独有 commit，先判断这些 commit 的内容是否还需要：
```bash
git log --oneline main..<zombie-branch>                 # 看独有 commit 列表
git diff --name-only <zombie-branch>..main --diff-filter=D  # 看 main 缺哪些文件
git diff <zombie-branch>..main --shortstat              # 看总变化量
```
- 独有 commit 的文件都在 main 里、且 main 的内容更新 → 安全删
- 独有 commit 有 main 没有的文件或内容 → 先 cherry-pick / 手动救回再删（参考附录 A 的 `inspiring-kilby` 救援）

## 2. Session-End = push 才算 done

> 写下 commit 但没推到 origin，等于没做。机器一挂 / worktree 一删 / `git reset --hard` 一下都能丢。

每次会话结束前（「今天到这」/「下班」/「关窗口」等任意退场信号）必须确认：

```bash
cd <main-worktree>
git fetch origin                          # 拉最新 origin/main
git status                                # working tree 必须 clean
git log origin/main..main --oneline       # 必须为空，或打算立即 push
git push origin main                      # 如果非空就推
```

如果有 `codex/*` 短命分支还没 merge 回 main，要么完成 merge 后 push，要么在 commit message / session-end note 明确标注「待 merge」—— 不允许沉默离场。

**例外**：
- 主动决定推迟的 WIP（显式记录在某处：plan.md / memory / handoff doc）
- 远端出现**非本人**的新 commit（rare 但要处理，见 §4）

## 3. 每周卫生扫描

### 3.1 skip-worktree / assume-unchanged 位

```bash
git ls-files -v | grep -vE "^H "          # 任何非 H（normal）行都要看
```

- `H` = 正常跟踪，健康
- `S` = skip-worktree（**sparse-checkout 副作用，静默藏修改 —— 危险**）
- `h` = assume-unchanged（`git update-index --assume-unchanged` 的标记，通常是手滑）
- 其它单字母看 `git help update-index` 的「Reporting」段

**清理**：

```bash
# 一次性清所有 skip-worktree 位
git ls-files -v | awk '/^S / {print $2}' | xargs git update-index --no-skip-worktree

# 一次性清所有 assume-unchanged 位
git ls-files -v | awk '/^h / {print $2}' | xargs git update-index --no-assume-unchanged
```

清完**必须** `git status` 一次，冒出来的本地改动逐个处理（commit / discard / reset），不要敷衍合并进下一个提交。

### 3.2 僵尸分支 / worktree

```bash
git branch -vv                            # 看所有本地分支的 tracking 状态
git worktree list                         # 看所有 worktree
```

发现任何：
- 不在用的 worktree（> 24h 无活动、无 pending commit）
- 独有 commit 已 merge 回 main 但未删的 `codex/*` 分支
- 历史 `claude/*` / 其它历史前缀分支（如有从 web_new 迁过来）

按 §1.3 流程清理。

### 3.3 远端同步

```bash
git fetch origin                          # 拉最新
git log --all --oneline --since='7 days ago' | head -20    # 扫近 7 天全部分支活动
git log origin/main..main                 # 本地领先 origin 的 commit
git log main..origin/main                 # 远端领先本地的 commit（两者之一非空就是分叉）
```

发现分叉**先停**，按 §4 处理，不要盲目 rebase / merge / pull。

## 4. 分叉 / 冲突处理

### 4.1 远端有本地没有的 commit（场景：另一台机器或会话推过）

1. `git log --stat main..origin/main` —— 看远端改了什么文件 + 作者 + 时间
2. 判断远端 commit 是否是**你自己**做的（作者 email 核对）、内容是否仍想要
3. 决策树：
   - **远端想保留、本地想保留、文件不冲突** → `git rebase origin/main`，本地 commit 摞在远端之上
   - **远端想保留、本地想保留、文件冲突** → 逐个 commit rebase + 手动解冲突
   - **远端要放弃、本地要保留**（例如 web_new 2026-04-23 对撞的 3 commit）：
     ```bash
     git tag backup/origin-main-$(date +%Y%m%d) origin/main    # 打 safety tag
     git push --force-with-lease origin main                   # 强推本地 main
     # 90 天内可用 git push origin backup/origin-main-<date>:main 恢复
     ```
   - **本地要放弃** → `git reset --hard origin/main`，丢弃本地 commit（慎重）

### 4.2 强推铁律

- **永远不用 `git push --force`**，用 `--force-with-lease`（检查远端是否被第三方动过）
- **永远不用 `--no-verify` 跳 hook**，有问题修 hook 或改代码
- 强推前**必须**打 safety tag，90 天内可恢复
- 单人仓强推 main 无他人 blast radius，但仍然要按上面流程走，避免养成坏习惯

## 5. 每次 commit 的卫生底线

- 原子 commit：一次一事，prefix `fix/feat/refactor/docs/chore/test`（参考 CLAUDE.md §4）
- ≤ 15 文件 / ≤ 400 行净增 per commit
- 不混合异构改动（`feat + refactor`、`fix + chore` 都是红旗）
- `.env` / 密钥 / 大二进制：**禁止** commit，`.gitignore` 拦住
- plan.md / CHANGELOG.md 的进度日志**必须**在触发它的同一 commit 里落地，不允许事后补

## 6. 复杂度兜底

当 git 状态开始让人**感觉混乱**（分支多到记不清 / 分不清 worktree 属于哪个 session / origin 与本地谁领先说不清）：

1. **停手**，不做任何会改变 ref 的操作（`push` / `merge` / `rebase` / `reset`）
2. 跑一遍 §3 的卫生扫描，把现状全景抓出来
3. 在 session / handoff doc 里写一段 **现状摘要**：分支 / worktree / 分叉点 / 未 push 的 commit 列表
4. 按本文 §1–4 的顺序逐步清理，每清一步先打 safety tag

复杂度越高，越要**慢**和**备份**。

---

## 附录 A — web_new 历史教训参照（2026-04-23 整改事件）

> sikao 工程规矩 §8 + 本文规矩继承自 `web_new` 仓库 2026-04-23 的一次 git 整改事件。本附录保留作为「why」来源，防止 sikao 重蹈覆辙。

本规矩的所有条款都对应一次真实损失场景：

| 规矩 | 对应事件（web_new） |
|---|---|
| §1.2 短命分支必走 merge-then-delete | `claude/inspiring-kilby-e84ea3` / `claude/dazzling-lederberg-9f59d8` 僵尸到 worktree 里 |
| §1.3 僵尸分支需事先查独有 commit | `inspiring-kilby` 的 worktree 里有 118 行未提交的 phase 3.1/3.2/3.3 进度日志，差点跟着分支一起删掉 |
| §2 session-end 必 push | main 本地领先 origin **10 个 commit** 长达 24h+，从未 push |
| §3.1 skip-worktree 周扫 | `git ls-files -v \| grep "^S "` 一次性捞出 **66 个**被 sparse-checkout 残留藏起来的文件（apps/exam-api 全部后端代码都在内） |
| §4.1 远端有本地没有的 commit → 先停 | 远端 3 个 commit 建了一套并行的 `ProductShell` UI 架构，差点 blind merge 成双壳跑不起来 |
| §4.2 强推必打 safety tag | `backup/origin-main-before-force-push` 保了被抹的 817a138 / c843291 / 35fbb67，90 天可恢复 |
| §5 plan.md 同 commit 落地 | `85ff224` commit message 说「log phase 3.1/3.2/3.3」，实际 diff 里这三段根本没写 |
