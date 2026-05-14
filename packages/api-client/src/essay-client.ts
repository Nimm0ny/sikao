import type { AnswerSession, Paper, Question, SubmitResult } from '@sikao/domain/shenlun/types';
import { api } from './request';
import {
  mapBackendEssayPaper,
  type BackendEssayQuestion,
} from '@sikao/domain/shenlun/mapBackendPaper';

// EssayClient 鈥?abstraction so PRs 2-8 don't bind to mock vs real API.
// PR1 鍒囩湡鍚庣 submit (Promise.allSettled 骞跺彂 N 娆?POST /essay/grade).
// PR2 review P0 #9 鍚?SubmitResult.recordIds 绫诲瀷浠?number[] 鏀规垚
//   ReadonlyArray<number | null>, 闀垮害涓ユ牸 = paper.questions.length, 绌虹瓟妗?
//   澶辫触浣嶇疆 null 鈥?璁?results view PositionLabel 涓ユ牸鎸夐鍙峰榻? 涓嶅洜閮ㄥ垎
//   棰樼己澶辩揣鍑戞紓绉? csv 搴忓垪鍖?null 鍐欑┖娈?(e.g. "1,2,,4,5").
// snapshot 浠?localStorage (D3=A, 璺ㄨ澶囦笉缁瓟 known issue).

const SNAPSHOT_KEY_PREFIX = 'exam-session-v2:';

// 鍚庣 EssayGradingV2 schema 瀛愰泦 (鎴戜滑鍙 id 鏉ユ瀯 recordIds).
// 瀹屾暣 shape 鍦?frontend/src/types/api.ts EssayGradingV2 (auto-generated).
interface GradingRecordResponse {
  readonly id: number;
}

export interface EssayClient {
  getPaper(code: string): Promise<Paper>;
  loadSnapshot(paperCode: string): Promise<AnswerSession | null>;
  saveSnapshot(paperCode: string, data: AnswerSession): Promise<void>;
  // submit 鏁村嵎 = N 娆?POST /essay/grade. questions 绗?3 鍙傜敱 EssayExam.tsx
  // 閫忎紶 paper.questions (EssayClient 鑷繁鎷夸笉鍒? store 鍦?useExamSession).
  submit(
    paperCode: string,
    data: AnswerSession,
    questions: readonly Question[],
  ): Promise<SubmitResult>;
}

export const mockEssayClient: EssayClient = {
  async getPaper(code) {
    throw new Error(
      `mockEssayClient.getPaper is test-only; import @sikao/api-client/essay-client.mock for ${code}`,
    );
  },

  async loadSnapshot(paperCode) {
    const raw = readStorage(SNAPSHOT_KEY_PREFIX + paperCode);
    if (!raw) return null;
    return JSON.parse(raw) as AnswerSession;
  },

  async saveSnapshot(paperCode, data) {
    writeStorage(SNAPSHOT_KEY_PREFIX + paperCode, JSON.stringify(data));
  },

  async submit(paperCode, data, questions) {
    // Mock submit 鈥?璧?realEssayClient 鍚屾牱鐨?杩囨护绌虹瓟妗?+ 鎷掔粷鍏ㄧ┖"閫昏緫,
    // 鍙槸涓嶅彂 HTTP. recordIds 闀垮害 = questions.length, 绌虹瓟妗堜綅缃?null
    // (璺?paper.questions 棰樺彿瀵归綈, 闃?PositionLabel 閿欎綅).
    const slotted = mapQuestionSlots(data, questions);
    if (slotted.every((s) => s === null)) {
      throw new Error('all answers are blank 鈥?refuse to submit empty exam');
    }
    writeStorage(
      SNAPSHOT_KEY_PREFIX + paperCode + ':submitted',
      JSON.stringify({ ...data, phase: 'submitted' satisfies AnswerSession['phase'] }),
    );
    const base = Date.now();
    let counter = 0;
    return {
      recordIds: slotted.map((slot) => (slot === null ? null : base + counter++)),
    };
  },
};

export const realEssayClient: EssayClient = {
  async getPaper(code) {
    const questions = await api.get<readonly BackendEssayQuestion[]>(
      `/papers/${code}/questions`,
    );
    return mapBackendEssayPaper(code, questions);
  },

  async loadSnapshot(paperCode) {
    return mockEssayClient.loadSnapshot(paperCode);
  },

  async saveSnapshot(paperCode, data) {
    return mockEssayClient.saveSnapshot(paperCode, data);
  },

  async submit(_paperCode, data, questions) {
    // 1) 鎸?paper.questions 椤哄簭浜х敓 slotted 鏁扮粍. 绌虹瓟妗堥浣嶇疆 null (D7=B
    //    SubmitDialog 宸?UI 灞傛嫤鎴?纭寮冭€?, 杩欓噷鏁版嵁灞傚厹搴?.
    const slotted = mapQuestionSlots(data, questions);
    if (slotted.every((s) => s === null)) {
      throw new Error('all answers are blank 鈥?refuse to submit empty exam');
    }
    // 2) 浠呭闈炵┖ slot 鍙?POST. Promise.allSettled 淇濊瘉缁撴灉椤哄簭 = 杈撳叆椤哄簭,
    //    鎵€浠?slot index 鈫?results index 1:1 鏄犲皠 (璺熺┖ slot 閿欏紑).
    const targets = slotted
      .map((slot, paperIdx) => (slot === null ? null : { ...slot, paperIdx }))
      .filter((t): t is SubmitTarget & { paperIdx: number } => t !== null);
    const results = await Promise.allSettled(
      targets.map((t) =>
        api.post<GradingRecordResponse>('/essay/grade', {
          questionId: t.backendId,
          answerText: t.answerText,
        }),
      ),
    );
    // 3) 鎶?fulfilled record id 鍐欏洖 paper.questions 椤哄簭鐨勪綅缃? rejected /
    //    绌虹瓟妗堜綅缃粛涓?null. PositionLabel 姘歌繙璺熼鍙峰榻? 涓嶆紓绉?(review P0 #9).
    const recordIds: Array<number | null> = questions.map(() => null);
    targets.forEach((t, i) => {
      const result = results[i];
      if (result.status === 'fulfilled') {
        recordIds[t.paperIdx] = result.value.id;
      }
    });
    if (recordIds.every((id) => id === null)) {
      throw new Error('all essay grade submissions failed');
    }
    return { recordIds };
  },
};

// 鈹€鈹€ 鍐呴儴 helpers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

interface SubmitTarget {
  readonly backendId: number;
  readonly answerText: string;
}

// 鎸?paper.questions 椤哄簭浜?N 涓?slot (length = questions.length). 绌虹瓟妗堥
// 瀵瑰簲浣嶇疆 null. 璺?textsByQ[index] 涓ユ牸瀵归綈, 璁╀笅娓?recordIds 闀垮害 = N 涓?// 绱у噾 (review P0 #9 淇, 闃?PositionLabel 閿欎綅).
function mapQuestionSlots(
  data: AnswerSession,
  questions: readonly Question[],
): ReadonlyArray<SubmitTarget | null> {
  return questions.map((q, idx) => {
    const raw = data.textsByQ[idx] ?? '';
    const trimmed = raw.trim();
    return trimmed.length > 0
      ? ({ backendId: q.backendId, answerText: trimmed } as const)
      : null;
  });
}

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

function writeStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}

export const essayClient: EssayClient = realEssayClient;
