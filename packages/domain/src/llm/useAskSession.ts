import { useCallback, useEffect, useState } from 'react';

/**
 * useAskSession — AskDrawer 会话状态 hook (PR10, 2026-05-13).
 *
 * SSOT: docs/design/handoff/Mobile and Tablet · Handoff.md §6.3.
 *
 * 三个约束:
 *   1. **6 轮上限** — 每个 questionId 限定 user message ≤ 6 条 (TURN_CAP),
 *      到顶后 disabled=true; assistant reply 不计入轮次.
 *   2. **24h localStorage TTL** — key=`ask:${questionId}`, 过期 record 启动
 *      时 silent drop (不抛). 跨标签 / 刷新 session 自动恢复.
 *   3. **assistant reply placeholder** — 真 LLM endpoint 接入留 backlog
 *      (PR10 prompt 显式禁: useAskSession.ask 只推 user msg, assistant
 *      auto-reply 由 BE 后续 wire 时实现).
 *
 * Fail-Fast (CLAUDE.md §4): JSON.parse 失败属于"持久化层信任 corruption" —
 * 旧版本格式 / 用户手动 edit / 跨域污染. 不静默 fallback 空 array (会让用户
 * 误以为新会话), 直接抛 → 路由层 ErrorBoundary 接管. localStorage 不可用
 * (Safari 隐私模式) 让 caller 见 throw.
 */

export interface AskMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly ts: number;
}

interface StoredSession {
  readonly messages: readonly AskMessage[];
  readonly ts: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const TURN_CAP = 6;
const KEY = (qid: string): string => `ask:${qid}`;

function loadFromStorage(questionId: string): readonly AskMessage[] {
  const raw = localStorage.getItem(KEY(questionId));
  if (raw === null) return [];
  const parsed: StoredSession = JSON.parse(raw);
  if (Date.now() - parsed.ts >= TTL_MS) {
    localStorage.removeItem(KEY(questionId));
    return [];
  }
  return parsed.messages;
}

function saveToStorage(questionId: string, messages: readonly AskMessage[]): void {
  const payload: StoredSession = { messages, ts: Date.now() };
  localStorage.setItem(KEY(questionId), JSON.stringify(payload));
}

export interface UseAskSessionReturn {
  readonly messages: readonly AskMessage[];
  readonly turns: number;
  readonly remaining: number;
  readonly disabled: boolean;
  readonly ask: (content: string) => void;
}

export function useAskSession(questionId: string): UseAskSessionReturn {
  // lazy init 拿首次 questionId 的历史. 后续 questionId 切换走 effect (RAF
  // 避开 sync setState in effect; react-hooks/set-state-in-effect 政策).
  const [messages, setMessages] = useState<readonly AskMessage[]>(() =>
    loadFromStorage(questionId),
  );

  // 切换 questionId 时重新加载 — 同 question 24h 内对话恢复, 新 question
  // 走 lazy init 跑过 (本 effect 仅在 questionId 后续变化时跑). RAF 把
  // setState 推到下个微任务, 满足 React 19 set-state-in-effect 规则.
  useEffect(() => {
    let cancelled = false;
    const raf = window.requestAnimationFrame(() => {
      if (cancelled) return;
      setMessages(loadFromStorage(questionId));
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [questionId]);

  // 任何 message 变动落盘. 空 list (e.g. 新会话刚 mount) 不写, 避免覆盖
  // 别的标签页同 question 已存在的历史 (浏览器 storage event 跨 tab 同步靠
  // 调用方手动 listen, 本 hook 不做).
  useEffect(() => {
    if (messages.length === 0) return;
    saveToStorage(questionId, messages);
  }, [messages, questionId]);

  const turns = messages.filter((m) => m.role === 'user').length;
  const remaining = Math.max(0, TURN_CAP - turns);
  const disabled = turns >= TURN_CAP;

  const ask = useCallback(
    (content: string): void => {
      if (disabled) return;
      const trimmed = content.trim();
      if (trimmed === '') return;
      const userMsg: AskMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      // TODO(2026-05-13 lhr): wire BE LLM endpoint to push assistant reply.
      // PR10 prompt 显式 backlog. 当前 user msg 入队即结束, 等 BE 出 streaming
      // endpoint 后在此 dispatch (或迁到独立 mutation hook).
    },
    [disabled],
  );

  return { messages, turns, remaining, disabled, ask };
}
