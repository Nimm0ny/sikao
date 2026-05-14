import DOMPurify from 'dompurify';

// P4/1 资料分析材料段落切分 (SIKAO 答题系统行测).
//
// 数据现状 (2026-05-11 BE staging 调研, see .claude/import-staging/FENBI-100197/
// paper.standard.json material_group.material_text):
//   - BE materialText 已是 plain text (无 <p> tags), 段落分隔 = 单 \n
//     + 缩进 \xa0 (HTML  ).
//   - 部分 paper materialText 为空字符串 (groupKind=data_analysis 但 BE
//     ETL 未抽到). 兼容: 空字符串返回 1 个 empty paragraph (≥1 段保证).
//   - 未来 BE 若改用 <p> wrapper, 此 helper 会优先按 <p> split, 兜底
//     单 \n.
//
// Sanitize 策略:
//   - DOMPurify.sanitize 显式 allow <table>/<thead>/<tbody>/<tr>/<td>/<th>
//     (资料分析图表表格). <script>/<style>/<iframe> 等危险 tag 默认剥离.
//   - 不允许 dangerouslySetInnerHTML 出去前没 sanitize (frontend/CLAUDE.md §2.5).
//
// Split 策略 (优先级):
//   1. sanitize 后用 DOMParser 抽 <body> 顶层 <p> 节点 —— 若 ≥1 个 <p>,
//      每个 <p> = 一段.
//   2. 否则 sanitized 字符串按 \n 拆 (BE plain text 实情). 过滤空白行.
//   3. 否则只剩 sanitized 整段 (含 \xa0 indent 不破坏) = 1 段.
//   4. 空字符串 → 1 个 empty paragraph (UI 还是能渲 sticky 容器).

export interface PassageParagraph {
  readonly id: string;
  readonly html: string;
}

const ALLOWED_TABLE_TAGS = ['table', 'thead', 'tbody', 'tr', 'td', 'th'] as const;

export function splitPassageParagraphs(content: string): PassageParagraph[] {
  const sanitized = DOMPurify.sanitize(content ?? '', {
    ADD_TAGS: [...ALLOWED_TABLE_TAGS],
  });

  // Try <p> tags first (future BE may wrap).
  const doc = new DOMParser().parseFromString(sanitized, 'text/html');
  const pNodes = Array.from(doc.body.querySelectorAll(':scope > p'));
  if (pNodes.length >= 1) {
    return pNodes.map((node, idx) => ({
      id: `passage-p${idx + 1}`,
      html: node.innerHTML,
    }));
  }

  // Fallback: split sanitized plain text by \n (BE current format).
  // 注: 保留 \xa0 (nbsp) 缩进, 只 trim 行首尾 \s 不含 nbsp.
  const lines = sanitized.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length >= 1) {
    return lines.map((line, idx) => ({
      id: `passage-p${idx + 1}`,
      html: line,
    }));
  }

  // Empty fallback: ensure ≥1 paragraph (UI invariant).
  return [{ id: 'passage-p1', html: '' }];
}
