import type { Block, MaterialGroup, QuestionDetailV2, Section } from '@sikao/api-client/types/api';
import type { FlatQuestion } from './useFbSession';

// SIKAO Phase 3 (2026-05-09): SectionGroup 派生 + flat question helpers.
//
// 抽自 PracticeSession.tsx (单文件 ≤500 行硬约束). 有限窗口核心 derivation:
//   blocks → questions[] → 跨 section 累计 displayNo → SectionGroup[]
//
// PracticeSession (顶层 view) 跟 FbReadingCol / FbDockBody (子组件) 共享.
//
// .ts (无 JSX), 无副作用.
//
// P4/3 (2026-05-11): 新增 SectionGroupItem + SectionItemsGroup + buildSectionItems
// 给 FbReadingCol 渲资料分析 material_group 用 (保留 material 元信息).
// 原 buildSectionGroups + SectionGroup 不动 — FbDockBody 继续 flat 用 (答题
// 卡只显示题号 grid, 不需要 material 信息).

export interface SectionGroup {
  readonly sectionId: string;
  readonly title: string;
  readonly chapterIndex: number;
  readonly questions: readonly FlatQuestion[];
}

/** P4/3: 一组 section 的渲染 items, discriminated union 保留 material 元信息. */
export type SectionGroupItem =
  | { readonly kind: 'question'; readonly question: QuestionDetailV2; readonly displayNo: number }
  | {
      readonly kind: 'material-group';
      readonly materialGroup: MaterialGroup;
      readonly questions: ReadonlyArray<{
        readonly question: QuestionDetailV2;
        readonly displayNo: number;
      }>;
    };

export interface SectionItemsGroup {
  readonly sectionId: string;
  readonly title: string;
  readonly chapterIndex: number;
  readonly items: readonly SectionGroupItem[];
}

export function listSectionQuestions(section: Section): QuestionDetailV2[] {
  return section.blocks.flatMap(blockQuestions);
}

function blockQuestions(block: Block): QuestionDetailV2[] {
  if (block.type === 'question' && block.question !== undefined) return [block.question];
  if (block.type === 'material_group' && block.materialGroup !== undefined) {
    return block.materialGroup.questions ?? [];
  }
  return [];
}

export function totalQuestionCount(sections: readonly Section[]): number {
  return sections.reduce((acc, s) => acc + listSectionQuestions(s).length, 0);
}

export function buildSectionGroups(sections: readonly Section[]): SectionGroup[] {
  let displayNo = 0;
  return sections.map((section, sectionIndex) => {
    const flat: FlatQuestion[] = listSectionQuestions(section).map((q) => {
      displayNo += 1;
      return {
        question: q,
        displayNo,
        sectionId: section.sectionId,
        sectionTitle: section.title,
      };
    });
    return {
      sectionId: section.sectionId,
      title: section.title,
      chapterIndex: sectionIndex + 1,
      questions: flat,
    };
  });
}

/**
 * P4/3: 构建 SectionItemsGroup[], 保留 material_group 元信息.
 *
 * displayNo 跨 material 子题连续累计 (跟 buildSectionGroups 一致),
 * 保证交卷 displayNo 校验跟 dock grid 显示一致.
 */
export function buildSectionItems(sections: readonly Section[]): SectionItemsGroup[] {
  let displayNo = 0;
  return sections.map((section, sectionIndex) => {
    const items: SectionGroupItem[] = [];
    for (const block of section.blocks) {
      if (block.type === 'question' && block.question !== undefined) {
        displayNo += 1;
        items.push({ kind: 'question', question: block.question, displayNo });
      } else if (block.type === 'material_group' && block.materialGroup !== undefined) {
        const mgQuestions = block.materialGroup.questions ?? [];
        const subItems = mgQuestions.map((q) => {
          displayNo += 1;
          return { question: q, displayNo };
        });
        items.push({ kind: 'material-group', materialGroup: block.materialGroup, questions: subItems });
      }
    }
    return {
      sectionId: section.sectionId,
      title: section.title,
      chapterIndex: sectionIndex + 1,
      items,
    };
  });
}
