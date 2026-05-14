---
type: design
status: draft
owner: lhr
last-reviewed: 2026-05-07
---

# Auth (登录/注册/找回密码) 原型 — 4 版方向

> 静态 HTML 原型，覆盖 identity v2 4 个 view (login / register-email / register-phone / forgot-password)。
> 每版 import `design/tokens.css`，所有色值/字号/圆角/阴影都用 token，不引入任何新色。
> Skill: `web-design-engineer`. 参考 claude.com / chatgpt.com 登录窗口风格.

## 4 版区别一览

| 版本 | 风格关键词 | 适合用户群 | 视觉密度 | 心理感觉 |
|---|---|---|---|---|
| **v1 minimal** | claude.com、ink-first、极简 | 成熟用户、追求效率 | 紧凑（400 px 卡片，32 px padding） | 干练、利落、像一份"工具" |
| **v2 friendly** | chatgpt.com、圆角、entry list | 通用消费级、新手友好 | 宽松（440 px 卡片，48 px padding） | 亲和、温和、像一个"产品" |
| **v3 serif library** | Source Serif 4、双栏 hero、图书馆 | 备考长期用户、爱学习场景 | 中等（双栏 + 380 px 卡片） | 有质感、有调性、像一个"陪伴" |
| **v4 mobile-first** | 360 px 单列、48 px 触控、sticky CTA | 手机用户优先（中国市场主力） | 紧凑（手机壳） | 顺手、不打扰、像 App 一开就上手 |

## 看法 + 推荐

**我推荐用 v3 serif library 作主页桌面端** + **v4 mobile-first 作手机端**：
- v3 体现"让备考从刷题变成思考"的标语 + 备考同伴调性（左侧 hero 用 Source Serif 4 大字直接传达）
- v4 是中国市场主力（公考用户大量手机操作）的最佳形态
- v1/v2 作 fallback 备选 / 给你 mix 元素用

但你完全可以**混搭**：
- 拿 v1 的卡片密度 + v3 的 serif 标题 + v4 的 sticky CTA
- 或拿 v2 的 entry list 模式 + v1 的极简 padding
- 这正是 4 版同时给你的用意

## 视觉决策（共同规则）

跟 `docs/design/style-guide.md` + `design/tokens.css` 对齐:

- **Brand = ink (`--brand: #0b1120`)**: 主 CTA 是黑色背景白色字
- **Accent = blue (`--accent: #3f7ef1`)**: 仅 focus ring / 文字链接 / 不作 CTA 背景
- **Surface = white-on-bg-alt**: 卡片 `--bg`，外层 `--bg-alt`
- **Radii**: 输入框 `--r-md` (12px), 按钮 `--r-btn` (10px), 卡片 `--r-lg` (16px) 或更大
- **Shadow**: `--shadow-card` (subtle 1-3px) 默认；v2 用 `--shadow-pop` (10-30px) 加强浮起感
- **Typography**: sans = Inter + 系统兜底；serif = Source Serif 4（仅 v3 用）
- **No emoji**: 用 ink-tinted glyph (`思` 在黑方块里) 替代 logo emoji

## Identity v2 后端 API 映射

每版原型的 form action 留空（`onsubmit="event.preventDefault()"`），实际 wire 到后端时:

| View | Endpoint | Payload |
|---|---|---|
| `#login` | `POST /api/v2/auth/login` | `{ identifier, password }` |
| `#register-email` | `POST /api/v2/auth/register/email` | `{ email, password, displayName? }` |
| `#register-phone`（先 send-code 再 confirm） | `POST /api/v2/auth/sms/send-code` → `POST /api/v2/auth/register/phone` | `{ phone, purpose:"register" }` → `{ phone, smsCode, password, displayName? }` |
| `#forgot` | `POST /api/v2/auth/forgot-password` | `{ identifier }` |

老 user 登录 (D15 username_legacy fallback) 仍走 `#login`，identifier 探测在后端 (含 @ → email; 11 位数字 → phone; 否则 username 仅 email/phone 都 NULL 的老 user 命中)。

## 错误态没设计

4 版都聚焦 happy path. **错误态**（密码错 / 邮箱已注册 / 手机号已绑 / SMS code 过期 / 限流 429）没在原型里设计 — 你 wire React 时按下面 token 自助:

| 错误类型 | Token | 视觉 |
|---|---|---|
| 字段级 (输入有问题) | `--danger` (#dc2626) + `--danger-bg` (#fee2e2) | 输入框 border 红 + 下方 helper 替成红字 |
| Form 级 (提交失败) | 同上 | 卡片顶部一行 banner |
| 限流 (429) | `--warn` (#f59e0b) + `--warn-bg` | 提示"请稍后再试"+ 倒计时秒数 |

Code 错误码 (后端返) 映射前端文案，建议建一个 `frontend/src/features/auth/errorCopy.ts`:
- `invalid_credentials` → "账号或密码错误"
- `email_taken` / `phone_taken` → "邮箱/手机已注册，直接登录"
- `phone_already_bound` → "你已绑过这个手机号"
- `code_invalid` → "验证码错误或已过期"
- `password_invalid` → "密码错误"
- `identifier_must_remain_verified` → "至少保留一个 verified 联系方式"
- `csrf_missing` / `csrf_mismatch` → 应该不让用户看到 (前端 axios interceptor 自动 retry)

## 排版到 React 的步骤建议

1. **挑你最喜欢的版本** + **想 mix 的元素**告诉我
2. 我把 HTML 抽成 React component 树, 拆出:
   - `<AuthLayout>` 外壳 (hero / 双栏 / 单卡)
   - `<AuthCard>` 卡片
   - `<Field>` 输入 + label + help
   - `<Button>` (primary / secondary / send-code)
   - `<TabSwitcher>` 顶部 tabs (开发期可见, 上线删)
3. 各 view 是单独 page (router):
   - `/login` `<LoginPage>`
   - `/register/email` `<RegisterEmailPage>`
   - `/register/phone` `<RegisterPhonePage>`
   - `/forgot-password` `<ForgotPasswordPage>`
4. 状态管理走现有 React Query / Zustand 模式 (跟其他 view 一致)
5. SMS code 倒计时用 `useEffect` + `setInterval`, button disabled 60 秒
6. 错误码映射 errorCopy.ts (上面表)
7. 老用户首次登录 (服务端返 `needsIdentifierSetup: true`) → router guard 跳 `/complete-profile` 强制补全

## 原型怎么本地预览

```bash
# 任意一个 dev server
cd D:/py_pj/new_web
python -m http.server 8000
# 浏览器访问:
#   http://localhost:8000/design/auth/v1-minimal/
#   http://localhost:8000/design/auth/v2-friendly/
#   http://localhost:8000/design/auth/v3-serif/
#   http://localhost:8000/design/auth/v4-mobile/
```

或直接拖 HTML 到浏览器（`design/tokens.css` 是相对路径，能解析）。

## 暗色 mode

`design/tokens.css` 有 `:root.dark` 变体，但本原型没主动加 `<html class="dark">`。手动测试:
```js
// 在浏览器 console
document.documentElement.classList.toggle('dark')
```

## 不在范围

- bind/unbind UI（绑定手机/邮箱、解绑）→ 等用户登录后在 `/profile` 做，单独原型
- complete-profile 强制补全（老用户首次登录）→ 单独原型，可基于 v3 双栏改
- 邮箱 verify-email-confirm 落地页 → 单独原型，单页跳转/状态展示

## 已知 trade-off

- v3 serif 用了 Google Fonts CDN (Source Serif 4) — 国内访问可能慢. 上线前换自托管字体或回退 system serif (`--serif: 'Source Serif 4', 'Songti SC', 'Noto Serif SC', Georgia, serif`).
- v4 phone 壳在桌面端居中显示，user 看到 status bar 的 mock 装饰可能稍显刻意；移动端展开后自动全屏（`@media (max-width: 480px)` 处理）.
- 4 版都没 OAuth (微信/Google/Apple)，因为后端没接入. 后端加 OAuth 时再单独原型.
