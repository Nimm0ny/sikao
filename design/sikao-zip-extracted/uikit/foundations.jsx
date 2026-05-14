/* global React */
// 思考 UI Kit · 01 品牌 + 02 基础（颜色/字体/间距/圆角/阴影/图标）

// ============================== 01 · 封面 ==============================
window.Cover = function Cover() {
  return (
    <div style={{ width: 1280, height: 720, background: 'linear-gradient(135deg, #0b1120 0%, #1e293b 100%)', color: '#fff', padding: 80, position: 'relative', overflow: 'hidden', fontFamily: 'var(--sans)' }}>
      <div style={{ position: 'absolute', right: -120, top: -120, width: 540, height: 540, background: 'radial-gradient(circle, rgba(59,130,246,.45), transparent 65%)' }}/>
      <div style={{ position: 'absolute', left: -100, bottom: -200, width: 460, height: 460, background: 'radial-gradient(circle, rgba(59,130,246,.18), transparent 60%)' }}/>

      <div style={{ position: 'relative' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.18)', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#93c5fd' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }}/>UI KIT · v0.1
        </span>
        <h1 style={{ fontSize: 96, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, margin: '32px 0 12px' }}>
          思考 <span style={{ color: '#60a5fa' }}>·</span> 设计规范
        </h1>
        <p style={{ fontSize: 20, color: '#cbd5e1', lineHeight: 1.6, maxWidth: 720, margin: '0 0 48px' }}>
          一个备考同伴。一份让备考变成<strong style={{ color: '#fff' }}>专注训练</strong>而不是焦虑的工具。<br/>
          这份文档定义"思考"的视觉语言、用词与组件 — 让每一次出现都一致。
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, maxWidth: 760, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,.12)' }}>
          {[
            ['品牌色', '#2563eb'],
            ['正文字', 'Inter'],
            ['基础栅格', '8 px'],
            ['圆角', '12 px'],
          ].map(([l, v]) => (
            <div key={l}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{l}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, marginTop: 6, color: '#fff' }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ position: 'absolute', right: 0, bottom: -40, fontFamily: 'var(--mono)', fontSize: 11, color: '#475569', textAlign: 'right' }}>
          SIKAO.AI · 2026<br/>
          DOCUMENT ID · UK-001
        </div>
      </div>
    </div>
  );
};

// ============================== 01 · Logo + 名称由来 ==============================
window.BrandLogo = function BrandLogo() {
  return (
    <div style={{ width: 1280, height: 760, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">01.1 · 名称 / Logo</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>名称：<em>思考</em></h1>
      <p className="doc-lead">不是"刷题"，不是"上岸"。是慢一点，把每一题想清楚。</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 36 }}>
        <div className="uk-card">
          <div className="label">主 LOGO</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '32px 0' }}>
            <div style={{ width: 84, height: 84, borderRadius: 20, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 40, fontWeight: 800, boxShadow: '0 12px 30px -10px rgba(37,99,235,.5)' }}>思</div>
            <div>
              <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>思考</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>SIKAO · /sɯ.kʰɑʊ/</div>
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '8px 0 16px' }}/>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { bg: '#0b1120', fg: '#fff' },
              { bg: '#fff', fg: 'var(--ink)', border: true },
              { bg: 'var(--brand)', fg: '#fff' },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, height: 80, background: s.bg, border: s.border ? '1px solid var(--line)' : 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: s.fg }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: i === 2 ? '#fff' : 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: i === 2 ? 'var(--brand)' : '#fff', fontSize: 13, fontWeight: 800 }}>思</div>
                <span style={{ fontSize: 18, fontWeight: 700 }}>思考</span>
              </div>
            ))}
          </div>
        </div>

        <div className="uk-card">
          <div className="label">名称由来</div>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--ink-muted)', margin: '12px 0' }}>
            <strong style={{ color: 'var(--ink)' }}>"刷"是肌肉记忆。"思"是把规律刻进骨头里。</strong>
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-muted)', margin: '0 0 12px' }}>
            公考的难点从来不是题量，而是同一类陷阱反复掉进去。"思考"对应的是慢一点、看一眼解析、把这道题归到知识图谱里。
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-muted)', margin: 0 }}>
            Logo 用<strong style={{ color: 'var(--ink)' }}>"思"</strong>字单独成印 — 像一枚备考印章，盖在每一份报告抬头上。
          </p>

          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '20px 0 14px' }}/>
          <div className="label">禁止用法</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            {[
              { ok: false, l: '拉伸变形', demo: <div style={{ width: 50, height: 28, borderRadius: 7, background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>思</div> },
              { ok: false, l: '低对比', demo: <div style={{ width: 36, height: 36, borderRadius: 7, background: '#dbeafe', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>思</div> },
              { ok: false, l: '加渐变光晕', demo: <div style={{ width: 36, height: 36, borderRadius: 7, background: 'linear-gradient(45deg, #f0f, #0ff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>思</div> },
              { ok: false, l: '换字号比例', demo: <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 36, height: 36, borderRadius: 7, background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>思</div><span style={{ fontSize: 11 }}>思考</span></div> },
            ].map((x, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-alt)' }}>
                <div style={{ width: 44, display: 'flex', justifyContent: 'center', position: 'relative' }}>
                  {x.demo}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, transparent 48%, var(--danger) 48%, var(--danger) 52%, transparent 52%)' }}/>
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>✗ {x.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, padding: 24, background: 'var(--ink)', color: '#fff', borderRadius: 16, display: 'flex', gap: 24, alignItems: 'center' }}>
        <div className="label" style={{ color: '#93c5fd' }}>留白</div>
        <span style={{ fontSize: 14, color: '#cbd5e1' }}>logo 四周至少留出 logo 高度 1/2 的空间</span>
        <div style={{ marginLeft: 'auto', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 180, height: 90 }}>
          <div style={{ position: 'absolute', inset: '0', border: '1px dashed rgba(255,255,255,.2)', borderRadius: 8 }}/>
          <div style={{ position: 'absolute', inset: '15px 45px', border: '1px dashed #60a5fa', borderRadius: 6 }}/>
          <div style={{ width: 60, height: 60, borderRadius: 14, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28, fontWeight: 800 }}>思</div>
        </div>
      </div>
    </div>
  );
};

// ============================== 01 · 设计原则 ==============================
window.Principles = function Principles() {
  const list = [
    { n: '01', t: '少一点焦虑，多一点专注', d: '不堆 GMV、不闪红点、不"恭喜你打败 99% 用户"。屏幕上每一个元素都得为这道题、这次复习负责。', icon: 'M3 12h4l3-9 4 18 3-9h4' },
    { n: '02', t: '把规律说人话', d: 'AI 解析不是抄答案。用学生听得懂的语言，把考点的"陷阱在哪、为什么这么选"讲完整。', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
    { n: '03', t: '错题比对题更值钱', d: '错题、用时长、犹豫过的题，是产品最珍视的数据。所有学习路径都从"你哪里没想清楚"出发。', icon: 'M12 8v4M12 16h.01M22 12c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2s10 4.5 10 10z' },
    { n: '04', t: '每个数字都能解释', d: '不展示我们没法解释的指标。准确率、知识点掌握度、同侪百分位 — 每个数都能点开看怎么算的。', icon: 'M3 3v18h18M19 9l-5 5-4-4-3 3' },
    { n: '05', t: '为长跑设计，不为冲刺', d: '备考是 200 天的事。鼓励连续打卡，但绝不惩罚断更；尊重休息，比奖励熬夜更重要。', icon: 'M12 2v6M12 18v4M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M18 12h4M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24' },
  ];
  return (
    <div style={{ width: 1280, height: 760, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">01.2 · 设计原则</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>5 条<em> 不可妥协 </em>的事</h1>
      <p className="doc-lead">每个设计决策遇到分歧时，回到这 5 条对一对。如果违反了任意一条，重做。</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginTop: 36 }}>
        {list.map(p => (
          <div key={p.n} className="uk-card" style={{ padding: 22, position: 'relative' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-50)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={p.icon}/></svg>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{p.n}</div>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, margin: '4px 0 10px' }}>{p.t}</div>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--ink-muted)', margin: 0 }}>{p.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================== 01 · 调性关键词 ==============================
window.ToneWords = function ToneWords() {
  const positives = ['专业', '可信赖', '冷静', '理性', '锐利', '高效', '安静', '专注', '现代', '极简', '陪伴', 'AI native'];
  const negatives = ['焦虑', '套路', '炫技', '浮夸', '推销', '说教', '红点轰炸', '励志鸡汤'];
  return (
    <div style={{ width: 1280, height: 680, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">01.3 · 调性</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>调性关键词</h1>
      <p className="doc-lead">"备考同伴"是一种<em style={{ color: 'var(--brand)', fontStyle: 'normal', fontWeight: 700 }}>克制的陪伴</em> — 既不冷冰冰，也不打鸡血。</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 36 }}>
        <div className="uk-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>✓</span>
            <span style={{ fontSize: 16, fontWeight: 700 }}>是 · We are</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {positives.map(w => (
              <span key={w} style={{ padding: '8px 14px', background: 'var(--brand-50)', color: 'var(--brand-700)', borderRadius: 999, fontSize: 14, fontWeight: 600, border: '1px solid var(--brand-100)' }}>{w}</span>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 22, lineHeight: 1.7, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
            像图书馆里隔壁桌的同学：<strong style={{ color: 'var(--ink)' }}>足够安静</strong>不打扰你，<strong style={{ color: 'var(--ink)' }}>足够靠谱</strong>愿意把笔记借给你。
          </p>
        </div>

        <div className="uk-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>✗</span>
            <span style={{ fontSize: 16, fontWeight: 700 }}>不是 · We are not</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {negatives.map(w => (
              <span key={w} style={{ padding: '8px 14px', background: 'var(--bg-alt)', color: 'var(--muted)', borderRadius: 999, fontSize: 14, fontWeight: 500, border: '1px solid var(--line)', textDecoration: 'line-through' }}>{w}</span>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 22, lineHeight: 1.7, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
            <strong style={{ color: 'var(--ink)' }}>不假装是好哥们</strong>，也<strong style={{ color: 'var(--ink)' }}>不模仿网课老师的激情口吻</strong>。
            数据要给真，进度要给真，弱项要直说。
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================== 01 · Voice & Tone ==============================
window.VoiceTone = function VoiceTone() {
  const examples = [
    { ctx: '欢迎语', bad: '哈喽！亲爱的小可爱～开始你的上岸之旅吧 🎉', good: '晚上好。今天还剩 1 小时 12 分。' },
    { ctx: '正确反馈', bad: '太棒了！！你真是最聪明的宝贝！', good: '正确。这道题考的是"增长率不是直接除"，下次记住。' },
    { ctx: '错误反馈', bad: '哎呀做错啦~不要灰心！加油加油！', good: '错。第三次错在同一个考点，建议看一遍解析再做。' },
    { ctx: '成绩报告', bad: '恭喜你打败了 99% 的用户，你真是天选之子！', good: '78 分。高于 82% 的同期备考者。资料分析失分较多，建议做 30 题速算专项。' },
    { ctx: '空状态', bad: '哎呀，这里空空如也呢～', good: '暂无错题。继续保持。' },
    { ctx: '订阅引导', bad: '限时优惠！立刻升级 PRO 解锁全部功能！速度抢购！', good: '免费版每天 10 题 AI 答疑。如果不够用，PRO 是 ¥99/季。' },
  ];
  return (
    <div style={{ width: 1280, height: 760, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)', overflow: 'auto' }}>
      <span className="doc-eyebrow">01.4 · Voice & Tone</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>用词例子</h1>
      <p className="doc-lead">写完一段文案，问自己：图书馆隔壁桌会这么说吗？</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', columnGap: 16, rowGap: 12, marginTop: 32, alignItems: 'stretch' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>场景</div>
        <div style={{ fontSize: 11, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>✗ 不要这么说</div>
        <div style={{ fontSize: 11, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>✓ 这么说</div>

        {examples.map((e, i) => (
          <React.Fragment key={i}>
            <div style={{ padding: '14px 0', fontSize: 13, fontWeight: 600, color: 'var(--ink)', minWidth: 90 }}>{e.ctx}</div>
            <div style={{ padding: 14, background: 'var(--danger-bg)', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13.5, lineHeight: 1.6, color: '#991b1b' }}>{e.bad}</div>
            <div style={{ padding: 14, background: 'var(--success-bg)', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 13.5, lineHeight: 1.6, color: '#14532d' }}>{e.good}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ============================== 02 · 颜色 ==============================
const Sw = ({ bg, name, hex, fg, vars }) => (
  <div className="sw" style={{ background: bg, color: fg || '#fff' }}>
    <div className="name">{name}</div>
    <div>
      <div className="hex">{hex}</div>
      {vars && <div className="hex" style={{ marginTop: 2 }}>{vars}</div>}
    </div>
  </div>
);

window.ColorBrand = function ColorBrand() {
  return (
    <div style={{ width: 1280, height: 680, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">02.1 · 颜色 · 品牌</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>蓝色，<em>但很克制</em></h1>
      <p className="doc-lead">蓝是工具的颜色 — 沉稳、信任、不刺眼。我们只在 CTA、链接、当前态、强调统计上用它。</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 32 }}>
        <Sw bg="#eff6ff" fg="#1d4ed8" name="brand-50" hex="#EFF6FF" vars="--brand-50"/>
        <Sw bg="#dbeafe" fg="#1d4ed8" name="brand-100" hex="#DBEAFE" vars="--brand-100"/>
        <Sw bg="#bfdbfe" fg="#1d4ed8" name="brand-200" hex="#BFDBFE" vars="--brand-200"/>
        <Sw bg="#2563eb" name="brand · main" hex="#2563EB" vars="--brand"/>
        <Sw bg="#1d4ed8" name="brand-700" hex="#1D4ED8" vars="--brand-700"/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 28 }}>
        <div className="uk-card">
          <div className="label">使用比例 · 60/30/10</div>
          <div style={{ display: 'flex', height: 18, borderRadius: 6, overflow: 'hidden', marginTop: 12 }}>
            <div style={{ flex: 60, background: '#fff', borderRight: '1px solid var(--line)' }}/>
            <div style={{ flex: 30, background: 'var(--ink)' }}/>
            <div style={{ flex: 10, background: 'var(--brand)' }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginTop: 8 }} className="mono">
            <span>60% 留白 + 灰阶</span><span>30% Ink</span><span>10% Brand</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 14, lineHeight: 1.6 }}>
            一屏内 brand 色出现不超过 2-3 处。如果你发现自己想用第 4 处蓝色 — 大概率是层级没分清楚。
          </p>
        </div>
        <div className="uk-card">
          <div className="label">何时用</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', fontSize: 13, lineHeight: 2, color: 'var(--ink-muted)' }}>
            <li><span style={{ color: 'var(--success)', marginRight: 8, fontWeight: 700 }}>✓</span>主 CTA · "开始练习"、"继续"</li>
            <li><span style={{ color: 'var(--success)', marginRight: 8, fontWeight: 700 }}>✓</span>选中状态、当前题号、tab active</li>
            <li><span style={{ color: 'var(--success)', marginRight: 8, fontWeight: 700 }}>✓</span>强调数字 · 分数、连击天数</li>
            <li><span style={{ color: 'var(--success)', marginRight: 8, fontWeight: 700 }}>✓</span>链接、可点击的指标</li>
            <li style={{ marginTop: 8 }}><span style={{ color: 'var(--danger)', marginRight: 8, fontWeight: 700 }}>✗</span>大块装饰背景、营销 banner 渐变</li>
            <li><span style={{ color: 'var(--danger)', marginRight: 8, fontWeight: 700 }}>✗</span>正确/错误反馈（用语义色）</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

window.ColorNeutral = function ColorNeutral() {
  const scales = [
    { n: 'paper', hex: '#FFFFFF', v: '--paper', desc: '卡片底色' },
    { n: 'bg-alt', hex: '#F8FAFC', v: '--bg-alt', desc: '页面底色' },
    { n: 'line', hex: '#E5E7EB', v: '--line', desc: '细分割线' },
    { n: 'line-strong', hex: '#CBD5E1', v: '--line-strong', desc: '强分割' },
    { n: 'placeholder', hex: '#94A3B8', v: '--placeholder', desc: '占位文字' },
    { n: 'muted', hex: '#64748B', v: '--muted', desc: '辅助文字' },
    { n: 'ink-muted', hex: '#334155', v: '--ink-muted', desc: '次正文' },
    { n: 'ink', hex: '#0B1120', v: '--ink', desc: '主正文 · 标题' },
    { n: 'sidebar', hex: '#020617', v: '--sidebar', desc: '深色侧栏' },
  ];
  return (
    <div style={{ width: 1280, height: 620, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">02.2 · 颜色 · 中性</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>9 阶灰，<em>够用就停</em></h1>
      <p className="doc-lead">不用 50 种灰色装样子。9 阶足够覆盖文字、边框、背景所有层级。</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 8, marginTop: 32 }}>
        {scales.map(s => (
          <div key={s.n} style={{ background: s.hex, borderRadius: 12, padding: 14, height: 160, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: s.n === 'paper' ? '1px solid var(--line)' : 'none' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: ['paper', 'bg-alt', 'line', 'line-strong', 'placeholder'].includes(s.n) ? 'var(--ink)' : '#fff' }}>{s.n}</span>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: ['paper', 'bg-alt', 'line', 'line-strong', 'placeholder'].includes(s.n) ? 'var(--muted)' : 'rgba(255,255,255,.7)' }}>{s.hex}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: ['paper', 'bg-alt', 'line', 'line-strong', 'placeholder'].includes(s.n) ? 'var(--muted)' : 'rgba(255,255,255,.5)', marginTop: 2 }}>{s.v}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 8, marginTop: 8 }}>
        {scales.map(s => (
          <div key={s.n} style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>{s.desc}</div>
        ))}
      </div>
    </div>
  );
};

window.ColorSemantic = function ColorSemantic() {
  return (
    <div style={{ width: 1280, height: 680, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">02.3 · 颜色 · 语义</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>成功 / 警告 / 错误 / 信息</h1>
      <p className="doc-lead">语义色只在<strong>反馈</strong>场景出现。日常装饰、按钮变体一律用 ink + brand。</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 32 }}>
        {[
          { n: 'success', main: '#16a34a', bg: '#dcfce7', label: '✓ 答对', use: '判对、提交成功、已掌握' },
          { n: 'warn', main: '#f59e0b', bg: '#fef3c7', label: '⚑ 标记', use: '标记题、待复习、订阅过期' },
          { n: 'danger', main: '#dc2626', bg: '#fee2e2', label: '✗ 答错', use: '判错、错题、销户' },
          { n: 'info', main: '#2563eb', bg: '#eff6ff', label: 'ⓘ 提示', use: '提示、AI 建议、新功能' },
        ].map(s => (
          <div key={s.n} className="uk-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: s.main, color: '#fff', padding: 18, fontWeight: 700 }}>
              <div style={{ fontSize: 11, opacity: .8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.n}</div>
              <div style={{ fontSize: 22, marginTop: 4 }}>{s.label}</div>
            </div>
            <div style={{ background: s.bg, padding: 14, fontSize: 12, fontFamily: 'var(--mono)', color: s.main, fontWeight: 600 }}>
              bg · {s.bg}
            </div>
            <div style={{ padding: 16 }}>
              <div className="label">用于</div>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.6 }}>{s.use}</div>
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 10px', borderRadius: 6, background: s.bg, color: s.main, fontSize: 11, fontWeight: 600, border: `1px solid ${s.main}` }}>chip</span>
                <span style={{ padding: '4px 10px', borderRadius: 6, background: s.main, color: '#fff', fontSize: 11, fontWeight: 600 }}>solid</span>
                <span style={{ padding: '4px 10px', borderRadius: 6, color: s.main, fontSize: 11, fontWeight: 600, border: `1px solid ${s.main}` }}>outline</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================== 02 · 字体 ==============================
window.TypeStack = function TypeStack() {
  return (
    <div style={{ width: 1280, height: 580, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">02.4 · 字体 · 字体栈</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>两个字体，<em>就两个</em></h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 32 }}>
        <div className="uk-card">
          <div className="label">主字体</div>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 8 }}>Inter</div>
          <div style={{ fontSize: 28, fontWeight: 500, marginTop: 4, color: 'var(--ink-muted)' }}>思考是慢一点</div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '20px 0 14px' }}/>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            'Inter', system-ui, -apple-system,<br/>'PingFang SC', 'Microsoft YaHei', sans-serif
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 16 }}>
            {[400, 500, 600, 700, 800].map(w => (
              <div key={w} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: w }}>Aa</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{w}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="uk-card">
          <div className="label">数字 · 等宽</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 60, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 8 }}>00:42:18</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 500, marginTop: 4, color: 'var(--ink-muted)' }}>78 / 100</div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '20px 0 14px' }}/>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            'JetBrains Mono', 'SF Mono', Monaco,<br/>Consolas, monospace
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 16, lineHeight: 1.6 }}>
            分数、计时器、题号、ID、code label 一律走等宽 — 切勿用 Inter 凑合，数字会跳。
          </p>
        </div>
      </div>
    </div>
  );
};

window.TypeScale = function TypeScale() {
  const rows = [
    { tok: 'display', size: 56, weight: 800, lh: 1.1, ls: '-0.03em', sample: '思考是慢一点', use: '营销 hero · 大封面' },
    { tok: 'h1', size: 36, weight: 700, lh: 1.15, ls: '-0.02em', sample: '答题报告 · 已完成', use: '页面主标题' },
    { tok: 'h2', size: 28, weight: 700, lh: 1.2, ls: '-0.02em', sample: '今日推荐', use: '区块标题' },
    { tok: 'h3', size: 22, weight: 700, lh: 1.3, ls: '-0.01em', sample: '资料分析 · 增长率', use: '卡片标题' },
    { tok: 'h4', size: 18, weight: 700, lh: 1.4, ls: '-0.01em', sample: '2024 国考行测', use: '小标题' },
    { tok: 'body', size: 14, weight: 400, lh: 1.65, ls: '0', sample: '关于政府与市场在科技创新中的关系，下列论述与文段观点最契合的是。', use: '正文' },
    { tok: 'body-sm', size: 13, weight: 400, lh: 1.6, ls: '0', sample: '高于 82% 的同期备考者', use: '次要正文' },
    { tok: 'caption', size: 12, weight: 500, lh: 1.5, ls: '0', sample: '提交于 2026.04.26 22:48', use: '说明 · meta' },
    { tok: 'eyebrow', size: 11, weight: 700, lh: 1.4, ls: '0.08em', sample: 'ANSWER REPORT', use: '区块前缀 · 大写' },
    { tok: 'mono-num', size: 36, weight: 700, lh: 1, ls: '-0.01em', sample: '78', use: '数字强调', mono: true },
  ];
  return (
    <div style={{ width: 1280, height: 820, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)', overflow: 'auto' }}>
      <span className="doc-eyebrow">02.5 · 字体 · 阶梯</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>10 级，覆盖所有场景</h1>

      <div style={{ marginTop: 28 }}>
        {rows.map(r => (
          <div key={r.tok} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 240px 200px', gap: 24, alignItems: 'baseline', padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
            <span className="tok">{r.tok}</span>
            <div style={{ fontSize: r.size, fontWeight: r.weight, lineHeight: r.lh, letterSpacing: r.ls, fontFamily: r.mono ? 'var(--mono)' : 'inherit', textTransform: r.tok === 'eyebrow' ? 'uppercase' : 'none', color: r.tok === 'eyebrow' ? 'var(--brand)' : 'var(--ink)' }}>
              {r.sample}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
              {r.size}/{Math.round(r.size * r.lh)} · w{r.weight} · ls {r.ls}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.use}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================== 02 · 间距/圆角/阴影 ==============================
window.Spacing = function Spacing() {
  const scale = [4, 8, 12, 16, 20, 24, 32, 40, 56, 80];
  return (
    <div style={{ width: 1280, height: 620, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">02.6 · 间距</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>8 的倍数，<em>不要凑合</em></h1>
      <p className="doc-lead">基础栅格 8px。常用阶梯如下。每加一档都对应一个层级关系，不要随意取 13、22 这种数。</p>

      <div className="uk-card" style={{ marginTop: 32, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 100, paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
          {scale.map(n => (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{ width: '100%', height: n * 1, background: 'var(--brand)', borderRadius: 4 }}/>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
          {scale.map(n => (
            <div key={n} style={{ flex: 1, textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{n}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>space-{n}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 16 }}>
        {[
          ['icon ↔ 文字', '8'],
          ['卡片 padding', '24-28'],
          ['区块之间', '32-40'],
        ].map(([k, v]) => (
          <div key={k} className="uk-card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{k}</span>
            <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand)' }}>{v}px</span>
          </div>
        ))}
      </div>
    </div>
  );
};

window.Radii = function Radii() {
  const radii = [
    { n: 'sm', v: 8, use: 'chip · tiny btn' },
    { n: 'md', v: 12, use: 'btn · input · opt' },
    { n: 'lg', v: 16, use: 'card · modal' },
    { n: 'xl', v: 20, use: 'hero card · feature' },
    { n: 'pill', v: 999, use: 'eyebrow · 进度条' },
  ];
  return (
    <div style={{ width: 1280, height: 500, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">02.7 · 圆角</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>柔和但克制</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginTop: 36 }}>
        {radii.map(r => (
          <div key={r.n} style={{ textAlign: 'center' }}>
            <div style={{ width: '100%', height: 160, background: 'var(--brand-50)', border: '2px solid var(--brand)', borderRadius: r.v, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--brand)' }}>{r.v === 999 ? '∞' : r.v}</span>
            </div>
            <div className="tok" style={{ marginTop: 12 }}>--r-{r.n}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{r.use}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

window.Shadows = function Shadows() {
  const list = [
    { n: 'card', tok: '--shadow-card', val: '0 1px 2px rgb(15 23 42 / .04), 0 1px 3px rgb(15 23 42 / .06)', use: '默认卡片' },
    { n: 'pop', tok: '--shadow-pop', val: '0 10px 30px -10px rgb(15 23 42 / .15)', use: '悬停 · drawer' },
    { n: 'hero', tok: '--shadow-hero', val: '0 30px 80px -30px rgb(15 23 42 / .25)', use: '营销 hero · modal' },
  ];
  return (
    <div style={{ width: 1280, height: 500, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">02.8 · 阴影</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>三档，够用</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 36 }}>
        {list.map(s => (
          <div key={s.n} style={{ textAlign: 'center' }}>
            <div style={{ width: 220, height: 140, background: '#fff', borderRadius: 16, boxShadow: s.val, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>
              {s.n}
            </div>
            <div className="tok" style={{ marginTop: 16 }}>{s.tok}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{s.use}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================== 02 · 图标 ==============================
window.Icons = function Icons() {
  const icons = [
    { n: 'home', d: 'm3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
    { n: 'book', d: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' },
    { n: 'message', d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
    { n: 'edit', d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z' },
    { n: 'calendar', d: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
    { n: 'check-circle', d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3' },
    { n: 'bar-chart', d: 'M3 3v18h18M19 9l-5 5-4-4-3 3' },
    { n: 'settings', d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
    { n: 'clock', d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2' },
    { n: 'flag', d: 'M4 22V4M4 4h14l-3 5 3 5H4' },
    { n: 'flame', d: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z' },
    { n: 'search', d: 'M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z' },
    { n: 'x-circle', d: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zM15 9l-6 6M9 9l6 6' },
    { n: 'sparkles', d: 'M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z' },
    { n: 'arrow-right', d: 'M5 12h14M12 5l7 7-7 7' },
    { n: 'plus', d: 'M12 5v14M5 12h14' },
    { n: 'bookmark', d: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' },
    { n: 'user', d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
    { n: 'bell', d: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0' },
  ];
  return (
    <div style={{ width: 1280, height: 760, background: 'var(--paper)', padding: 56, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <span className="doc-eyebrow">02.9 · 图标 · lucide</span>
      <h1 className="doc-h" style={{ marginTop: 8 }}>线性，<em>1.75-2px stroke</em></h1>
      <p className="doc-lead">图标库统一使用 <span className="tok">lucide-react</span>。stroke linecap/join 都用 round。不混用填充图标。</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 12, marginTop: 32 }}>
        {icons.map(i => (
          <div key={i.n} style={{ aspectRatio: '1', border: '1px solid var(--line)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--ink)', background: 'var(--bg-alt)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={i.d}/></svg>
            <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{i.n}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 24 }}>
        {[
          { n: '16', s: 16, sw: 2, use: 'inline 文字旁' },
          { n: '20', s: 20, sw: 2, use: '导航 · chip' },
          { n: '24', s: 24, sw: 2, use: '默认' },
          { n: '32', s: 32, sw: 1.75, use: '空状态 · 强调' },
        ].map(sz => (
          <div key={sz.n} className="uk-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <svg width={sz.s} height={sz.s} viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth={sz.sw} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{sz.n}px · sw {sz.sw}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sz.use}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
