// session-b.jsx — 资料分析 · 材料题分栏

function SessionB({ ctx }) {
  const { tweaks } = ctx;
  const [picked, setPicked] = React.useState({ q1: 'C', q2: null, q3: null });

  return (
    <div className="session-canvas" style={{ width: '100%', height: '100%', background: 'var(--bg-alt)', display: 'flex', flexDirection: 'column' }}>
      <SessionHeader subject="行测 · 资料分析" paper="2024 国考 · 材料三" qIndex={28} qTotal={40} mode={tweaks.mode} focus={tweaks.focus}/>
      <ProgressStrip total={40} current={28} answered={27}/>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
        {/* 左 · 材料 */}
        <div style={{ borderRight: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-alt)' }}>
            <span className="chip">材料三</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>2023 年 1-12 月 全国快递业务量统计</span>
            <div style={{ flex: 1 }}/>
            <button className="btn ghost tiny" style={{ padding: '4px 8px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              下载
            </button>
          </div>
          <div style={{ flex: 1, padding: '20px 24px', overflow: 'auto', fontSize: 13, lineHeight: 1.85, color: 'var(--ink-muted)' }}>
            <p style={{ margin: '0 0 14px', textWrap: 'pretty' }}>
              2023 年全国邮政行业业务收入（不包括邮政储蓄银行直接营业收入）累计完成 <b style={{ color: 'var(--ink)' }}>15870 亿元</b>，同比增长 <b style={{ color: 'var(--brand)' }}>14.3%</b>；业务总量累计完成 <b style={{ color: 'var(--ink)' }}>16687 亿元</b>，同比增长 <b style={{ color: 'var(--brand)' }}>16.8%</b>。
            </p>
            <p style={{ margin: '0 0 14px', textWrap: 'pretty' }}>
              全国快递服务企业业务量累计完成 <b style={{ color: 'var(--ink)' }}>1320.7 亿件</b>，同比增长 19.4%；业务收入累计完成 <b style={{ color: 'var(--ink)' }}>12074 亿元</b>，同比增长 14.3%。
            </p>

            {/* 表格 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 12, marginBottom: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-alt)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--line-strong)', fontWeight: 700 }}>地区</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--line-strong)', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--mono)' }}>业务量（亿件）</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--line-strong)', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--mono)' }}>同比增长</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--line-strong)', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--mono)' }}>占比</th>
                </tr>
              </thead>
              <tbody style={{ fontFamily: 'var(--mono)' }}>
                {[
                  ['东部地区', '1037.3', '+18.2%', '78.5%'],
                  ['中部地区', '178.9', '+25.7%', '13.5%'],
                  ['西部地区', '93.8', '+22.1%', '7.1%'],
                  ['东北地区', '10.7', '+10.4%', '0.9%'],
                ].map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--sans)' }}>{r[0]}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{r[1]}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--success)' }}>{r[2]}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p style={{ margin: 0, color: 'var(--placeholder)', fontSize: 11, fontStyle: 'italic' }}>数据来源：国家邮政局《2023 年邮政行业运行情况》</p>
          </div>
        </div>

        {/* 右 · 题目 */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>本材料 5 道小题</span>
            <div style={{ flex: 1 }}/>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1,2,3,4,5].map(n => (
                <div key={n} style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: n === 2 ? 'var(--brand)' : n === 1 ? 'var(--brand-100)' : 'var(--bg-alt)',
                  color: n === 2 ? '#fff' : n === 1 ? 'var(--brand-700)' : 'var(--muted)',
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}>{n}</div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, padding: '20px 24px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="chip">资料分析</span>
              <span className="chip muted">增长率</span>
              <span className="chip muted">难度 · 中</span>
              <div style={{ flex: 1 }}/>
              <button className="btn ghost tiny" style={{ padding: '3px 8px', fontSize: 11 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                计算器
              </button>
            </div>
            <div className="q-stem" style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--ink)', textWrap: 'pretty' }}>
              <span style={{ color: 'var(--placeholder)', fontFamily: 'var(--mono)', fontSize: 13, marginRight: 6 }}>28.</span>
              2023 年东部地区快递业务量同比 2022 年 <b>约</b> 增长了多少？
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { k: 'A', text: '约 158.4 亿件' },
                { k: 'B', text: '约 169.7 亿件' },
                { k: 'C', text: '约 215.2 亿件' },
                { k: 'D', text: '约 245.6 亿件' },
              ].map(o => (
                <div key={o.k} className={`opt ${picked.q2 === o.k ? 'selected' : ''}`} onClick={() => setPicked({ ...picked, q2: o.k })}>
                  <div className="k">{o.k}</div>
                  <div style={{ flex: 1, fontFamily: 'var(--mono)' }}>{o.text}</div>
                </div>
              ))}
            </div>

            {/* 草稿区 */}
            <div style={{
              marginTop: 8,
              background: '#fffbeb',
              border: '1px dashed #fde68a',
              borderRadius: 10,
              padding: 12,
              fontSize: 11,
              fontFamily: 'var(--mono)',
              color: '#92400e',
              minHeight: 80,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 700 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                草稿
              </div>
              <div style={{ lineHeight: 1.7 }}>
                1037.3 / (1 + 18.2%)<br/>
                ≈ 1037.3 / 1.182<br/>
                ≈ 877.6<br/>
                增长 = 1037.3 - 877.6 ≈ 159.7
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, background: 'var(--paper)' }}>
            <button className="btn ghost tiny">上一小题</button>
            <div style={{ flex: 1 }}/>
            <button className="btn brand tiny">下一小题</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.SessionB = SessionB;
