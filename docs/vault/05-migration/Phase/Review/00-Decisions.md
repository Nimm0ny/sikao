# Phase-Review · 00 · Decisions

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md)（字段命名 / 表结构 / 路径 delta）
> **SSOT 声明**：本文是 Phase-Review 全部决策的唯一来源。下游文档（01~11）引用本文条目编号；冲突时**以 A0 为准**。

> **2026-05-28 runtime truth update**：本文中保留的 `/q/:id` / `/q/:id/redo` 主要用于历史设计与跨 Phase 追溯；本文不再承担当前 router authority，当前 QuestionHub 入口以 `/question-hub` 为准。

---

## 1. 跨 Phase 继承决策（IA-V2 原始来源）

本 Phase 继承并遵守以下 IA-V2 决策，不再展开：

| 决策 | 原始拍板 | 对 Review 的硬约束 |
|---|---|---|
| D1 | 5 tab 方案 A | 复盘 = Tab 3，路由 `/review` |
| D7 | 答题脱壳 | `/q/:id/redo` 全屏脱壳 |
| D8 | 智能复盘 S-front 本地聚合 | 不走后端 smart 端点 |
| D9 | 错题重做走完整 session | 复用 PracticeSessionV2(source_mode=wrong_redo) |
| D15 | 脱壳路由 6 条 | `/q/:id/redo` 在列 |
| D-Fav-Location | 收藏夹归 Notes tab | 收藏不入 SRS 队列 |
| D-Question-Hub | `/q/:id` 独立中枢页 | 跨 tab deep link 终点 |
| D-Review-Default-View | 默认 = 今日 + 智能三卡 + 周回顾条 | 不展示全部错题（P7 防压） |

Practice 继承：

| 决策 | 对 Review 的影响 |
|---|---|
| Flag-AutoReview | session.commit 自动写 ReviewItemV2(source_kind=flagged_persistent) — 本 Phase 消费侧 |
| Pace-7 整组闭卷 | 复盘 session 不受此约束（PR-R4 强制 per_question） |
| Note-1~7 题级笔记 | 题目中枢页展示 + 创建（复用 NoteV2.linked_question_id） |
| Practice source_mode=wrong_redo | 重做 session 从这入口建 |

---

## 2. R 系列 — 一级 IA 决策

| # | 问题 | 拍板 | 理由 |
|---|---|---|---|
| **R-1** | 入队来源 | 多源融合（wrong_answer / flagged_persistent / re_failed / manual_add / note_card） | 单源太窄或太宽；多源用 source_kind 区分 |
| **R-2** | "队列" vs "智能复盘"边界 | 队列 = 后端 ReviewItemV2；智能 = 前端 S-front 聚合 | 与 D8 一致；不阻塞后端进度 |
| **R-3** | `/review/all` segment 切分 | 4 segment：错题 / 标记 / 手动 / 智能 | 不同入队来源心智不同，分开展示 |
| **R-4** | 列表布局 | 移动 R1 单列 + 桌面 R3 双列 | 与 IA-V2 §2.3.3 一致 |
| **R-5** | 毕业语义 | ~~连续答对 N=2 次自动 graduated~~ → **连续答对 N=4 次进入 probationary + 30 天后系统抽查通过才 final graduated**；用户手动 mark_resolved 直接进 probationary（不跳过抽查）(2026-05-21 修订) | 原 2 次太短→考前崩盘；probationary 防假毕业；mark_resolved 尊重用户但保留验证 |
| **R-6** | 删除语义 | 软删 archived（status=archived，保留审计） | 物理删回不来；强制保留 = 体验差 |

---

## 3. D-R 系列 — 深层设计决策

| # | 问题 | 拍板 | 关联 |
|---|---|---|---|
| **D-R1** | 重做模型 | PracticeSessionV2(source_mode=wrong_redo, linked_review_id=N) | 与 D9 一致；不新建 review_session 表 |
| **D-R2** | 复盘 session 节奏 | 强制 practice_mode=per_question（前后端双校验） | 复盘 = 立即反馈纠错；闭卷无意义 |
| **D-R3** | 已下线 AI 题 | 可重做（review session 正常）不可重出（出题池排除 is_active=false） | 用户做过且记错，需要复盘 |
| **D-R4** | 智能三卡数据源 | ReviewItemV2 + 最近 N=200 PracticeSessionAnswerV2 | 不依赖 stats snapshot，避免循环依赖 |
| **D-R5** | 智能卡数量 | 固定 3 张（高频错点 / 长期未碰 / 预测再错） | 移动端友好；与 Home 三段卡模式一致 |
| **D-R6** | AI 错因触发 | 100% 按需（详情页按钮 + 多题聚合按钮），无订阅模式 | 避免烧 LLM 配额 |
| **D-R7** | AI 错因缓存 | 键=(user_id, question_id, last_answer_hash)；快照变化即失效 | 重做后错因可能变化 |
| **D-R8** | "加入计划"路径 | 走 RecommendationV2 流（type=review_session, accept→session 走 linked_recommendation_id） | 与 Home Rec-9 一致，不引第二条写入路径 |
| **D-R9** | 题目中枢页 题级笔记 | 展示 + 创建（复用 NoteV2.linked_question_id + Practice Note-5 逻辑） | 沿用 Practice Note-5 |
| **D-R10** | 错题列表筛选 | source_kind / 题型 / 题源(真题/AI 题) / 时间窗 / SRS 档位 | 不含全文搜索（需 FTS 索引，不在本 Phase） |
| **D-R11** | "已掌握"展示 | `/review/all` 内 toggle"显示已掌握"，默认关 | 不增 segment 数 |
| **D-R12** | SRS 触发时机 | session.commit 同事务内实时更新 ReviewItemV2 SRS state | 体验最好；O(1) 计算不阻塞 |
| **D-R13** | SRS 部署形态 | API 进程内同步调用（不引 worker / Redis） | AGENTS H10 单机部署 |
| **D-R14** | 与首页弱项关系 | 单向：WeaknessSnapshotV2 增加 contributions.review 维度 from ReviewItemV2 聚合 | Home 是消费方，Review 是信号源 |

---

## 4. SRS 系列 — 间隔重复算法决策

| # | 决策 | 拍板 | 理由 |
|---|---|---|---|
| **SRS-1** | 算法选型 | ~~简化版（correct_streak + 二档间隔 1d/3d → graduated at streak=2）~~ → **4 档间隔 [1d, 3d, 7d, 21d] + probationary(30d) + confidence 调幅**；GRADUATION_THRESHOLD=4；schema 预留 SM-2 字段 (2026-05-21 修订) | 原 2 档太短致考前崩盘；4 档覆盖 3-6 个月备考周期 |
| **SRS-2** | state 字段 | correct_streak / next_review_at / status / **version（乐观锁）** 为主逻辑字段；ease_factor / interval_days / repetitions 三个 nullable 字段预留 SM-2；status 枚举增加 **probationary** | Schema 一次到位避免 migration |
| **SRS-3** | 答错回退 | 回到上一档（不回 new） | A 太严苛；C 用户感知不到惩罚 |
| **SRS-4** | next_review_at 时区 | 用户本地时区（profile_v2.info.timezone） | 公考备考强本地节奏 |
| **SRS-5** | "today" 边界 | next_review_at <= today_end_local（同 Home today 定义） | 与首页今日推荐 / 计划用同一个 today |
| **SRS-6** | graduated 后再错 | 新行 ReviewItemV2(source_kind=re_failed)；不覆盖原行 | 防"假毕业"；保留历史轨迹 |
| **SRS-7** | 费曼复述加成 | ~~用户填写 recall_text 后 next_interval *= 2~~ → **与 confidence 协同：multiplier 取决于 confidence × recall 矩阵表**（详见 [14-Confidence-Rating](./14-Confidence-Rating.md) §4）(2026-05-21 修订) | 蒙对+recall 不应翻倍；certain+recall 才给最高加成 |
| **SRS-8** | 乐观锁 | ReviewItemV2 增加 `version` 列；任何 SRS 状态变更后 version +1；commit 时 WHERE version=expected 做 CAS | 跨设备并发防 race condition |
| **SRS-9** | 算法版本切换 | metadata_json.algorithm_version ∈ {simple_v1, sm2_v1}；用户级别可选（默认 auto）；迁移走 streak → SM-2 state 映射 | 远期升级路径明确，不破坏现有用户体验 |

### SRS 四档间隔表（修订版）

```
correct_streak=0  →  next_review_at = today_end + 1d
correct_streak=1  →  next_review_at = today_end + 3d
correct_streak=2  →  next_review_at = today_end + 7d
correct_streak=3  →  next_review_at = today_end + 21d
correct_streak=4  →  status = probationary, next_review_at = today_end + 30d (系统抽查)
probationary 抽查通过 → status = graduated, next_review_at = NULL
probationary 抽查失败 → 新行 ReviewItemV2(source_kind=re_failed), 原行 next=NULL
```

Confidence × Recall 间隔倍数表：
```
               ¬Recall   +Recall
  guess:        ×1        ×1      (蒙对不享受加成)
  unsure:       ×0.5      ×1      (recall 抵消半懵惩罚)
  likely:       ×1        ×1.5
  certain:      ×1        ×2      (最高加成 + 触发 early graduated)
```

答错时：
```
if correct_streak > 0:
    correct_streak -= 1  # 回退一档
else:
    correct_streak = 0   # 保持 0 档（next = today_end + 1d）
```

---

## 5. AI-Cause 系列 — 错因分析决策

| # | 决策 | 拍板 |
|---|---|---|
| **AI-Cause-1** | 复用 LLM 模块 | 复用 Phase-Home `modules/llm/`，追加 prompt: cause_analysis_single / cause_analysis_group |
| **AI-Cause-2** | 输入边界 | 单题：题面 + 用户答案 + 正确答案 + 解析 + 历史错次数；组：N 题结构化摘要（题型+错因标签） |
| **AI-Cause-3** | 输出结构 | ~~`{ summary, dimensions: [{name, severity, suggestion}], suggested_actions }`~~ → `{ summary, dimensions: [{slug, name_display, severity, suggestion}], suggested_actions, evolution_context }` (2026-05-21 修订) — dim.slug 必须在 [13-Cause-Taxonomy](./13-Cause-Taxonomy.md) 词典 enum 内 |
| **AI-Cause-4** | 长度限制 | summary ≤ 200 字；dimensions ≤ 5；suggested_actions ≤ 3 |
| **AI-Cause-5** | 限流 | 每用户每日 N=20 次（与 AI 出题分桶，共享 daily_llm_quota） |
| **AI-Cause-6** | 幂等 | POST 必带 Idempotency-Key（继承 Phase-Home IdempotencyKeyV2） |
| **AI-Cause-7** | 缓存策略 | **单题**：键=(user_id, question_id, last_answer_hash)；TTL=30d；快照变化即失效。**多题聚合**：键=(user_id, sorted_question_ids_hash)；不含 per-question last_answer_hash（已知 trade-off：组内某题重做后组分析可能略滞后，但避免 N 次 hash 查询的性能开销） |
| **AI-Cause-8** | 失败兜底 | 503 + 文案"AI 分析暂时不可用，请稍后再试"；不影响列表正常使用（PR-R6） |
| **AI-Cause-9** | 反馈机制 | 👍/👎 → RecommendationFeedbackV2(type=cause_analysis_single|cause_analysis_group) |
| **AI-Cause-10** | "保存为笔记" | 用户点击 → NoteV2(type=ai_cause_analysis, linked_question_id, body=result_json.summary) |
| **AI-Cause-11** | Forced 分析 | confidence=certain + 答错 → 系统自动触发（不计 daily_quota），使用 `cause_analysis_forced` prompt 变体 |
| **AI-Cause-12** | Deep 分析 | is_hard=true 题由 cron 自动触发（daily_deep_quota=5 独立桶），使用 `cause_analysis_deep` prompt 变体 |
| **AI-Cause-13** | Evolution context | 同题多次分析时注入上一次诊断 + 建议执行评估，让 LLM 判断改善趋势 |

---

## 6. 重做引擎决策

| # | 决策 | 拍板 |
|---|---|---|
| **Redo-1** | 选项打乱 | review session 创建时 config_snapshot.shuffle_options=true（防记忆假效应） |
| **Redo-2** | 费曼复述 | 答完后展示可填可跳的输入框"为什么选这个？"；填写后 metadata_json.used_recall=true + SRS-7 加成 |
| **Redo-3** | 重做反馈 | 答完后展示"这是第 N 次重做，前 N-1 次 X 对 Y 错" |
| **Redo-4** | 批量重做 | 多选 → 创建 PracticeSessionV2(source_mode=wrong_redo, question_ids=[...], config_snapshot.linked_review_ids=[...]) |
| **Redo-5** | pace 强制 | review session practice_mode 强制 per_question（前后端双校验，与 D-R2 一致） |

---

## 7. 周回顾系统决策

| # | 决策 | 拍板 |
|---|---|---|
| **Weekly-1** | 数据来源 | 实时聚合：ReviewItemV2 + ReviewAttemptV2（本周范围）+ NoteV2(created_at in 本周) |
| **Weekly-2** | 展示位置 | 复盘 tab 默认视图顶部条（永远可见） |
| **Weekly-3** | 内容 | "本周复盘 X 道 · 再做正确率 Y% · 新增笔记 Z 条" |
| **Weekly-4** | 一键生成笔记 | 调 LLM → NoteV2(type=weekly_review, body=生成文案) |
| **Weekly-5** | 持久化 | 不单独建表；NoteV2(type=weekly_review) 即为持久化产物 |
| **Weekly-6** | cron 预生成 | 每周一 02:00（用户本地时区）预计算上周数字快照，写入 metadata_json 供快速展示（避免首次打开慢查） |

---

## 8. 数据洞察 `/review/insights` 决策

| # | 决策 | 拍板 |
|---|---|---|
| **Insights-1** | 图表数量 | 3 张（错题趋势 / 错因聚类 / 再做正确率） |
| **Insights-2** | 错题趋势 | 90 天窗口；每日 incorrect 入队 / graduated 出队 / 净累积三线 |
| **Insights-3** | 错因聚类 | ~~基于 dimensions[].name 标签频次~~ → 基于 **effective_slug**（含 user_override）频次条形图（依赖 [13-Cause-Taxonomy](./13-Cause-Taxonomy.md) 词典）(2026-05-21 修订) |
| **Insights-4** | 再做正确率 | 按周聚合曲线（ReviewAttemptV2 outcome=correct / incorrect per week） |
| **Insights-5** | 无数据 | `<EmptyChartPlaceholder>` 组件 + "做 5 次以上复盘后展示" |

---

## 9. 题目中枢页 `/q/:id` 决策

| # | 决策 | 拍板 |
|---|---|---|
| **QHub-1** | 路由归属 | 独立顶层路由，不在 AppShell children 内（但不脱壳，保留 RailMini/TabBar） |
| **QHub-2** | ctx 参数 | ?ctx=practice\|review\|note\|favorite\|home\|**topic_drill**（决定返回目标 + 重做 source_mode + 按钮可见性）|
| **QHub-3** | 内容区块 | 题面 + 选项 + 答题历史(**含 confidence badge**) + **思路对比** + 正确答案 + 解析 + AI 错因卡(**含 EvolutionTimeline + CauseTagOverrideModal**) + 题级笔记区 + 关联笔记提示 |
| **QHub-4** | 操作区 | 去重做 / 收藏 / 持久标记 / 加入复盘 / 加入计划 / 已掌握 / 归档 / 写笔记 / 分析错因 / **练同类 N 道(topic_drill)** / **找相关笔记** |
| **QHub-5** | 响应式布局 | 移动=单列纵堆；桌面=主内容区 + 侧栏（笔记 + 知识点关联 + 上下题导航） |
| **QHub-6** | 关联笔记提示 | 如果该题有 NoteV2(linked_question_id=:id)，顶部小条提示"你 X 天前写过笔记 →" |
| **QHub-7** | 旧路由 redirect | /wrong-book/:id → /q/:id?ctx=review 等整族 redirect（详见 A0 §3.5） |
| **QHub-8** | 警示条群 | 顶部按优先级叠放：OfflineBanner > ConfidenceMismatchBanner > HardQuestionBadge > ProbationaryBanner > ForcedAnalysisPendingHint |
| **QHub-9** | 思路对比区块 | total_wrong_count ≥ 2 时显示第一次错 vs 最近一次错的 confidence + 错因 + evolution_trend |
| **QHub-10** | "练同类 N 道" | POST /practice/sessions(source_mode=topic_drill)；filter={category_l2, cause_tags, difficulty}；不自动入 SRS |
| **QHub-11** | "找相关笔记" | 跳转 /notes?cause_tags={dim.slug}；Phase-Notes 消费该 query 参数 |
| **QHub-12** | dim_focus 参数 | URL ?dim_focus=slug 时该 DimensionCard 高亮 |

---

## 10. 跨 Tab 联动决策

| # | 决策 | 拍板 |
|---|---|---|
| **Cross-1** | 收藏 → 复盘 | 手动（收藏夹每题有"加入复盘"按钮 → source_kind=manual_add）；不自动入队 |
| **Cross-2** | 笔记 → 复盘 | 手动（题级笔记有"加入复盘"按钮 → source_kind=manual_add + metadata_json.source_note_id） |
| **Cross-3** | AI 摘要 → 复盘卡 | source_kind=note_card（Phase-Notes 实施，本 Phase schema 兼容预留） |
| **Cross-4** | 复盘 → 笔记 | 错因分析"保存为笔记" → NoteV2(type=ai_cause_analysis)；周回顾"生成笔记" → NoteV2(type=weekly_review) |
| **Cross-5** | 复盘 → 首页 | WeaknessSnapshotV2.contributions.review 单向聚合；today list 实时读 due 题数 |
| **Cross-6** | 首页 → 复盘 | Home 弱项卡点击 → `/review/all?filter={topic}`；today list 复盘项 → `/q/:id?ctx=home` |
| **Cross-7** | 练习答题中 | **不显示**"你错过这题"信号（避免心理暗示）；答完页 / 答题历史 / Q-Hub **显示**状态徽标 |
| **Cross-8** | 双向同步 | 复盘标完成 → today list 自动打勾（通过 RecommendationV2 status=completed + linked_review_id 关联） |
| **Cross-9** | Home Streak 含复盘 | 复盘连续天数独立维护（每日 ≥ daily_target_completed 算达标）；Home achievement 合并展示 |
| **Cross-10** | "练同类"调用契约 | POST /practice/sessions(source_mode=topic_drill)；Practice schema 需追加 enum 值 |
| **Cross-11** | "找相关笔记"反向链 | Q-Hub → /notes?cause_tags=... → Phase-Notes 消费 |
| **Cross-12** | Confidence 跨 Tab | Practice + Review 共用 ConfidenceRatingPrompt；写入 attempt.notes_json + item.metadata |
| **Cross-13** | Session 中途退出 | 已答推进 SRS（per answer commit），未答不变；前端 beforeunload + 后端 30min 超时 |
| **Cross-14** | Cause Override 高频 → Notes 建议 | 同 tag override > 5 次(30d) → Notes tab 建议写专项笔记 |
| **Cross-15** | Debt 跨 Tab 同步 | Home today 计数 = debt-aware（min(daily_limit, due_count)）；ramp-up 期间固定推送数 |

---

## 11. Phase-Review 范围明确

### 11.1 在范围内（完整清单）

- 复盘默认视图 `/review`（**DebtBar** + 周回顾条 + SRS 今日队列 + 智能三卡）
- 全部错题 `/review/all`（4 segment + 筛选 + 排序 + 多选批量 + 已掌握 toggle）
- 数据洞察 `/review/insights`（3 张图 + **信心分布图**）
- 已掌握 `/review/graduated` + 归档区 `/review/archived`
- 题目中枢页 `/q/:id`（跨 tab 共用 + **警示条群 + 思路对比 + EvolutionTimeline + TopicDrillSetupModal + CauseTagOverrideModal**）
- 错题重做 `/q/:id/redo`（脱壳，复用 PracticeSessionV2）
- AI 错因分析（单题按需 + 多题聚合 + **forced + deep + evolution context**）
- **错因词典 cause_tag_v2**（16 tag + 强制 LLM enum + parser 兜底 + 用户覆盖 + 反馈聚合）
- SRS 排队引擎（**4 档间隔 + probationary + confidence 调幅 + 乐观锁 version** + schema 预留 SM-2）
- **Confidence Rating**（4 档主观信心 + guess 不进毕业 + unsure 阻毕业 + certain 早毕业 + mismatch 告警）
- **Debt Management**（daily_limit + severity 分级 + 打散重排 + ramp-up 回归保护 + 难题专项 is_hard）
- 周回顾系统（实时聚合 + cron 预生成 + 一键生成笔记 + **biggest_progress / biggest_concern / next_week_focus**）
- **复盘 Streak**（连续天数维护 + Home achievement 展示）
- **"练同类 N 道"** topic_drill 功能（source_mode + filter + 跨 Phase 契约）
- 选项打乱 + 费曼复述输入框
- 跨 tab 联动（写入 / 读取 / 反向流 / **Cross-9~15 全部新增流**）
- 路由 redirect（/wrong-book/* / /practice/questions/* / 老 /review/items/*）
- Legacy wrong-book 组件清理（删 / 迁 / 重写）
- audit + observability + e2e + OpenAPI

### 11.2 不在范围内

- 题型分布饼图（与错因聚类重复）
- 365 天 GitHub 风格热力图（观赏性 > 决策性）
- 通知中心独立 view（与首页 today list 重复职责）
- AI 错因自动订阅模式（按需触发即可）
- WeeklyReviewSummaryV2 单独成表（用 NoteV2 替代）
- 题目相似题推荐（黑盒 AI 功能用户不用）
- 错题导出 PDF / 打印
- 跨用户错题对比 / 分享 / 排行
- 错题级 LLM 长对话讲题
- 申论错题 / 错段复盘
- SM-2 / FSRS 完整算法（预留字段，远期升级）
- 笔记主 view / 收藏夹 view / 富文本编辑器（归 Phase-Notes）
- 题库管理后台（归 admin Phase）

---

## 14. Debt 系列 — 复盘债务管理决策

| # | 决策 | 拍板 |
|---|---|---|
| **Debt-1** | 债务定义 | overdue = next_review_at <= today_end AND status ∈ active |
| **Debt-2** | 每日上限 | daily_limit 默认 30（profile_v2.info.review_daily_limit 可调 10~100） |
| **Debt-3** | severity 分级 | none / light / moderate / heavy / critical；阈值按 daily_limit 倍数（×1 / ×3 / ×7 OR oldest>14d） |
| **Debt-4** | 打散重排 | severity=heavy 自动或用户手动触发；均匀分布到未来 min(14, ceil(overdue/daily_limit)) 天；不改 streak |
| **Debt-5** | ramp-up 回归保护 | 连续 7 天未登录后首次回归触发 5 阶段 ramp-up（10/15/20/25/daily_limit）；不打散（避免双重干扰） |
| **Debt-6** | 难题专项 is_hard | re_fail_count≥3 / total_wrong≥5+accuracy<30% / confidence_mismatch≥2 / 平均用时>2x 任一触发 |
| **Debt-7** | 难题专项系统行为 | CardA 权重×2 / Q-Hub 红条 / 自动 deep analysis / 间隔不翻倍（覆盖 recall 加成） |
| **Debt-8** | 难题"出狱" | 连续 4 次答对（含 probationary check 通过）OR 用户手动点"我掌握了"(fresh start) |

详见：[12-Debt-Management](./12-Debt-Management.md)

---

## 15. Confidence 系列 — 信心评级决策

| # | 决策 | 拍板 |
|---|---|---|
| **Confidence-1** | 4 档定义 | guess / unsure / likely / certain（字符串枚举存储） |
| **Confidence-2** | guess 答对不递增 | streak 不变；next 按当前 streak 原地复算（防蒙对假毕业） |
| **Confidence-3** | unsure 阻毕业 | 即使 streak 达到 GRADUATION_THRESHOLD 也强制卡住再做一次（下次 likely+ 才允许） |
| **Confidence-4** | certain + recall 早毕业 | streak ≥ GRADUATION_THRESHOLD - 1 + certain + used_recall → 提前进 probationary |
| **Confidence-5** | certain + 错 = mismatch | 标记 metadata.confidence_mismatch_count += 1；强制 cause-analysis；≥ 2 次标 is_hard |
| **Confidence-6** | 跳过默认 | confidence=null 按 likely 等价处理；skip_count>5 近 30 题则下次强制弹出 |
| **Confidence-7** | ramp-up 期间限制 | ramp-up 期间 certain 选项不展示（避免回归首日错估自我） |

详见：[14-Confidence-Rating](./14-Confidence-Rating.md)

---

## 16. Taxonomy 系列 — 错因词典决策

| # | 决策 | 拍板 |
|---|---|---|
| **Taxonomy-1** | 词典规模 | v1 = 15 业务 tag + 1 兜底 other，分 3 大类（knowledge / reasoning / state） |
| **Taxonomy-2** | slug 不可变 | 一旦发布禁止 rename；如需改用 deprecate(is_active=false) + 新增 |
| **Taxonomy-3** | LLM 强制 enum | prompt 中列出全部 slug；parser 校验不在 enum 内的强制归 other + 存 _llm_original |
| **Taxonomy-4** | 用户覆盖 | PATCH /dimensions/:idx；写 user_override 不删 LLM 原输出；聚类/Insights 优先用 user_override slug |
| **Taxonomy-5** | 词典存储 | cause_tag_v2 表（slug, name, category, severity_default, is_active, taxonomy_version） |
| **Taxonomy-6** | 词典演进 | 新增 tag → taxonomy_version +1；name/description/order 可改；slug 永不改 |
| **Taxonomy-7** | other 监控 | other_fallback 计数 metric；月触发率 > 10% 触发词典扩展评估 |
| **Taxonomy-8** | 反馈按 tag 维度聚合 | 👎 + dimensions_disagreed 记录到 metadata_json；周报告输出 top down tags |
| **Taxonomy-9** | evolution context | 同题多次分析注入上次诊断 + 建议执行评估；LLM 输出 comparison_judgment |

详见：[13-Cause-Taxonomy](./13-Cause-Taxonomy.md)

---

## 17. Weekly 系列修订 — 周回顾增强决策

| # | 决策 | 拍板 |
|---|---|---|
| **Weekly-7** | 质化亮点 biggest_progress | WeeklySummaryResponseV2 增加 biggest_progress（本周最大进步题）、biggest_concern（最高频错因 tag）、next_week_focus（预测重点） |
| **Weekly-8** | 月/季度回顾占位 | /review/insights?period=month\|quarter 路由预留 + EmptyState；不实施聚合逻辑 |

---

## 12. 决策变更流程

1. 在本文对应条目行用 `~~删除线~~` 标注旧值 + 新行写新值 + 日期
2. PR description 标 `BREAKING DECISION CHANGE: {条目编号}`
3. 同步更新 README §3 关键决策速查
4. 同步更新 A0 §11 修订清单（如涉及字段名 / 路径变更）
5. reviewer 必须检查下游 01~11 是否一致

---

## 13. 引用矩阵

本文被以下文档引用：

| 引用方 | 引用条目 |
|---|---|
| README.md §3 | 关键决策速查（摘录） |
| 01-Boundary-Rules | PR-R1~R11 逐条引 R/D-R/SRS/Debt/Confidence/Taxonomy |
| 02-Data-Model | source_kind 枚举 / SRS 字段 / AiCauseAnalysisV2 结构 / cause_tag_v2 / version 列 |
| 03-Backend-WU | 全部 WU 的决策依据 |
| 04-Frontend-WU | 全部 WU-FR 的决策依据 |
| 05-SRS-Engine | SRS-1~9 |
| 06-AI-Cause-Analysis | AI-Cause-1~13 |
| 07-Smart-Review-Aggregation | D-R4 / D-R5 |
| 08-Question-Hub-Page | QHub-1~12 |
| 09-Cross-Tab-Wiring | Cross-1~15 |
| 10-NonFunctional | D-R12 / D-R13 / AI-Cause-5 |
| 11-Testing | PR-R / SRS invariant / Debt / Confidence / Taxonomy 测试矩阵 |
| 12-Debt-Management | §14 Debt-1~8 |
| 13-Cause-Taxonomy | §16 Taxonomy-1~9 |
| 14-Confidence-Rating | §15 Confidence-1~7 |
