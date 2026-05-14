/* global React */
// 思考 UI Kit · 03 组件 Components

// ============================== Button ==============================
window.Buttons = function Buttons() {
  const Btn = ({ variant = 'primary', size = 'md', state = 'default', children, icon, iconRight }) => {
    const sizes = {
      sm: { p: '6px 12px', fs: 12, h: 30, gap: 6 },
      md: { p: '10px 18px', fs: 14, h: 40, gap: 8 },
      lg: { p: '14px 24px', fs: 16, h: 50, gap: 10 },
    }[size];
    const variants = {
      primary: {
        default: { bg: 'var(--brand)', fg: '#fff', border: 'transparent' },
        hover: { bg: 'var(--brand-700)', fg: '#fff', border: 'transparent' },
        active: { bg: '#000000', fg: '#fff', border: 'transparent' },
        disabled: { bg: '#cbd5e1', fg: '#fff', border: 'transparent' },
      },
      secondary: {
        default: { bg: 'var(--bg)', fg: 'var(--ink)', border: 'var(--line-strong)' },
        hover: { bg: 'var(--bg-alt)', fg: 'var(--ink)', border: 'var(--ink-muted)' },
        active: { bg: '#e2e8f0', fg: 'var(--ink)', border: 'var(--ink-muted)' },
        disabled: { bg: 'var(--bg-alt)', fg: 'var(--placeholder)', border: 'var(--line)' },
      },
      ghost: {
        default: { bg: 'transparent', fg: 'var(--ink-muted)', border: 'transparent' },
        hover: { bg: 'var(--bg-alt)', fg: 'var(--ink)', border: 'transparent' },
        active: { bg: '#e2e8f0', fg: 'var(--ink)', border: 'transparent' },
        disabled: { bg: 'transparent', fg: 'var(--placeholder)', border: 'transparent' },
      },
      danger: {
        default: { bg: 'var(--danger)', fg: '#fff', border: 'transparent' },
        hover: { bg: '#b91c1c', fg: '#fff', border: 'transparent' },
        active: { bg: '#991b1b', fg: '#fff', border: 'transparent' },
        disabled: { bg: '#fca5a5', fg: '#fff', border: 'transparent' },
      },
    }[variant][state];

    return (
      <button style={{
        padding: sizes.p, fontSize: sizes.fs, height: sizes.h, fontWeight: 600,
        background: variants.bg, color: variants.fg,
        border: `1px solid ${variants.border}`, borderRadius: 10,
        display: 'inline-flex', alignItems: 'center', gap: sizes.gap,
        cursor: state === 'disabled' ? 'not-allowed' : 'pointer',
        boxShadow: state === 'active' ? 'inset 0 1px 2px rgba(0,0,0,.1)' : 'none',
        outline: state === 'hover' && variant === 'primary' ? '4px solid rgba(63,126,241,.18)' : 'none',
        fontFamily: 'inherit',
      }}>
        {icon && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
        {children}
        {iconRight && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>}
      </button>
    );
  };
  const states = ['default', 'hover', 'active', 'disabled'];
  const variants = ['primary', 'secondary', 'ghost', 'danger'];

  return (
    <div style={{ width: 1280, height: 720, background: 'var(--bg)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">03.1 · Button</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>4 种类型 × 4 种状态</h1>

      <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '120px repeat(4, 1fr)', gap: 14, alignItems: 'center' }}>
        <div/>
        {states.map(s => <div key={s} className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{s}</div>)}
        {variants.map(v => (
          <React.Fragment key={v}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{v}</div>
            {states.map(s => (
              <div key={s} style={{ padding: 16, background: 'var(--bg-alt)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Btn variant={v} state={s} iconRight>{v === 'danger' ? '删除' : '继续'}</Btn>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '32px 0 20px' }}/>
      <div className="label" style={{ marginBottom: 14 }}>尺寸 sm · md · lg</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Btn size="sm">小按钮</Btn>
        <Btn size="md">默认</Btn>
        <Btn size="lg" iconRight>开始练习</Btn>
        <span style={{ width: 1, height: 30, background: 'var(--line)', margin: '0 12px' }}/>
        <Btn variant="secondary" icon>带图标</Btn>
        <Btn variant="ghost">仅文字</Btn>
        <button style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
    </div>
  );
};

// ============================== Chip / Badge ==============================
window.Chips = function Chips() {
  const Chip = ({ children, color = 'gray', solid = false, dot = false, dismiss = false }) => {
    const palette = {
      gray: { bg: 'var(--bg-alt)', fg: 'var(--ink-muted)', border: 'var(--line)' },
      brand: { bg: 'var(--brand-50)', fg: 'var(--brand-700)', border: 'var(--brand-100)' },
      success: { bg: 'var(--success-bg)', fg: '#15803d', border: '#bbf7d0' },
      warn: { bg: 'var(--warn-bg)', fg: '#a16207', border: '#fde68a' },
      danger: { bg: 'var(--danger-bg)', fg: '#b91c1c', border: '#fecaca' },
    }[color];
    const s = solid ? { bg: { gray: '#0b1120', brand: '#0b1120', success: '#16a34a', warn: '#d97706', danger: '#dc2626' }[color], fg: '#fff', border: 'transparent' } : palette;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: s.bg, color: s.fg, border: `1px solid ${s.border}` }}>
        {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}/>}
        {children}
        {dismiss && <span style={{ opacity: .6, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</span>}
      </span>
    );
  };

  return (
    <div style={{ width: 1280, height: 520, background: 'var(--bg)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">03.2 · Chip / Badge</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>标签 · 状态点 · 移除</h1>

      <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 28 }}>
        <div className="uk-card">
          <div className="label" style={{ marginBottom: 14 }}>柔色 · 默认</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Chip>默认</Chip>
            <Chip color="brand">资料分析</Chip>
            <Chip color="success" dot>已掌握</Chip>
            <Chip color="warn" dot>待复习</Chip>
            <Chip color="danger" dot>错过 3 次</Chip>
            <Chip color="brand" dismiss>2024 国考</Chip>
          </div>

          <div className="label" style={{ marginTop: 22, marginBottom: 14 }}>实色 · 强调</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Chip solid>NEW</Chip>
            <Chip color="brand" solid>PRO</Chip>
            <Chip color="success" solid>+12 分</Chip>
            <Chip color="danger" solid>HOT</Chip>
          </div>
        </div>

        <div className="uk-card">
          <div className="label" style={{ marginBottom: 14 }}>难度 · Difficulty</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[1,2,3,4,5].map(n => (
              <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, background: 'var(--bg-alt)', fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)' }}>
                难度
                <span style={{ display: 'inline-flex', gap: 1.5, marginLeft: 4 }}>
                  {[...Array(5)].map((_,i) => <span key={i} style={{ width: 5, height: 8, borderRadius: 1, background: i < n ? 'var(--brand)' : '#e2e8f0' }}/>)}
                </span>
              </span>
            ))}
          </div>

          <div className="label" style={{ marginTop: 22, marginBottom: 14 }}>计数 · Number badge</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
              </div>
              <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>3</span>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-alt)' }}/>
              <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', border: '2px solid #fff' }}/>
            </div>
            <Chip color="success">连续 21 天</Chip>
            <Chip color="brand">PRO 156 天</Chip>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================== Input ==============================
window.Inputs = function Inputs() {
  const Field = ({ label, state = 'default', value = '', placeholder = '', help, icon }) => {
    const styles = {
      default: { border: 'var(--line-strong)', bg: 'var(--bg)', help: 'var(--muted)' },
      focus: { border: 'var(--brand)', bg: 'var(--bg)', help: 'var(--brand)', shadow: '0 0 0 4px rgba(63,126,241,.18)' },
      filled: { border: 'var(--line-strong)', bg: 'var(--bg)', help: 'var(--muted)' },
      error: { border: 'var(--danger)', bg: 'var(--bg)', help: 'var(--danger)' },
      disabled: { border: 'var(--line)', bg: 'var(--bg-alt)', help: 'var(--placeholder)' },
    }[state];
    return (
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)', marginBottom: 6 }}>{label}</label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 42, padding: icon ? '0 14px 0 40px' : '0 14px', background: styles.bg, border: `1px solid ${styles.border}`, borderRadius: 10, boxShadow: styles.shadow, fontSize: 14 }}>
          {icon && <svg style={{ position: 'absolute', left: 14 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>}
          <span style={{ color: state === 'disabled' ? 'var(--placeholder)' : value ? 'var(--ink)' : 'var(--placeholder)' }}>{value || placeholder}</span>
          {state === 'focus' && <span style={{ position: 'absolute', right: 16, width: 1.5, height: 18, background: 'var(--brand)', animation: 'blink 1s infinite' }}/>}
        </div>
        {help && <div style={{ fontSize: 11, color: styles.help, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          {state === 'error' && <span>⚠</span>}{help}
        </div>}
      </div>
    );
  };

  return (
    <div style={{ width: 1280, height: 720, background: 'var(--bg)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <style>{`@keyframes blink{50%{opacity:0}}`}</style>
      <span className="doc-eyebrow">03.3 · Input</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>5 种状态</h1>

      <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <Field label="default" placeholder="输入题号..."/>
        <Field label="focus" state="focus" value="2024 国考行测"/>
        <Field label="filled" state="filled" value="2024 国考行测"/>
        <Field label="error" state="error" value="abc@" help="邮箱格式不对"/>
        <Field label="disabled" state="disabled" placeholder="账号已锁定"/>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '36px 0 20px' }}/>
      <div className="label" style={{ marginBottom: 14 }}>变体</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Field label="带图标" state="default" placeholder="搜索题目..." icon/>
        <Field label="带提示" state="default" value="3+5 个字符" help="账号长度 3-12 字符"/>
        <Field label="搜索 · 已输入" state="focus" value="资料分析" icon/>
      </div>

      <div className="label" style={{ marginTop: 28, marginBottom: 14 }}>多行 textarea</div>
      <div style={{ padding: 14, border: '1px solid var(--brand)', boxShadow: '0 0 0 4px rgba(63,126,241,.18)', borderRadius: 10, minHeight: 100, fontSize: 14, color: 'var(--ink)', background: 'var(--bg)' }}>
        我做错的是因为把"基期"和"现期"搞反了。下次先圈出来"今年"两个字再算...<span style={{ display: 'inline-block', width: 1.5, height: 16, background: 'var(--brand)', verticalAlign: -2, animation: 'blink 1s infinite' }}/>
      </div>

      <div className="label" style={{ marginTop: 24, marginBottom: 14 }}>勾选 · Toggle</div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, border: '1.5px solid var(--line-strong)', background: 'var(--bg)' }}/>
          <span style={{ fontSize: 13 }}>未勾选</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>✓</span>
          <span style={{ fontSize: 13 }}>已勾选</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'transparent' }}/></span>
          <span style={{ fontSize: 13 }}>radio off</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)' }}/></span>
          <span style={{ fontSize: 13 }}>radio on</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 32, height: 18, borderRadius: 999, background: '#e2e8f0', position: 'relative' }}><span style={{ position: 'absolute', left: 2, top: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }}/></span>
          <span style={{ fontSize: 13 }}>switch off</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 32, height: 18, borderRadius: 999, background: 'var(--brand)', position: 'relative' }}><span style={{ position: 'absolute', right: 2, top: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }}/></span>
          <span style={{ fontSize: 13 }}>switch on</span>
        </div>
      </div>
    </div>
  );
};

// ============================== Card ==============================
window.Cards = function Cards() {
  return (
    <div style={{ width: 1280, height: 680, background: 'var(--bg)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">03.4 · Card</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>3 个层级</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 32 }}>
        {/* L1 base */}
        <div>
          <div className="label" style={{ marginBottom: 10 }}>L1 · 基础卡 · 最常用</div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 16, padding: 24 }}>
            <div className="label">完成度</div>
            <div className="mono" style={{ fontSize: 36, fontWeight: 700, marginTop: 8 }}>78%</div>
            <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4 }}>本周已完成 156 / 200 题</div>
            <div style={{ height: 6, background: 'var(--bg-alt)', borderRadius: 3, marginTop: 16, overflow: 'hidden' }}>
              <div style={{ width: '78%', height: '100%', background: 'var(--brand)' }}/>
            </div>
          </div>
        </div>

        {/* L2 elevated */}
        <div>
          <div className="label" style={{ marginBottom: 10 }}>L2 · 浮起卡 · 悬停 / 抽屉</div>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px -10px rgb(15 23 42 / .15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-50)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>AI 建议</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>基于近 7 天表现</div>
              </div>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--ink-muted)', margin: '14px 0 0' }}>
              你在"增长率"题型上 <strong style={{ color: 'var(--ink)' }}>3 次连续犯错</strong>。建议先看 5 分钟解析视频。
            </p>
          </div>
        </div>

        {/* L3 hero */}
        <div>
          <div className="label" style={{ marginBottom: 10 }}>L3 · 旗舰卡 · CTA · 重要入口</div>
          <div style={{ background: 'linear-gradient(135deg, #0b1120 0%, #1e293b 100%)', color: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 30px 80px -30px rgb(15 23 42 / .25)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, background: 'radial-gradient(circle, rgba(96,165,250,.4), transparent 70%)' }}/>
            <span style={{ display: 'inline-block', padding: '4px 10px', background: 'rgba(96,165,250,.2)', color: '#93c5fd', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>今日重点</span>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 14 }}>资料分析 · 第 3 套</div>
            <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 6 }}>20 题 · 预计 28 分钟 · AI 出题</div>
            <button style={{ marginTop: 20, padding: '10px 20px', background: '#fff', color: '#0b1120', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>开始 →</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 28, padding: 24, background: 'var(--bg-alt)', borderRadius: 16, display: 'flex', gap: 24, alignItems: 'center' }}>
        <div className="label">解剖</div>
        <div style={{ flex: 1, display: 'flex', gap: 32, fontSize: 12 }}>
          {[
            ['padding', '24-28', 'card 内边距'],
            ['radius', '16', '统一 lg'],
            ['border', '1px line', '默认'],
            ['shadow', 'card / pop / hero', '看层级'],
            ['gap', '16-24', '卡之间'],
          ].map(([k, v, d]) => (
            <div key={k}>
              <div style={{ color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>{k}</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: '4px 0 2px' }}>{v}</div>
              <div style={{ color: 'var(--muted)', fontSize: 11 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================== Sidebar / Topbar / Tabs ==============================
window.NavBits = function NavBits() {
  const SidebarItem = ({ icon, label, active, count }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, color: active ? '#fff' : 'rgba(255,255,255,.6)', background: active ? 'rgba(255,255,255,.08)' : 'transparent', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', position: 'relative' }}>
      {active && <span style={{ position: 'absolute', left: -16, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, background: '#60a5fa', borderRadius: 2 }}/>}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon}/></svg>
      <span>{label}</span>
      {count && <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 7px', background: 'rgba(255,255,255,.1)', borderRadius: 999 }}>{count}</span>}
    </div>
  );
  return (
    <div style={{ width: 1280, height: 760, background: 'var(--bg)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">03.5 · 导航</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>侧栏 · 顶栏 · Tabs</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 18, marginTop: 28, height: 580 }}>
        {/* sidebar */}
        <div style={{ background: 'var(--sidebar)', borderRadius: 16, padding: 20, color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800 }}>思</div>
            <span style={{ fontSize: 16, fontWeight: 700 }}>思考</span>
          </div>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <SidebarItem icon="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" label="首页" active/>
            <SidebarItem icon="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" label="题库"/>
            <SidebarItem icon="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" label="错题本" count="46"/>
            <SidebarItem icon="M3 3v18h18M19 9l-5 5-4-4-3 3" label="数据"/>
            <SidebarItem icon="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" label="AI 答疑"/>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 24 }}/>
        </div>

        {/* topbar + tabs + content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* topbar */}
          <div style={{ height: 60, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, height: 36, background: 'var(--bg-alt)', borderRadius: 10, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--placeholder)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              搜索题目、考点...
              <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)', padding: '2px 6px', background: 'var(--bg)', borderRadius: 4, border: '1px solid var(--line)' }}>⌘ K</span>
            </div>
            <button style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', position: 'relative', cursor: 'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
              <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', border: '2px solid #fff' }}/>
            </button>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand-50)', color: 'var(--brand-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>陈</div>
          </div>

          {/* tabs */}
          <div className="uk-card" style={{ padding: 0 }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
              {[
                { l: '全部', n: 256, active: true },
                { l: '言语理解', n: 84 },
                { l: '资料分析', n: 60 },
                { l: '数量关系', n: 48 },
                { l: '判断推理', n: 64 },
              ].map((t, i) => (
                <div key={i} style={{ padding: '14px 20px', fontSize: 13.5, fontWeight: t.active ? 700 : 500, color: t.active ? 'var(--ink)' : 'var(--ink-muted)', borderBottom: t.active ? '2px solid var(--brand)' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginBottom: -1 }}>
                  {t.l}
                  <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, background: t.active ? 'var(--brand-50)' : 'var(--bg-alt)', color: t.active ? 'var(--brand)' : 'var(--muted)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{t.n}</span>
                </div>
              ))}
            </div>

            {/* segmented control */}
            <div style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)' }}>视图</span>
              <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-alt)', borderRadius: 10, border: '1px solid var(--line)' }}>
                {['卡片', '列表', '图谱'].map((v, i) => (
                  <span key={v} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: i === 0 ? 'var(--ink)' : 'var(--muted)', background: i === 0 ? 'var(--bg)' : 'transparent', boxShadow: i === 0 ? '0 1px 2px rgba(0,0,0,.06)' : 'none', cursor: 'pointer' }}>{v}</span>
                ))}
              </div>

              <span style={{ marginLeft: 24, fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)' }}>排序</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg)', border: '1px solid var(--line-strong)', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                最近做过 <span style={{ fontSize: 9, color: 'var(--muted)' }}>▾</span>
              </span>
            </div>
          </div>

          {/* breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)', padding: '0 4px' }}>
            <span>题库</span>
            <span style={{ color: 'var(--placeholder)' }}>/</span>
            <span>资料分析</span>
            <span style={{ color: 'var(--placeholder)' }}>/</span>
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>增长率 · 第 3 套</span>
          </div>
        </div>
      </div>
    </div>
  );
};
