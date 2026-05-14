/**
 * Category name canonicalization — 修 fenbi import 脏数据.
 *
 * fenbi 抓的题库有个别错字 (资料分斩 / 资科分析 等), 用户看到困惑.
 * 这里用 alias map 显式 normalize, 后续如果 DB 还有错字 → 加这里 +
 * audit 一遍 SELECT DISTINCT name FROM categories.
 */
export const CATEGORY_ALIASES: Record<string, string> = {
  '资料分斩': '资料分析',
  '资科分析': '资料分析',
  // TODO(扩展): grep DB 找其他错字加这里
};

export function canonicalizeCategoryName(raw: string): string {
  if (!raw) return raw;
  return CATEGORY_ALIASES[raw] ?? raw;
}

export function dedupeAndCanonicalize<T extends { name: string }>(items: readonly T[]): T[] {
  const seen = new Map<string, T>();
  for (const it of items) {
    const canonical = canonicalizeCategoryName(it.name);
    if (!seen.has(canonical)) {
      seen.set(canonical, { ...it, name: canonical });
    }
  }
  return Array.from(seen.values());
}
