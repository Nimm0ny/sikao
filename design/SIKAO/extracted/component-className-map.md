# SIKAO Component DOM Tree Reference

## FbCard (Question Card)

Anchor: Artboard 03

```html
<div class="fb-card is-current">
  <div class="head">
    <span class="num">12</span>
    <span class="chip is-acc">单选题 · 当前</span>
    <div class="actions">
      <button class="ic" title="收藏">[svg]</button>
    </div>
  </div>
  <div class="fb-stem">根据上述材料...</div>
  <div class="fb-opts">
    <div class="fb-opt is-selected">
      <span class="tag">A</span>
      <span class="text">约 12 万亿元</span>
      <span class="ref">⤴ M·段一</span>
    </div>
  </div>
</div>
```

CSS:
```css
.fb-card {
  background: var(--paper);
  border: 1px solid var(--rule);
  padding: 16px 18px;
  margin-bottom: 12px;
}
```

## FbOpt (Question Option)

```html
<div class="fb-opt is-selected">
  <span class="tag">A</span>
  <span class="text">同比增长 29.5%</span>
</div>
```

## FbPassage (Material/Source)

```html
<div class="fb-passage">
  <h4>2023 年 1—11 月规模以上工业企业利润</h4>
  <p>2023 年 1—11 月...<span class="hl">6.99 万亿元</span>...</p>
</div>
```

## FbTopbar (Practice Toolbar)

```html
<div class="fb-top">
  <div class="l">
    <button class="icon-btn">[chevron-left]</button>
    <div class="timer">
      <span class="t">00:12:34</span>
    </div>
  </div>
  <div class="ttl"><b>专项智能练习</b> · 资料分析</div>
  <div class="r">
    <button class="icon-btn is-primary">[check]</button>
  </div>
</div>
```

## FbDock (Bottom Navigation)

```html
<div class="fb-dock">
  <span class="stat">12 / 15 题</span>
  <div class="pills">
    <span class="p done">1</span>
    <span class="p flag">2</span>
    <span class="p cur">3</span>
  </div>
  <button class="submit">交 卷</button>
</div>
```

## EssayGrid (Double-Column Layout)

```html
<div class="essay-grid">
  <div class="source has-scratch">
    <div class="src-scroll">
      <div class="material">Material content</div>
    </div>
    <div class="scratch-pad">Scratch notes</div>
  </div>
  <div class="editor">Essay editor</div>
</div>
```

## ScratchPad (Material Clips)

```html
<div class="scratch-pad">
  <div class="sp-h">
    <span class="sp-ttl">草稿纸</span>
    <button class="sp-add">＋ 自由便签</button>
  </div>
  <div class="sp-body">
    <div class="sp-clip is-data" draggable="true">
      <span class="sp-grip">⋮⋮</span>
      <span class="sp-tag">M1</span>
      <span class="sp-txt">下放 137 项审批</span>
    </div>
  </div>
</div>
```

## Button (Action Button)

Variants: primary, secondary, ghost + lg, sm sizes

```html
<button class="btn btn-primary btn-lg">开始今日训练</button>
<button class="btn btn-secondary">取消</button>
<button class="btn btn-ghost btn-sm">更多</button>
```

## IconBtn (Icon Button)

```html
<button class="icon-btn" title="收藏">[svg]</button>
<button class="icon-btn is-on">[svg]</button>
<button class="icon-btn is-primary">[svg]</button>
```

## Chip (Badge/Tag)

```html
<span class="chip">单选题</span>
<span class="chip is-accent">当前</span>
<span class="chip is-ok">完成</span>
```

---

Key CSS reference stored in HTML lines 345-980 for .btn, .icon-btn, .chip variants
