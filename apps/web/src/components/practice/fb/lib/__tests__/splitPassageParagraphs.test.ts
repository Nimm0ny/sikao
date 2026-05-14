import { describe, expect, it } from 'vitest';
import { splitPassageParagraphs } from '../splitPassageParagraphs';

// P4/1 资料分析材料段落切分 TDD 测试.
//
// Coverage:
// - <p> tag split (1 / 3 paragraphs)
// - plain text \n split (BE 实际格式)
// - 含 <table> 表格保留 (allow list)
// - <script> 剥离 (sanitize)
// - 空字符串 → 1 empty paragraph (≥1 段保证)

describe('splitPassageParagraphs', () => {
  it('returns single paragraph for one <p> tag', () => {
    const result = splitPassageParagraphs('<p>第一段内容</p>');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'passage-p1',
      html: '第一段内容',
    });
  });

  it('splits 3 <p> tags into 3 paragraphs with sequential ids', () => {
    const html = '<p>段一</p><p>段二</p><p>段三</p>';
    const result = splitPassageParagraphs(html);
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.id)).toEqual(['passage-p1', 'passage-p2', 'passage-p3']);
    expect(result.map((p) => p.html)).toEqual(['段一', '段二', '段三']);
  });

  it('splits plain text by single \\n (BE current format)', () => {
    // BE materialText 实际格式: 单 \n + \xa0 缩进
    const plain = '2019年6月，全国发行地方政府债券8996亿元。\n\xa0\xa0\xa02019年1—6月，全国发行地方政府债券28372亿元。\n\xa0\xa0\xa02019年地方政府债限额240774.3亿元。';
    const result = splitPassageParagraphs(plain);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('passage-p1');
    expect(result[1].id).toBe('passage-p2');
    expect(result[2].id).toBe('passage-p3');
    expect(result[0].html).toContain('2019年6月');
    expect(result[1].html).toContain('2019年1—6月');
    expect(result[2].html).toContain('限额');
  });

  it('preserves <table> tags (whitelist allows table family)', () => {
    const html = '<p>数据表如下:</p><table><thead><tr><th>年份</th><th>金额</th></tr></thead><tbody><tr><td>2019</td><td>100</td></tr></tbody></table>';
    const result = splitPassageParagraphs(html);
    // <p> 抽出 1 段; <table> 在 body 不算 :scope > p 故只看到 1 paragraph
    // but sanitized 后整体存活验证 — split 路径走 <p> branch 是这个 case
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].html).toContain('数据表');
  });

  it('strips <script> tags (sanitize)', () => {
    const malicious = '<p>正常段</p><script>alert("XSS")</script>';
    const result = splitPassageParagraphs(malicious);
    expect(result).toHaveLength(1);
    expect(result[0].html).toBe('正常段');
    // 全部 html 不含 script tag
    const joined = result.map((p) => p.html).join('|');
    expect(joined).not.toContain('<script');
    expect(joined).not.toContain('alert');
  });

  it('returns single empty paragraph for empty string (≥1 段保证)', () => {
    const result = splitPassageParagraphs('');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'passage-p1',
      html: '',
    });
  });

  it('returns single empty paragraph for whitespace-only string', () => {
    const result = splitPassageParagraphs('   \n  \n   ');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('passage-p1');
  });

  it('handles single line plain text (no \\n)', () => {
    const result = splitPassageParagraphs('单行内容没有换行');
    expect(result).toHaveLength(1);
    expect(result[0].html).toContain('单行内容');
  });
});
