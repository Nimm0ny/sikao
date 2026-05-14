---
type: engineering
status: draft
owner: lhr
last-reviewed: 2026-05-14
source: ai-gongkao-mvp-value-loop carve-out
---

# Billing / Credit / Membership System

> **本 plan 处于 stub 状态。从 `docs/vault/01-product/ai-gongkao-mvp-value-loop.md` §5 PR-7 拆出，等待独立排期。**
>
> **本 plan 未批准，禁止任何 worktree 实施。**

## Why this is carved out

`AGENTS.md:261-275` 明文：

- 「账户/资金流相关」在「必须先和我对齐」清单
- 「永远不自己决定：删项目、生产部署、资金操作」

原 PRD §5 PR-7 (L1305+) 一口气加 5 张表 + billing API（`user_memberships` / `user_credit_accounts` / `credit_ledger` / `product_plans` / `orders`），跟 MVP 闭环混在一份执行文档里违反硬约束。因此 carve out 独立 plan，由 lhr 显式批准 + 完整方案后单独排期。

## Scope（high-level，NOT for implementation）

来源参考：`docs/vault/01-product/ai-gongkao-mvp-value-loop.md` §5 PR-7。

- 免费额度初始化（注册赠送 / 任务奖励 / 邀请奖励）
- 申论批改次数消耗 + ledger 记账（双向记账保证审计可追溯）
- 会员状态 / 订阅期 / 自动续费
- 订单与支付：支付通道选型 / 退款 / 风控 / 财税合规

## 进入方案制定阶段前必须明确

- [ ] 支付通道选型（微信 / 支付宝 / Stripe / 其他？合规许可？）
- [ ] 退款 / 客诉 / 风控流程
- [ ] 财税合规（电子发票 / 海外用户税务 / 个人 vs 公司主体）
- [ ] 个人独立开发者的资金账户隔离方案
- [ ] DB schema 详细设计（事务隔离 / ledger 双向记账 / 幂等保证）
- [ ] API 契约（前端 paywall hook + checkout flow + webhook 回调）
- [ ] 前端 paywall / 购买流 / 我的钱包 UI
- [ ] 灰度上线策略 + 异常回滚
- [ ] 数据迁移（如果先有免费用户后开收费）

## Blocked on

`lhr 显式批准（聊天里"授权" + 本 plan status 改 active）` 后才能进入方案制定阶段。

未批准前任何 agent 不得：

- 新增 `user_memberships` / `user_credit_accounts` / `credit_ledger` / `product_plans` / `orders` 表
- 添加 billing 相关 API
- 修改 essay grading 流程接入 quota / paywall
- 修改 today task 引入 `quota_purchase` task type
