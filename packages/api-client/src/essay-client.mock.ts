import { PAPER_BY_CODE } from '@sikao/test-utils/essayExamMock';
import {
  mockEssayClient as baseMockEssayClient,
  type EssayClient,
} from './essay-client';

export const mockEssayClient: EssayClient = {
  ...baseMockEssayClient,
  async getPaper(code) {
    const paper = PAPER_BY_CODE[code];
    if (!paper) {
      throw new Error(`mock paper not found: ${code}`);
    }
    return paper;
  },
};
