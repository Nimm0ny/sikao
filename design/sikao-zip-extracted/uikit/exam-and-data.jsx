/* global React */
// 思考 UI Kit · 04 答题专用 + 05 数据 + 06 状态 + 07 动效

// ============================== Option · 答题选项卡 ==============================
window.OptionStates = function OptionStates() {
  const Opt = ({ letter = 'A', text, state }) => {
    const styles = {
      default: { border: 'var(--line-strong)', bg: 'var(--paper)', letterBg: 'var(--bg-alt)', letterFg: 'var(--ink-muted)', fg: 'var(--ink)', icon: null },
      hover: { border: 'var(--brand)', bg: 'var(--paper)', letterBg: 'var(--brand-50)', letterFg: 'var(--brand)', fg: 'var(--ink)', icon: null, shadow: '0 4px 16px -6px rgba(37,99,235,.25)' },
      selected: { border: 'var(--brand)', bg: 'var(--brand-50)', letterBg: 'var(--brand)', letterFg: '#fff', fg: 'var(--ink)', icon: null },
      correct: { border: '#16a34a', bg: '#f0fdf4', letterBg: '#16a34a', letterFg: '#fff', fg: 'var(--ink)', icon: '✓', iconColor: '#16a34a' },
      wrong: { border: '#dc2626', bg: '#fef2f2', letterBg: '#dc2626', letterFg: '#fff', fg: 'var(--ink)', icon: '✗', iconColor: '#dc2626' },
      revealed: { border: '#16a34a', bg: '#f0fdf4', letterBg: '#16a34a', letterFg: '#fff', fg: 'var(--ink)', icon: '正确答案', iconColor: '#16a34a' },
      disabled: { border: 'var(--line)', bg: 'var(--bg-alt)', letterBg: '#e2e8f0', letterFg: 'var(--placeholder)', fg: 'var(--placeholder)', icon: null },
    }[state];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: styles.bg, border: `1.5px solid ${styles.border}`, borderRadius: 12, boxShadow: styles.shadow || 'none' }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: styles.letterBg, color: styles.letterFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{letter}</div>
        <span style={{ fontSize: 14, color: styles.fg, lineHeight: 1.5, flex: 1 }}>{text}</span>
        {styles.icon && <span style={{ fontSize: 12, fontWeight: 700, color: styles.iconColor, padding: '4px 10px', borderRadius: 999, background: '#fff', border: `1px solid ${styles.iconColor}` }}>{styles.icon}</span>}
      </div>
    );
  };
  const states = [
    { k: 'default', l: '默认' },
    { k: 'hover', l: '悬停' },
    { k: 'selected', l: '已选' },
    { k: 'correct', l: '答对' },
    { k: 'wrong', l: '答错' },
    { k: 'revealed', l: '正确答案揭示' },
    { k: 'disabled', l: '禁用' },
  ];
  const sample = '政府引导，市场为主，二者协同推动科技创新';
  return (
    <div style={{ width: 1280, height: 680, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)', overflow: 'auto' }}>
      <span className="doc-eyebrow">04.1 · Option</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>答题选项 · <em>7 种状态</em></h1>
      <p className="doc-lead">单选用圆角矩形 + 字母方块，方块本身就是 hit area 的视觉重心。</p>

      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {states.map(s => (
          <div key={s.k}>
            <div className="label" style={{ marginBottom: 6 }}>{s.l} · {s.k}</div>
            <Opt state={s.k} letter="B" text={sample}/>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================== Timer ==============================
window.Timer = function Timer() {
  return (
    <div style={{ width: 1280, height: 520, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">04.2 · Timer</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>计时器 · <em>等宽 · 不跳</em></h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 32 }}>
        {/* 默认 */}
        <div className="uk-card" style={{ textAlign: 'center', padding: 22 }}>
          <div className="label">默认 · 倒计时</div>
          <div className="mono" style={{ fontSize: 44, fontWeight: 700, color: 'var(--ink)', marginTop: 12, letterSpacing: '-0.02em' }}>28:42</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>剩余时间</div>
        </div>
        {/* 进行中 */}
        <div className="uk-card" style={{ textAlign: 'center', padding: 22 }}>
          <div className="label">进行中 · 正计时</div>
          <div className="mono" style={{ fontSize: 44, fontWeight: 700, color: 'var(--brand)', marginTop: 12 }}>01:24</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>本题用时</div>
        </div>
        {/* 警告 */}
        <div className="uk-card" style={{ textAlign: 'center', padding: 22, background: '#fef3c7', border: '1px solid #fde68a' }}>
          <div className="label" style={{ color: '#a16207' }}>警告 · &lt; 5 min</div>
          <div className="mono" style={{ fontSize: 44, fontWeight: 700, color: '#a16207', marginTop: 12 }}>04:32</div>
          <div style={{ fontSize: 12, color: '#a16207', marginTop: 6 }}>⚑ 还有 6 题</div>
        </div>
        {/* 危险 */}
        <div className="uk-card" style={{ textAlign: 'center', padding: 22, background: '#fef2f2', border: '1px solid #fecaca' }}>
          <div className="label" style={{ color: '#b91c1c' }}>危险 · &lt; 1 min</div>
          <div className="mono" style={{ fontSize: 44, fontWeight: 700, color: '#dc2626', marginTop: 12 }}>00:42</div>
          <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 6 }}>即将自动提交</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 22 }}>
        <div className="uk-card" style={{ padding: 20 }}>
          <div className="label">环形 · ring</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg-alt)" strokeWidth="6"/>
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--brand)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${213.6 * 0.62} ${213.6}`} transform="rotate(-90 40 40)"/>
            </svg>
            <div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>17:44</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>62% 已用</div>
            </div>
          </div>
        </div>
        <div className="uk-card" style={{ padding: 20 }}>
          <div className="label">小巧 · inline</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: 'var(--brand-50)', color: 'var(--brand-700)', marginTop: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>00:42</span>
          </div>
        </div>
        <div className="uk-card" style={{ padding: 20 }}>
          <div className="label">已暂停</div>
          <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: 'var(--muted)', marginTop: 12, textDecoration: 'line-through' }}>17:44</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>⏸ 已暂停 · 点击继续</div>
        </div>
      </div>
    </div>
  );
};

// ============================== Progress ==============================
window.ProgressBars = function ProgressBars() {
  return (
    <div style={{ width: 1280, height: 520, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">04.3 · Progress</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>进度条 · <em>线性 / 分段 / 多色</em></h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32 }}>
        <div className="uk-card">
          <div className="label">题目进度 · 分段式</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {[...Array(20)].map((_, i) => (
              <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < 13 ? 'var(--brand)' : i === 13 ? '#93c5fd' : 'var(--bg-alt)' }}/>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            <span>第 14 / 20 题</span>
            <span className="mono">65%</span>
          </div>

          <div className="label" style={{ marginTop: 28 }}>线性 · 默认</div>
          <div style={{ height: 8, background: 'var(--bg-alt)', borderRadius: 4, overflow: 'hidden', marginTop: 12 }}>
            <div style={{ width: '78%', height: '100%', background: 'var(--brand)', borderRadius: 4 }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            <span>156 / 200 题</span>
            <span className="mono">78%</span>
          </div>

          <div className="label" style={{ marginTop: 24 }}>线性 · 多色组合（正确/错误/未做）</div>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 12 }}>
            <div style={{ flex: 78, background: '#16a34a' }}/>
            <div style={{ flex: 14, background: '#dc2626' }}/>
            <div style={{ flex: 8, background: 'var(--bg-alt)' }}/>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#16a34a', marginRight: 6, verticalAlign: 1 }}/>正确 156</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#dc2626', marginRight: 6, verticalAlign: 1 }}/>错误 28</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#e2e8f0', marginRight: 6, verticalAlign: 1 }}/>未做 16</span>
          </div>
        </div>

        <div className="uk-card">
          <div className="label">连续打卡 · streak grid</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(21, 1fr)', gap: 3, marginTop: 14 }}>
            {[...Array(21)].map((_, i) => {
              const intensity = [0,1,2,3,4][Math.min(4, Math.floor(Math.random()*5))];
              const colors = ['#e2e8f0', '#bfdbfe', '#60a5fa', '#2563eb', '#1d4ed8'];
              return <div key={i} style={{ aspectRatio: 1, borderRadius: 3, background: i === 20 ? 'var(--brand)' : colors[intensity] }}/>;
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            <span>过去 21 天</span>
            <span><span className="mono" style={{ color: 'var(--ink)', fontWeight: 700 }}>21</span> 天连续</span>
          </div>

          <div className="label" style={{ marginTop: 28 }}>知识点掌握 · 半圆</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
            {[
              { l: '言语', v: 92, c: '#16a34a' },
              { l: '资料', v: 65, c: '#f59e0b' },
              { l: '判断', v: 78, c: '#2563eb' },
              { l: '数量', v: 48, c: '#dc2626' },
            ].map(k => (
              <div key={k.l} style={{ flex: 1, textAlign: 'center' }}>
                <svg width="80" height="48" viewBox="0 0 80 48">
                  <path d="M 8 44 A 32 32 0 0 1 72 44" fill="none" stroke="var(--bg-alt)" strokeWidth="6" strokeLinecap="round"/>
                  <path d="M 8 44 A 32 32 0 0 1 72 44" fill="none" stroke={k.c} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${100.5 * k.v / 100} 100.5`}/>
                </svg>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, marginTop: -8 }}>{k.v}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================== Score Ring ==============================
window.ScoreRing = function ScoreRing() {
  const Ring = ({ size = 180, value = 78, label = '总分', sublabel, color = 'var(--brand)' }) => {
    const r = size / 2 - 12;
    const circ = 2 * Math.PI * r;
    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-alt)" strokeWidth="10"/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${circ * value / 100} ${circ}`} transform={`rotate(-90 ${size/2} ${size/2})`}/>
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="mono" style={{ fontSize: size * 0.32, fontWeight: 800, lineHeight: 1, color: 'var(--ink)' }}>{value}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
          {sublabel && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{sublabel}</div>}
        </div>
      </div>
    );
  };
  return (
    <div style={{ width: 1280, height: 580, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">04.4 · Score Ring</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>环形分数</h1>

      <div style={{ display: 'flex', gap: 32, marginTop: 36, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Ring size={220} value={78} label="总分" sublabel="/ 100" color="var(--brand)"/>
          <div className="label" style={{ marginTop: 12 }}>L · 220 px · 主分数</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Ring size={140} value={92} label="言语" color="#16a34a"/>
          <div className="label" style={{ marginTop: 12 }}>M · 140 px · 子模块</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Ring size={80} value={48} label="数量" color="#dc2626"/>
          <div className="label" style={{ marginTop: 12 }}>S · 80 px · inline</div>
        </div>

        <div className="uk-card" style={{ flex: 1, padding: 22 }}>
          <div className="label">配色规则</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', fontSize: 13, lineHeight: 2.2, color: 'var(--ink-muted)' }}>
            <li><span className="mono" style={{ display: 'inline-block', width: 56, color: '#16a34a', fontWeight: 700 }}>≥ 85</span>success · 优秀</li>
            <li><span className="mono" style={{ display: 'inline-block', width: 56, color: 'var(--brand)', fontWeight: 700 }}>70-84</span>brand · 良好</li>
            <li><span className="mono" style={{ display: 'inline-block', width: 56, color: '#f59e0b', fontWeight: 700 }}>55-69</span>warn · 待提升</li>
            <li><span className="mono" style={{ display: 'inline-block', width: 56, color: '#dc2626', fontWeight: 700 }}>&lt; 55</span>danger · 弱项</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// ============================== Answer Card ==============================
window.AnswerCard = function AnswerCard() {
  const grid = Array.from({ length: 60 }, (_, i) => {
    if (i === 13) return 'current';
    if ([0, 2, 5, 6, 9, 11, 12].includes(i)) return 'wrong';
    if (i < 13) return 'done';
    if ([15, 22, 28].includes(i)) return 'flagged';
    return 'pending';
  });
  const cell = (s) => {
    const styles = {
      done: { bg: 'var(--brand)', fg: '#fff', border: 'var(--brand)' },
      wrong: { bg: 'var(--danger-bg)', fg: 'var(--danger)', border: 'var(--danger)' },
      current: { bg: 'var(--paper)', fg: 'var(--brand)', border: 'var(--brand)', ring: true },
      flagged: { bg: 'var(--warn-bg)', fg: '#a16207', border: '#fde68a' },
      pending: { bg: 'var(--paper)', fg: 'var(--ink-muted)', border: 'var(--line)' },
    };
    return styles[s];
  };
  return (
    <div style={{ width: 1280, height: 580, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">04.5 · Answer Card</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>答题卡格子</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, marginTop: 32 }}>
        <div className="uk-card" style={{ padding: 24 }}>
          <div className="label">60 题 · 题型分组</div>
          <div style={{ marginTop: 14 }}>
            {[
              { l: '言语理解', range: [0, 20] },
              { l: '资料分析', range: [20, 40] },
              { l: '数量关系', range: [40, 60] },
            ].map(g => (
              <div key={g.l} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>{g.l}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: 4 }}>
                  {grid.slice(g.range[0], g.range[1]).map((s, i) => {
                    const c = cell(s);
                    return (
                      <div key={i} style={{ aspectRatio: 1, borderRadius: 6, background: c.bg, color: c.fg, border: `1.5px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--mono)', boxShadow: c.ring ? '0 0 0 3px rgba(37,99,235,.18)' : 'none' }}>
                        {g.range[0] + i + 1}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="uk-card" style={{ padding: 24 }}>
          <div className="label">图例</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {[
              { s: 'done', l: '已作答', n: 12 },
              { s: 'current', l: '当前题', n: 1 },
              { s: 'flagged', l: '已标记', n: 3 },
              { s: 'wrong', l: '已知错', n: 7 },
              { s: 'pending', l: '未作答', n: 37 },
            ].map(item => {
              const c = cell(item.s);
              return (
                <div key={item.s} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: c.bg, color: c.fg, border: `1.5px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', boxShadow: c.ring ? '0 0 0 3px rgba(37,99,235,.18)' : 'none' }}>14</div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{item.l}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{item.n}</span>
                </div>
              );
            })}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '20px 0' }}/>
          <div className="label">尺寸</div>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 10, lineHeight: 1.8 }}>
            最小 24px · 推荐 32-36px · 移动端 ≥ 36px<br/>
            字号 11-13 · 圆角 6px · 边框 1.5px
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================== 05 数据可视化 ==============================
window.Charts = function Charts() {
  const days = ['周一','周二','周三','周四','周五','周六','周日'];
  const barData = [78, 65, 92, 48, 88, 56, 72];

  return (
    <div style={{ width: 1280, height: 760, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">05 · 数据可视化</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>4 种基础图表</h1>
      <p className="doc-lead">单一品牌色 + 灰阶为主，仅在多系列对比时引入 success / danger 区分。</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18, marginTop: 28 }}>
        {/* Bar */}
        <div className="uk-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div className="label">Bar · 每日正确率</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>71<span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>% 平均</span></div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>↑ 6% vs 上周</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, marginTop: 20, paddingBottom: 24, position: 'relative' }}>
            {barData.map((v, i) => (
              <div key={i} style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ width: '100%', height: `${v}%`, background: i === 2 ? 'var(--brand)' : 'var(--brand-100)', borderRadius: '4px 4px 0 0', position: 'relative' }}>
                  {i === 2 && <span className="mono" style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>{v}</span>}
                </div>
                <span style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>{days[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Line */}
        <div className="uk-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div className="label">Line · 总分趋势</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>78<span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>/100 最近</span></div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>↑ 12 分 / 30 天</span>
          </div>
          <svg width="100%" height="160" viewBox="0 0 400 160" style={{ marginTop: 12 }}>
            {[0,1,2,3].map(i => <line key={i} x1="0" x2="400" y1={20 + i*35} y2={20 + i*35} stroke="var(--line)" strokeDasharray="2 4"/>)}
            <path d="M 0 100 L 50 90 L 100 92 L 150 75 L 200 80 L 250 60 L 300 50 L 350 42 L 400 30" fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M 0 100 L 50 90 L 100 92 L 150 75 L 200 80 L 250 60 L 300 50 L 350 42 L 400 30 L 400 160 L 0 160 Z" fill="url(#lineGrad)"/>
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18"/>
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <circle cx="400" cy="30" r="4" fill="var(--brand)"/>
            <circle cx="400" cy="30" r="8" fill="var(--brand)" fillOpacity="0.2"/>
          </svg>
        </div>

        {/* Radar */}
        <div className="uk-card">
          <div className="label">Radar · 五维能力</div>
          <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
            <svg width="180" height="180" viewBox="0 0 200 200">
              {[1,2,3,4].map(r => (
                <polygon key={r} points={[0,1,2,3,4].map(i => {
                  const ang = -Math.PI/2 + i * 2*Math.PI/5;
                  const rr = 18 * r;
                  return `${100 + Math.cos(ang)*rr},${100 + Math.sin(ang)*rr}`;
                }).join(' ')} fill="none" stroke="var(--line)" strokeWidth="1"/>
              ))}
              {[0,1,2,3,4].map(i => {
                const ang = -Math.PI/2 + i * 2*Math.PI/5;
                return <line key={i} x1="100" y1="100" x2={100 + Math.cos(ang)*72} y2={100 + Math.sin(ang)*72} stroke="var(--line)" strokeWidth="1"/>;
              })}
              <polygon points={[0.85, 0.62, 0.92, 0.78, 0.48].map((v, i) => {
                const ang = -Math.PI/2 + i * 2*Math.PI/5;
                return `${100 + Math.cos(ang)*72*v},${100 + Math.sin(ang)*72*v}`;
              }).join(' ')} fill="rgba(37,99,235,.2)" stroke="var(--brand)" strokeWidth="2"/>
              {[0.85, 0.62, 0.92, 0.78, 0.48].map((v, i) => {
                const ang = -Math.PI/2 + i * 2*Math.PI/5;
                return <circle key={i} cx={100 + Math.cos(ang)*72*v} cy={100 + Math.sin(ang)*72*v} r="3" fill="var(--brand)"/>;
              })}
            </svg>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
              {[
                ['言语理解', 85, '#16a34a'],
                ['资料分析', 62, '#f59e0b'],
                ['判断推理', 92, '#16a34a'],
                ['常识判断', 78, 'var(--brand)'],
                ['数量关系', 48, '#dc2626'],
              ].map(([l, v, c]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--ink-muted)' }}>{l}</span>
                  <span className="mono" style={{ fontWeight: 700, color: c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Heatmap */}
        <div className="uk-card">
          <div className="label">Heatmap · 错题集中区</div>
          <div style={{ marginTop: 14 }}>
            {[
              { l: '增长率', d: [3,1,5,2,8,4,6,1,2,9,4,3] },
              { l: '比重', d: [1,2,3,1,4,2,1,3,5,2,1,2] },
              { l: '平均数', d: [2,4,3,5,2,3,7,4,2,3,1,2] },
              { l: '速算', d: [4,3,5,8,6,4,7,5,9,6,4,3] },
            ].map(row => (
              <div key={row.l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 56, fontSize: 11, color: 'var(--muted)' }}>{row.l}</span>
                <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                  {row.d.map((v, i) => (
                    <div key={i} style={{ flex: 1, height: 22, borderRadius: 3, background: `rgba(220,38,38,${Math.min(0.95, v / 10)})` }}/>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 8, paddingLeft: 64 }}>
            <span>1月</span><span>4月</span><span>7月</span><span>10月</span><span>12月</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 10, color: 'var(--muted)' }}>
            <span>少</span>
            {[0.1, 0.3, 0.5, 0.7, 0.95].map((v, i) => <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: `rgba(220,38,38,${v})` }}/>)}
            <span>多</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================== 06 状态 ==============================
window.StatesGrid = function StatesGrid() {
  const Wrap = ({ title, k, children }) => (
    <div className="uk-card" style={{ padding: 24, height: 280, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="tok">{k}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{title}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 12px' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ width: 1280, height: 760, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">06 · 状态</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>Empty · Loading · Error · Success</h1>
      <p className="doc-lead">不要"哎呀"，不要"敬请期待"。每一种状态都给一个具体的下一步。</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 28 }}>
        {/* Empty */}
        <Wrap title="错题本无错题" k="empty">
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', marginBottom: 16 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>暂无错题</div>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.5 }}>继续保持。<br/>错题会在你做题时自动收录。</div>
          <button style={{ marginTop: 14, padding: '6px 14px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>开始练习</button>
        </Wrap>

        {/* Loading */}
        <Wrap title="题目加载中" k="loading">
          <svg width="36" height="36" viewBox="0 0 36 36" style={{ marginBottom: 16 }}>
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--bg-alt)" strokeWidth="3"/>
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeDasharray="22 88" transform="rotate(-90 18 18)">
              <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite"/>
            </circle>
          </svg>
          <div style={{ fontSize: 15, fontWeight: 700 }}>正在生成题目...</div>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.5 }}>AI 正根据你的错题<br/>挑选 20 道题</div>
          <div style={{ width: '100%', height: 4, background: 'var(--bg-alt)', borderRadius: 2, marginTop: 14, overflow: 'hidden' }}>
            <div style={{ width: '60%', height: '100%', background: 'var(--brand)' }}/>
          </div>
        </Wrap>

        {/* Error */}
        <Wrap title="提交失败" k="error">
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', marginBottom: 16 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>提交没成功</div>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.5 }}>网络似乎断了。<br/>你的答案已本地保存。</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button style={{ padding: '6px 14px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>重试</button>
            <button style={{ padding: '6px 14px', background: 'var(--paper)', color: 'var(--ink-muted)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>稍后</button>
          </div>
        </Wrap>

        {/* Success */}
        <Wrap title="练习完成" k="success">
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', marginBottom: 16 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>20 道题做完</div>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.5 }}>正确 16 · 错 4<br/>用时 28 分 12 秒</div>
          <button style={{ marginTop: 14, padding: '6px 14px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>查看报告 →</button>
        </Wrap>
      </div>

      {/* Toast / Inline alerts */}
      <div className="label" style={{ marginTop: 24, marginBottom: 12 }}>Inline · 行内提示</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { c: 'success', icon: '✓', t: '已加入错题本。' },
          { c: 'info', icon: 'ⓘ', t: 'AI 答疑还剩 8 次（今日）。' },
          { c: 'warn', icon: '⚑', t: '订阅 3 天后到期，记得续费。' },
          { c: 'danger', icon: '✗', t: '账户在另一台设备登录，已强制退出。' },
        ].map((a, i) => {
          const palette = { success: ['#dcfce7', '#bbf7d0', '#15803d'], info: ['#eff6ff', '#bfdbfe', '#1d4ed8'], warn: ['#fef3c7', '#fde68a', '#a16207'], danger: ['#fee2e2', '#fecaca', '#b91c1c'] }[a.c];
          return (
            <div key={i} style={{ display: 'flex', gap: 10, padding: 12, background: palette[0], border: `1px solid ${palette[1]}`, borderRadius: 10, fontSize: 13, color: palette[2], lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, flexShrink: 0 }}>{a.icon}</span>
              <span>{a.t}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================== 07 Motion ==============================
window.MotionTokens = function MotionTokens() {
  return (
    <div style={{ width: 1280, height: 680, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <style>{`
        @keyframes mt-slide { 0% { transform: translateX(0); } 50% { transform: translateX(80px); } 100% { transform: translateX(0); } }
        .mt-bar { width: 28px; height: 28px; border-radius: 8px; background: var(--brand); animation: mt-slide 2s infinite; }
      `}</style>
      <span className="doc-eyebrow">07 · 动效</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>Motion tokens</h1>
      <p className="doc-lead">动效是为了"让用户跟得上"，不是表演。微交互 ≤ 200ms，转场 ≤ 400ms。</p>

      <div style={{ marginTop: 28 }}>
        <div className="label" style={{ marginBottom: 12 }}>时长 · Duration</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { tok: '--dur-instant', ms: 100, use: '点击高亮 · 状态切换' },
            { tok: '--dur-fast', ms: 180, use: '微交互 · hover · chip 弹出' },
            { tok: '--dur-base', ms: 260, use: '默认 · drawer 抽屉 · modal' },
            { tok: '--dur-slow', ms: 400, use: '页面过场 · 大块进出' },
          ].map(d => (
            <div key={d.tok} className="uk-card" style={{ padding: 16 }}>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand)' }}>{d.ms}<span style={{ fontSize: 12, color: 'var(--muted)' }}>ms</span></div>
              <div className="tok" style={{ marginTop: 10, display: 'inline-block' }}>{d.tok}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>{d.use}</div>
            </div>
          ))}
        </div>

        <div className="label" style={{ marginTop: 28, marginBottom: 12 }}>缓动 · Easing</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { n: 'standard', curve: 'cubic-bezier(.2, 0, 0, 1)', use: '通用 · 进出场' },
            { n: 'enter', curve: 'cubic-bezier(0, 0, 0, 1)', use: '只入场 · 慢入' },
            { n: 'exit', curve: 'cubic-bezier(.4, 0, 1, 1)', use: '只出场 · 快出' },
            { n: 'spring', curve: 'cubic-bezier(.2, .8, .2, 1.2)', use: '弹性 · 选中确认' },
          ].map(e => (
            <div key={e.n} className="uk-card" style={{ padding: 16 }}>
              <svg width="100%" height="40" viewBox="0 0 100 40" style={{ overflow: 'visible' }}>
                <path d={`M 0 38 C ${e.n === 'standard' ? '20 38, 0 2' : e.n === 'enter' ? '0 38, 0 2' : e.n === 'exit' ? '40 38, 100 2' : '20 38, 20 -8'} 100 2`} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div className="tok" style={{ marginTop: 8, display: 'inline-block' }}>--ease-{e.n}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, fontFamily: 'var(--mono)' }}>{e.curve}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{e.use}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
          <div className="uk-card" style={{ padding: 22 }}>
            <div className="label">Live demo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 16 }}>
              <div className="mt-bar"/>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>2s loop · standard</span>
            </div>
          </div>
          <div className="uk-card" style={{ padding: 22 }}>
            <div className="label">规则</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.9, color: 'var(--ink-muted)' }}>
              <li>· 一次只让一个东西动</li>
              <li>· 同屏内 stagger 间隔 40ms 以内</li>
              <li>· 进入用 enter，离开用 exit，互换不要混</li>
              <li>· 尊重 prefers-reduced-motion，全部降级到 fade</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
