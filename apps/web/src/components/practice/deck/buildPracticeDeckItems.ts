import type { MaterialGroup, QuestionDetailV2, Section } from '@sikao/api-client/types/api';

export type PracticeDeckItem =
  | {
      readonly kind: 'question';
      readonly id: string;
      readonly sectionId: string;
      readonly sectionTitle: string;
      readonly question: QuestionDetailV2;
    }
  | {
      readonly kind: 'material_question';
      readonly id: string;
      readonly sectionId: string;
      readonly sectionTitle: string;
      readonly materialGroup: MaterialGroup;
      readonly question: QuestionDetailV2;
      readonly groupQuestionIndex: number;
      readonly groupQuestionCount: number;
    };

const MATERIAL_GROUP_QUESTION_COUNT = 5;

export function buildPracticeDeckItems(sections: readonly Section[]): PracticeDeckItem[] {
  return sections.flatMap((section) =>
    section.blocks.map((block) => {
      if (block.type === 'question') {
        if (block.question === undefined) {
          throw new Error(`question block ${block.blockId} is missing question`);
        }
        return questionItem(section, block.question);
      }
      if (block.type === 'material_group') {
        if (block.materialGroup === undefined) {
          throw new Error(`material group block ${block.blockId} is missing materialGroup`);
        }
        return materialGroupItems(section, block.materialGroup);
      }
      throw new Error(`unsupported practice block type: ${block.type}`);
    }).flat(),
  );
}

export function itemQuestionIds(item: PracticeDeckItem): string[] {
  return [String(item.question.questionId)];
}

export function findDeckIndexByQuestionId(
  items: readonly PracticeDeckItem[],
  questionId: string,
): number {
  return items.findIndex((item) => itemQuestionIds(item).includes(questionId));
}

function questionItem(section: Section, question: QuestionDetailV2): PracticeDeckItem {
  return {
    kind: 'question',
    id: `question:${question.questionId}`,
    sectionId: section.sectionId,
    sectionTitle: section.title,
    question,
  };
}

function materialGroupItems(section: Section, materialGroup: MaterialGroup): PracticeDeckItem[] {
  if (materialGroup.questions.length !== MATERIAL_GROUP_QUESTION_COUNT) {
    throw new Error(
      `material group must contain exactly five questions: ${materialGroup.materialGroupId}`,
    );
  }
  return materialGroup.questions.map((question, index) => ({
    kind: 'material_question',
    id: `material:${materialGroup.materialGroupId}:question:${question.questionId}`,
    sectionId: section.sectionId,
    sectionTitle: section.title,
    materialGroup,
    question,
    groupQuestionIndex: index,
    groupQuestionCount: materialGroup.questions.length,
  }));
}
