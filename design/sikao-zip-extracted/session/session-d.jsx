// session-d.jsx — 答题卡抽屉

const STATUS = {
  done:    { bg: 'var(--brand)',     fg: '#fff',           label: '已答' },
  current: { bg: '#fff',             fg: 'var(--brand)',   label: '当前', border: 'var(--brand)' },
  marked:  { bg: 'var(--warn-bg)',   fg: 'var(--warn)',    label: '标记', border: '#fde68a' },
  blank:   { bg: 'var(--bg-alt)',    fg: 'var(--muted)',   label: '未答', border: 'var(--line)' },
  skip:    { bg: '#f1f5f9',          fg: 'var(--placeholder)', label: '跳过', border: 'var(--line)' },
};

// 130 题模拟数据
const seedData = (total, current) => {
  const arr = [];
  for (let i = 1; i <= total; i++) {
    let s = 'blank';
    if (i === current) s = 'current';
    else if (i < current) {
      const r = (i * 37) % 100;
      if (r < 75) s = 'done';
      else if (r < 88) s = 'marked';
      else s = 'skip';
    }
    arr.push({ n: i, s });
  }
  return arr;
};

function NumChip({ n, s }) {
  const cfg = STATUS[s];
  return (
    <div style={{
      width: 32, height: 32,
      borderRadius: 8,
      background: cfg.bg,
      color: cfg.fg,
      border: `1.5px solid ${cfg.border || cfg.bg}`,
      fontSize: 12, fontWeight: 700,
      fontFamily: 'var(--mono)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
      position: 'relative',
    }}>
      {n}
      {s === 'marked' && (
        <svg style={{ position: 'absolute', top: -3, right: -3 }} width="10" height="10" viewBox="0 0 24 24" fill="var(--warn)" stroke="var(--warn)" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
      )}
    </div>
  );
}

const SECTIONS = [
  { name: '常识判断', range: [1, 20], color: 'var(--brand)' },
  { name: '言语理解', range: [21, 60], color: '#0891b2' },
  { name: '数量关系', range: [61, 75], color: '#7c3aed' },
  { name: '判断推理', range: [76, 115], color: '#db2777' },
  { name: '资料分析', range: [116, 130], color: '#ea580c' },
];

function SessionD({ ctx }) {
  const { tweaks } = ctx;
  const data = seedData(130, 47);
  const stats = data.reduce((acc, x) => { acc[x.s] = (acc[x.s] || 0) + 1; return acc; }, {});

  return (
    <div className="session-canvas" style={{ width: '100%', height: '100%', background: 'rgba(15,23,42,.45)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* 模糊的背景 · 表示在 session 上叠的 */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-alt)', filter: 'blur(0px)', opacity: .6 }}/>
      <SessionHeader subject="行测 · 综合模考" paper="2024 国考全真模拟" qIndex={47} qTotal={130} mode="exam" focus={false}/>

      {/* 抽屉 */}
      <div style={{
        position: 'absolute',
        top: 60, right: 0, bottom: 0,
        width: 720,
        background: 'var(--paper)',
        boxShadow: '-20px 0 40px -10px rgba(0,0,0,.15)',
        display: 'flex', flexDirection: 'column',
        zIndex: 2,
      }}>
        <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>答题卡</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>点击题号可跳转 · 已答 {stats.done || 0} / 130</div>
          </div>
          <div style={{ flex: 1 }}/>
          <button className="btn ghost tiny">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            关闭
          </button>
        </div>

        {/* 图例 */}
        <div style={{ padding: '12px 28px', display: 'flex', gap: 16, borderBottom: '1px solid var(--line)', background: 'var(--bg-alt)', fontSize: 11 }}>
          {Object.entries(STATUS).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: v.bg, border: `1.5px solid ${v.border || v.bg}` }}/>
              <span style={{ color: 'var(--ink-muted)' }}>{v.label}</span>
              <span style={{ color: 'var(--placeholder)', fontFamily: 'var(--mono)' }}>{stats[k] || 0}</span>
            </div>
          ))}
        </div>

        {/* 分段 · 滚动 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
          {SECTIONS.map(sec => {
            const range = data.slice(sec.range[0] - 1, sec.range[1]);
            const done = range.filter(x => x.s === 'done').length;
            return (
              <div key={sec.name} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 3, height: 14, background: sec.color, borderRadius: 2 }}/>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{sec.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                    {sec.range[0]}–{sec.range[1]} · 完成 {done}/{range.length}
                  </span>
                  <div style={{ flex: 1 }}/>
                  <div style={{ width: 90, height: 4, background: 'var(--bg-alt)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${(done/range.length)*100}%`, height: '100%', background: sec.color }}/>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 32px)', gap: 6 }}>
                  {range.map(q => <NumChip key={q.n} n={q.n} s={q.s}/>)}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '14px 28px', borderTop: '1px solid var(--line)', background: 'var(--bg-alt)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            还剩 <span style={{ color: 'var(--ink)', fontFamily: 'var(--mono)', fontWeight: 700 }}>83</span> 题未作答 · 剩余 <span style={{ color: 'var(--warn)', fontFamily: 'var(--mono)', fontWeight: 700 }}>62:14</span>
          </div>
          <div style={{ flex: 1 }}/>
          <button className="btn ghost tiny">返回当前题</button>
          <button className="btn brand tiny" style={{ background: 'var(--danger)' }}>交卷</button>
        </div>
      </div>
    </div>
  );
}

window.SessionD = SessionD;
