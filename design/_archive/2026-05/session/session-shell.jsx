// session-shell.jsx — Session 系列共用零件 · 仅此文件 destructure
const { useState, useEffect, useRef } = React;

// ── 顶栏 ──────────────────────────────────────────
function SessionHeader({ subject, paper, qIndex, qTotal, mode, onExit, onPause, dense, focus }) {
  if (focus) return null;
  return (
    <div style={{
      height: dense ? 52 : 60,
      borderBottom: '1px solid var(--line)',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 16,
      flexShrink: 0,
    }}>
      <div onClick={onExit} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--ink-muted)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        <span style={{ fontSize: 13, fontWeight: 500 }}>退出</span>
      </div>
      <div style={{ width: 1, height: 18, background: 'var(--line)' }}/>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{subject}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{paper}</span>
      </div>

      <div style={{ flex: 1 }}/>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-muted)' }}>
        <span style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 15 }}>{String(qIndex).padStart(2, '0')}</span>
        <span style={{ color: 'var(--muted)' }}>/ {qTotal}</span>
      </div>

      <div style={{ width: 1, height: 18, background: 'var(--line)' }}/>

      <Timer mode={mode}/>

      <button className="btn ghost tiny" onClick={onPause}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        暂停
      </button>
    </div>
  );
}

// ── 计时器 ──────────────────────────────────────────
function Timer({ mode }) {
  const [s, setS] = useState(742);
  useEffect(() => {
    const t = setInterval(() => setS(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(s / 60), ss = s % 60;
  const isExam = mode === 'exam';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 12px',
      background: isExam ? 'var(--warn-bg)' : 'var(--bg-alt)',
      border: `1px solid ${isExam ? '#fde68a' : 'var(--line)'}`,
      borderRadius: 8,
      fontFamily: 'var(--mono)',
      fontSize: 13,
      fontWeight: 600,
      color: isExam ? '#a16207' : 'var(--ink)',
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>
      <span>{String(m).padStart(2,'0')}:{String(ss).padStart(2,'0')}</span>
    </div>
  );
}

// ── 题号面包屑（顶部进度条） ──────────────────────────────────────────
function ProgressStrip({ total, current, answered }) {
  return (
    <div style={{ display: 'flex', gap: 3, height: 4, padding: '0 24px', background: 'var(--bg)' }}>
      {Array.from({ length: total }, (_, i) => {
        const filled = i < answered;
        const isCur = i === current - 1;
        return (
          <div key={i} style={{
            flex: 1,
            background: isCur ? 'var(--brand)' : filled ? 'var(--brand-100)' : 'var(--line)',
            borderRadius: 2,
          }}/>
        );
      })}
    </div>
  );
}

// ── 底部操作栏 ──────────────────────────────────────────
function SessionFooter({ canSubmit, submitted, onPrev, onNext, onSubmit, onMark, marked, focus }) {
  return (
    <div style={{
      height: focus ? 56 : 64,
      borderTop: '1px solid var(--line)',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 12,
      flexShrink: 0,
    }}>
      <button className="btn ghost tiny" onClick={onPrev}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        上一题
      </button>

      <button className="btn ghost tiny" onClick={onMark} style={{ color: marked ? 'var(--warn)' : undefined }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill={marked ? 'var(--warn)' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        {marked ? '已标记' : '标记'}
      </button>

      <div style={{ flex: 1 }}/>

      {!focus && (
        <div style={{ fontSize: 11, color: 'var(--placeholder)', fontFamily: 'var(--mono)' }}>
          1-4 选答案 · Enter 提交 · → 下一题
        </div>
      )}

      {!submitted ? (
        <button className="btn brand tiny" onClick={onSubmit} disabled={!canSubmit} style={{ opacity: canSubmit ? 1 : .5 }}>
          提交答案
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </button>
      ) : (
        <button className="btn brand tiny" onClick={onNext}>
          下一题
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </button>
      )}
    </div>
  );
}

// ── AI 解答抽屉 ──────────────────────────────────────────
function AIPanel({ open, onClose }) {
  if (!open) return null;
  return (
    <div style={{
      width: 320,
      borderLeft: '1px solid var(--line)',
      background: 'var(--bg-alt)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700 }}>AI 助教</span>
        <div style={{ flex: 1 }}/>
        <button className="btn ghost tiny" onClick={onClose} style={{ padding: '4px 6px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div style={{ flex: 1, padding: 18, overflow: 'auto', fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.7 }}>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6, fontSize: 12 }}>提示 · 不剧透答案</div>
          这道题的关键在「转折词」。<span style={{ background: '#fef3c7', padding: '0 3px' }}>"然而"</span> 之后才是作者真正想强调的——你看一下这个词后面那一句话的语义重点。
        </div>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6, fontSize: 12 }}>类似题</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>2023 国考 · 言语理解 · 第 17 题</div>
          这道题考察类似的 <span className="chip muted" style={{ fontSize: 10, padding: '1px 6px' }}>主旨概括 + 转折</span>
        </div>
      </div>
      <div style={{ padding: 12, borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--line-strong)', borderRadius: 10, background: 'var(--bg)' }}>
          <input placeholder="问 AI 一个问题…" style={{ flex: 1, border: 0, outline: 'none', fontSize: 12, fontFamily: 'inherit', background: 'transparent' }}/>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.2" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SessionHeader, Timer, ProgressStrip, SessionFooter, AIPanel });
