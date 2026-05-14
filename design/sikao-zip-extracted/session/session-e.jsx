// session-e.jsx — 极简专注模式

function SessionE({ ctx }) {
  const [picked, setPicked] = React.useState(null);

  return (
    <div className="session-canvas" style={{ width: '100%', height: '100%', background: '#0b1120', display: 'flex', flexDirection: 'column', color: '#f1f5f9' }}>
      {/* 极简顶部 · 仅题号 + 计时 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 32px', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: '#64748b' }}>
        <span>12 / 40</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee' }}/>
          12:24
        </span>
        <span style={{ display: 'flex', gap: 14 }}>
          <span style={{ cursor: 'pointer' }}>退出专注</span>
        </span>
      </div>

      {/* 顶部进度条 · 极细 */}
      <div style={{ height: 1, background: 'rgba(255,255,255,.08)', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: 1, width: '30%', background: '#3b82f6' }}/>
      </div>

      {/* 题目主体 · 居中、留白 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 80px', maxWidth: 760, margin: '0 auto', width: '100%' }}>

        <div style={{ fontSize: 11, color: '#475569', fontFamily: 'var(--mono)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 24 }}>
          QUESTION 12 · 言语理解 · 主旨概括
        </div>

        {/* 题干小字 */}
        <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.85, marginBottom: 36, textWrap: 'pretty' }}>
          近年来，人工智能在医疗影像识别领域取得了长足进展，部分模型在肺结节、乳腺癌筛查等场景的准确率已经达到甚至超过资深放射科医生。<span style={{ color: '#fbbf24', fontWeight: 600 }}>然而</span>，这并不意味着 AI 将替代医生——医疗决策从来不是单一影像问题，它需要综合病史、体征、检验、患者意愿等多维信息。AI 更合理的定位，是放大医生的判断力，而不是取代它。
        </div>

        {/* 提问 · 大字 */}
        <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.5, marginBottom: 36, textWrap: 'balance', color: '#f1f5f9' }}>
          根据上述文段，作者意在强调的是？
        </div>

        {/* 选项 · 横向极简 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { k: 'A', text: 'AI 在医疗影像识别上已超过医生' },
            { k: 'B', text: 'AI 是医生判断力的放大器，而非替代品' },
            { k: 'C', text: '医疗决策需要综合多维信息' },
            { k: 'D', text: 'AI 在医疗领域的发展前景广阔' },
          ].map(o => (
            <div key={o.k} onClick={() => setPicked(o.k)} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px',
              background: picked === o.k ? 'rgba(59,130,246,.15)' : 'transparent',
              border: `1px solid ${picked === o.k ? '#3b82f6' : 'rgba(255,255,255,.08)'}`,
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'all .15s',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: picked === o.k ? '#3b82f6' : 'rgba(255,255,255,.05)',
                color: picked === o.k ? '#fff' : '#64748b',
                fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{o.k}</div>
              <div style={{ fontSize: 14.5, color: picked === o.k ? '#f1f5f9' : '#cbd5e1', flex: 1 }}>{o.text}</div>
              <div style={{ fontSize: 10, color: '#475569', fontFamily: 'var(--mono)' }}>
                {['1','2','3','4'][['A','B','C','D'].indexOf(o.k)]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 极简底部 · 键盘提示 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, padding: '24px 32px', fontFamily: 'var(--mono)', fontSize: 11, color: '#475569' }}>
        <span><kbd style={kbd}>1</kbd>–<kbd style={kbd}>4</kbd> 选答案</span>
        <span><kbd style={kbd}>⏎</kbd> 提交</span>
        <span><kbd style={kbd}>→</kbd> 下一题</span>
        <span><kbd style={kbd}>M</kbd> 标记</span>
        <span><kbd style={kbd}>?</kbd> 问 AI</span>
      </div>
    </div>
  );
}

const kbd = {
  display: 'inline-block',
  padding: '2px 6px',
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 4,
  marginRight: 4,
  color: '#94a3b8',
};

window.SessionE = SessionE;
