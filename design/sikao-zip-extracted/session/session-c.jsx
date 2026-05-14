// session-c.jsx — 图形推理

// 几何图形渲染 helper
function Glyph({ kind, size = 56 }) {
  const s = size, c = s/2, r = s/2 - 4;
  const stroke = 'var(--ink)';
  if (kind === 'tri') return <svg width={s} height={s}><polygon points={`${c},6 ${s-6},${s-6} 6,${s-6}`} fill="none" stroke={stroke} strokeWidth="2"/></svg>;
  if (kind === 'sq')  return <svg width={s} height={s}><rect x="6" y="6" width={s-12} height={s-12} fill="none" stroke={stroke} strokeWidth="2"/></svg>;
  if (kind === 'circ')return <svg width={s} height={s}><circle cx={c} cy={c} r={r} fill="none" stroke={stroke} strokeWidth="2"/></svg>;
  if (kind === 'pent')return <svg width={s} height={s}><polygon points={`${c},6 ${s-6},${c-3} ${s-12},${s-6} 12,${s-6} 6,${c-3}`} fill="none" stroke={stroke} strokeWidth="2"/></svg>;
  if (kind === 'hex') return <svg width={s} height={s}><polygon points={`${c},6 ${s-8},${c-7} ${s-8},${c+7} ${c},${s-6} 8,${c+7} 8,${c-7}`} fill="none" stroke={stroke} strokeWidth="2"/></svg>;
  if (kind === 'star')return <svg width={s} height={s}><polygon points={`${c},5 ${c+6},${c-5} ${s-5},${c-5} ${c+9},${c+3} ${c+13},${s-5} ${c},${c+8} ${c-13},${s-5} ${c-9},${c+3} 5,${c-5} ${c-6},${c-5}`} fill="none" stroke={stroke} strokeWidth="2"/></svg>;
  return null;
}

function Cell({ children, q }) {
  return (
    <div style={{
      width: 96, height: 96,
      border: q ? '2px dashed var(--brand)' : '1.5px solid var(--ink)',
      borderRadius: 6,
      background: q ? 'var(--brand-50)' : 'var(--paper)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      {q && <span style={{ position: 'absolute', fontSize: 32, fontWeight: 700, color: 'var(--brand)' }}>?</span>}
      {!q && children}
    </div>
  );
}

function SessionC({ ctx }) {
  const { tweaks } = ctx;
  const [picked, setPicked] = React.useState(null);

  return (
    <div className="session-canvas" style={{ width: '100%', height: '100%', background: 'var(--bg-alt)', display: 'flex', flexDirection: 'column' }}>
      <SessionHeader subject="行测 · 判断推理" paper="图形推理 · 专项训练" qIndex={5} qTotal={20} mode={tweaks.mode} focus={tweaks.focus}/>
      <ProgressStrip total={20} current={5} answered={4}/>

      <div style={{ flex: 1, padding: '32px 56px', overflow: 'auto', maxWidth: 900, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="chip">判断推理</span>
          <span className="chip muted">图形推理 · 九宫格</span>
          <span className="chip muted">难度 · 较难</span>
        </div>

        <div className="q-stem" style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--ink)' }}>
          <span style={{ color: 'var(--placeholder)', fontFamily: 'var(--mono)', fontSize: 13, marginRight: 6 }}>05.</span>
          从所给的四个选项中，选择最合适的一个填入问号处，使之呈现一定的规律性。
        </div>

        {/* 题图 · 九宫格 */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 96px)', gap: 8, padding: 16, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12 }}>
            <Cell><Glyph kind="tri"/></Cell>
            <Cell><Glyph kind="sq"/></Cell>
            <Cell><Glyph kind="circ"/></Cell>
            <Cell><Glyph kind="sq"/></Cell>
            <Cell><Glyph kind="circ"/></Cell>
            <Cell><Glyph kind="pent"/></Cell>
            <Cell><Glyph kind="circ"/></Cell>
            <Cell><Glyph kind="pent"/></Cell>
            <Cell q/>
          </div>
        </div>

        {/* 选项 · 横排 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
          {[
            { k: 'A', g: 'tri' },
            { k: 'B', g: 'hex' },
            { k: 'C', g: 'star' },
            { k: 'D', g: 'sq' },
          ].map(o => (
            <div key={o.k} onClick={() => setPicked(o.k)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: 12,
              border: `2px solid ${picked === o.k ? 'var(--brand)' : 'var(--line-strong)'}`,
              background: picked === o.k ? 'var(--brand-50)' : 'var(--paper)',
              borderRadius: 12,
              cursor: 'pointer',
              transition: 'all .15s',
            }}>
              <Cell><Glyph kind={o.g}/></Cell>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: picked === o.k ? 'var(--brand)' : 'var(--bg-alt)',
                color: picked === o.k ? '#fff' : 'var(--muted)',
                fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{o.k}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--placeholder)', fontFamily: 'var(--mono)' }}>
          提示：观察每行图形的边数变化规律
        </div>
      </div>

      <SessionFooter canSubmit={!!picked} submitted={false} onSubmit={() => {}} onMark={() => {}} marked={false} focus={tweaks.focus}/>
    </div>
  );
}

window.SessionC = SessionC;
