# SIKAO 落地包

把这个目录交给 Claude Code CLI：
```bash
cd /path/to/sikao-app
cp -r handoff/* .
claude "读 CLAUDE.md，按 TODO.md 顺序实现。每完成一页打开 design/SIKAO\\ Redesign.html 对照，不允许跳过 token。"
```

## 目录
```
CLAUDE.md            ← 入口指令（项目原则 / tech baseline / 强约束）
TODO.md              ← 实施顺序，从 tokens 一直到营销页
design/
  SIKAO Redesign.html  ← 高保真原型，唯一真理来源（每个 screen 都有 label）
  tokens.css           ← 直接搬到 styles/tokens.css
  components.md        ← 组件 inventory（命名 + 关键 prop + 在 HTML 哪个 artboard）
specs/
  00-overview.md       ← 信息架构、路由、共享组件
  01-dashboard.md      ← 01 · 今日
  02-plan.md           ← 02 · 学习计划
  03-xingce.md         ← 03 / 03b / 03c · 行测三种练习页（fenbi 列表式）
  04-essay.md          ← 04 / 04b · 申论单题 + 多材料多题（含草稿纸）
  05-result.md         ← 05 / 05b · 行测/申论 成绩报告
  06-wrongbook.md      ← 错题本
  07-marketing.md      ← 落地页（marketing-redesign.html，除 hero 标语 + 真题演示外可重写）
  08-auth-profile.md   ← 登录注册 / 个人中心
```

## Slogan
> 让备考从刷题变成思考

落地页 hero、loading、empty state 都可以呼应这一句。

## 不要做的事
1. 不要替换 logo
2. 不要改 `design/v3-shenlun.bundle.html` 的功能 / 布局，只许换颜色
3. 不要在组件里写死 hex / px，所有都走 `--token`
4. 不要默认引入 lucide / heroicons / radix icons —— 自绘 1.4px 描边 SVG
5. 不要 emoji 当真实 UI；占位用占位组件
