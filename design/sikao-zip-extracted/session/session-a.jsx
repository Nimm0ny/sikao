// session-a.jsx — A 单选标准 · 全交互

const Q_A = {
  type: '言语理解',
  tag: '主旨概括',
  diff: '中',
  stem: '近年来，人工智能在医疗影像识别领域取得了长足进展，部分模型在肺结节、乳腺癌筛查等场景的准确率已经达到甚至超过资深放射科医生。然而，这并不意味着 AI 将替代医生——医疗决策从来不是单一影像问题，它需要综合病史、体征、检验、患者意愿等多维信息。AI 更合理的定位，是放大医生的判断力，而不是取代它。',
  options: [
    { k: 'A', text: 'AI 在医疗影像识别上已超过医生' },
    { k: 'B', text: 'AI 是医生判断力的放大器，而非替代品' },
    { k: 'C', text: '医疗决策需要综合多维信息' },
    { k: 'D', text: 'AI 在医疗领域的发展前景广阔' },
  ],
  answer: 'B',
  explain: '文段先肯定 AI 在影像识别上的成就（铺垫），通过转折词「然而」引出真正观点：医疗决策是综合性的，AI 应放大而非取代医生。最后一句直接点出主旨——AI 是放大器。',
};

function SessionA({ ctx }) {
  const { tweaks } = ctx;
  const [picked, setPicked] = React.useState(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [marked, setMarked] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e) => {
      if (submitted) {
        if (e.key === 'Enter' || e.key === 'ArrowRight') reset();
        return;
      }
      if (e.key >= '1' && e.key <= '4') setPicked(['A','B','C','D'][+e.key - 1]);
      if (e.key === 'Enter' && picked) setSubmitted(true);
    };
    // 仅在该 artboard hover 时绑定？简单起见，挂在 window
    return () => {};
  }, [picked, submitted]);

  const reset = () => { setPicked(null); setSubmitted(false); };
  const isCorrect = picked === Q_A.answer;

  return (
    <div className="session-canvas" style={{ width: '100%', height: '100%', background: 'var(--bg-alt)', display: 'flex', flexDirection: 'column' }}>
      <SessionHeader subject="行测 · 言语理解" paper="2024 国考真题（副省级）" qIndex={12} qTotal={40} mode={tweaks.mode} focus={tweaks.focus}/>
      <ProgressStrip total={40} current={12} answered={11}/>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '32px 56px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800, margin: '0 auto', width: '100%' }}>
          {/* 题型标签 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="chip">{Q_A.type}</span>
            <span className="chip muted">{Q_A.tag}</span>
            <span className="chip muted">难度 · {Q_A.diff}</span>
            <div style={{ flex: 1 }}/>
            <span style={{ fontSize: 11, color: 'var(--placeholder)', fontFamily: 'var(--mono)' }}>本题用时 00:42</span>
          </div>

          {/* 题干 */}
          <div className="q-stem" style={{ fontSize: 17, lineHeight: 1.85, color: 'var(--ink)', textWrap: 'pretty' }}>
            <span style={{ color: 'var(--placeholder)', fontFamily: 'var(--mono)', fontSize: 13, marginRight: 8 }}>12.</span>
            根据上述文段，作者意在强调的是：
          </div>

          {/* 材料 */}
          <div style={{
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '20px 24px',
            fontSize: 15,
            lineHeight: 1.9,
            color: 'var(--ink-muted)',
            textWrap: 'pretty',
            position: 'relative',
          }}>
            <div style={{ position: 'absolute', top: -1, left: 20, height: 2, width: 36, background: 'var(--brand)', borderRadius: 2 }}/>
            {Q_A.stem}
          </div>

          {/* 选项 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Q_A.options.map(o => {
              let cls = 'opt';
              if (submitted) {
                if (o.k === Q_A.answer) cls = 'opt correct';
                else if (o.k === picked) cls = 'opt wrong';
              } else if (picked === o.k) cls = 'opt selected';
              return (
                <div key={o.k} className={cls} onClick={() => !submitted && setPicked(o.k)}>
                  <div className="k">{o.k}</div>
                  <div style={{ flex: 1, fontSize: 14.5, lineHeight: 1.65 }}>{o.text}</div>
                  {submitted && o.k === Q_A.answer && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.6" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  )}
                  {submitted && o.k === picked && o.k !== Q_A.answer && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  )}
                </div>
              );
            })}
          </div>

          {/* 解析 */}
          {submitted && (
            <div style={{
              marginTop: 8,
              background: isCorrect ? 'var(--success-bg)' : 'var(--danger-bg)',
              border: `1px solid ${isCorrect ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: 12,
              padding: '18px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: isCorrect ? 'var(--success)' : 'var(--danger)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isCorrect ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  )}
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: isCorrect ? 'var(--success)' : 'var(--danger)' }}>
                  {isCorrect ? '回答正确' : '回答错误'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>· 正确答案 <b>{Q_A.answer}</b></span>
                <div style={{ flex: 1 }}/>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>正确率 67%</span>
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.85, color: 'var(--ink-muted)', textWrap: 'pretty' }}>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>解析：</span>
                文段先肯定 AI 在影像识别上的成就（铺垫），通过转折词
                <span style={{ background: '#fde68a', padding: '0 4px', margin: '0 2px', borderRadius: 3, fontWeight: 600 }}>「然而」</span>
                引出真正观点：医疗决策是综合性的，AI 应放大而非取代医生。
                <span style={{ textDecoration: 'underline', textDecorationColor: 'var(--success)', textDecorationThickness: 2, textUnderlineOffset: 3 }}>
                  最后一句直接点出主旨——AI 是放大器
                </span>。故选 B。
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn ghost tiny">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>
                  问 AI
                </button>
                <button className="btn ghost tiny">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  收藏
                </button>
                <button className="btn ghost tiny">类似题练习 · 8 道</button>
              </div>
            </div>
          )}

          {!submitted && (
            <div style={{ fontSize: 11, color: 'var(--placeholder)', textAlign: 'center', fontFamily: 'var(--mono)' }}>
              选答案后点「提交答案」查看解析
            </div>
          )}
        </div>

        <AIPanel open={tweaks.aiPanel}/>
      </div>

      <SessionFooter
        canSubmit={!!picked}
        submitted={submitted}
        marked={marked}
        onMark={() => setMarked(!marked)}
        onSubmit={() => setSubmitted(true)}
        onNext={reset}
        focus={tweaks.focus}
      />
    </div>
  );
}

window.SessionA = SessionA;
