// groupByExamSession — review P1 #2 best-effort 整卷模考记录聚合 hint.
//
// EssayGradingRecord 是单题级 (D2=A 决策, 不引 EssayExamSession 表). 用户跑
// 一卷 5 题 = 5 条独立 record, /essay/history 默认按 createdAt DESC 单条列出.
// reviewer 提的 UX 缺口: 用户看到 10 条独立 record 没法判断哪 5 条是同一次模考.
//
// 临时解 (0 BE 改): 相邻 record createdAt 间隔 ≤ 30s 视为同一组. 单题练习
// (用户在 /essay/papers 选一题独立提交) 通常间隔远 > 30s, 不会误聚合;
// 整卷交卷时 Promise.allSettled 并发, 5 个 record 落库时间窗一般 < 1s, 30s
// 阈值留足余量 (BackgroundTask 评分异步, createdAt 是 record 创建时刻).
//
// 30s 阈值的边界场景:
//   - 用户跑同卷 2 次, 第 2 次紧跟第 1 次 < 30s → 误聚合成 10 题. 不阻断功能,
//     用户自己能区分 (entry 查看 record id 不同).
//   - 用户跑跨卷 2 次紧贴 → 误聚合. 同上 (questionId 不同). UX 噪声而非 bug.
//
// records 按 createdAt DESC 排好 (backend list_my_records ORDER BY DESC).
// helper 不重排序, 直接相邻判断.

import type { EssayGradingV2 } from '@sikao/api-client/types/api';

const GROUP_WINDOW_MS = 30 * 1000;

export interface ExamSessionGroup {
  // 该组内 record (按 createdAt DESC). 单题 group length=1, 整卷 group length=N.
  readonly records: readonly EssayGradingV2[];
  // length > 1 时 view 给"整卷模考"标记.
  readonly isExamSession: boolean;
}

export function groupByExamSession(
  records: readonly EssayGradingV2[],
): readonly ExamSessionGroup[] {
  if (records.length === 0) return [];
  const groups: EssayGradingV2[][] = [[records[0]]];
  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1];
    const curr = records[i];
    const prevTs = Date.parse(prev.createdAt);
    const currTs = Date.parse(curr.createdAt);
    // 容错: createdAt 解析失败 (Number.isNaN) → 不聚合, 保守拆出新组.
    const valid = Number.isFinite(prevTs) && Number.isFinite(currTs);
    const diffMs = valid ? Math.abs(prevTs - currTs) : Number.POSITIVE_INFINITY;
    if (diffMs <= GROUP_WINDOW_MS) {
      groups[groups.length - 1].push(curr);
    } else {
      groups.push([curr]);
    }
  }
  return groups.map((records) => ({
    records,
    isExamSession: records.length > 1,
  }));
}
