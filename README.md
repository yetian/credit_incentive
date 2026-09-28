# 🏦 家庭微经济 · 打卡与决策系统

全方位游戏化打卡 + 微型经济决策后端 (Node.js + Express + TypeScript + SQLite/Better-SQLite3)，配套 Vue 3 前端。
孩子从「按件计酬的执行者」逐步成长为「具备理财与决策能力的合伙人」。

> 📐 架构与数据模型详见 **[DESIGN.md](./DESIGN.md)**(ER 图、核心流程时序、账本类型、配置、决策取舍)。

## ✨ 核心概念

| 轴 | 取值 | 说明 |
| --- | --- | --- |
| 权限角色 `role` | `PARENT` / `CHILD` | PARENT = 全局 Admin；CHILD = 标准用户 |
| 成长角色 `game_role` | `employee` → `contractor` → `ceo` | 仅孩子参与，随成就自动晋升 |

- **JWT 无感鉴权**：`POST /api/auth/token` 直接签发长效 Token，Payload 含 `tenant_id` / `role` / `game_role`。
- **家长保护**：PARENT 账号必须携带正确 `pin_code` 才能换取 Token（默认 `0000`，可在后台修改）；孩子可随时用 PIN 升级为家长模式。
- **账目可冲正**：家长撤销打卡时，在事务内标记撤销并写入负数流水，同步扣回 Credit。
- **多元金融**：流动账户、复利储蓄、贷款与信用分、工具资产收益乘数。
- **游戏化**：连击 streak、11 个 emoji 徽章、角色自动晋升。

### 🔑 权限矩阵（孩子只能「消费」，家长负责「供给」）

| 操作 | CHILD | PARENT |
| --- | :---: | :---: |
| 打卡赚 Credit / 查看连击徽章 | ✅ | ✅ |
| 提交提案（决策者） | ✅ | ✅ |
| 兑换商店奖励 / 购买工具 | ✅ | ✅ |
| 储蓄 / 贷款 / 查看账单 | ✅ | ✅ |
| 创建 / 修改 / 停用任务 | ❌ | ✅ |
| 上架 / 下架奖励与工具（资产） | ❌ | ✅ |
| 审批提案 / 结算收益 | ❌ | ✅ |
| 调整余额 / 信用分 | ❌ | ✅ |
| 撤销打卡并冲正 | ❌ | ✅ |
| 成员管理（角色 / PIN） | ❌ | ✅ |


## 🚀 快速开始

```bash
npm install
npm --prefix web install

npm run seed            # 示例家庭：家长(PIN 0000) + 孩子 + 任务 + 资产目录
npm run dev             # API :3000，自动托管 web/dist 前端

# 或分别开发
npm run dev             # 后端 :3000
npm run web:dev         # 前端 :5173 (代理 /api -> :3000)
```

打开 http://localhost:3000 （或 :5173）。

## 🧪 测试与命令

```bash
npm test                # Vitest + Supertest (24 个用例)
npm run typecheck       # 后端类型检查
npm run web:typecheck   # 前端类型检查
npm run build:all       # 后端 tsc + 前端 vite build
npm run db:reset        # 清空数据库文件（保留 schema/目录重建）
npm run seed            # 重建示例数据
```

## 🗂️ 目录结构

```text
src/
├── config/         # JWT / 数据库 / 复利 / 贷款 / 晋升 / 调度配置
├── middleware/     # authMiddleware, requireAdmin, requireRole, validate(zod), error
├── controllers/    # auth, task, proposal, asset, financial, gamification, admin
├── db/             # 连接、Migration/Schema、seed、reset
├── models/         # TypeScript 类型定义
├── routes/         # 路由入口 (含 /api/admin/*)
├── services/       # 业务逻辑 (打卡结算、复利、贷款、提案、资产、徽章、角色、调度)
└── app.ts
web/                # Vue 3 + Vite 前端（孩子默认视图 + 家长后台）
tests/              # Vitest 接口测试
```

## 🔐 鉴权

所有 `/api/*`（除 `/api/auth/*`）都需要请求头：

```
Authorization: Bearer <JWT>
```

`authMiddleware` 解析 Token → 写入 `req.tenantId` / `req.tenantRole` / `req.tenantGameRole`，实现数据隔离。
`requireAdmin` 仅放行 `role === 'PARENT'`。

## 📚 API 一览

### 认证 (公开)

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/auth/tenants` | 成员列表（不含 PIN） |
| POST | `/api/auth/token` | 签发 Token（PARENT 需 `pin_code`） |
| POST | `/api/auth/parent-verify` | 用 PIN 升级/获取 PARENT Token |
| GET | `/api/auth/me` | 当前身份 |

### 孩子侧（只读任务 + 打卡 + 消费）

任务查询 `/api/tasks`、打卡 `/api/tasks/:id/checkin`、连击 `/api/tasks/streaks`、
提案 `/api/proposals`、资产兑换 `/api/assets/:id/purchase`、
财务 `/api/financial/*`、成长 `/api/gamification/*`。

> 创建/停用任务（`POST|DELETE /api/tasks`）与上架资产（`POST /api/assets`）现为家长专属，孩子调用返回 403。

### 家长后台 `/api/admin/*` (requireAdmin)

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/children` | 所有孩子仪表盘 |
| GET | `/api/admin/children/:id` | 单个孩子详情 |
| POST | `/api/admin/children/:id/adjust` | 调整余额 / 储蓄 / 信用分 |
| GET/POST | `/api/admin/tasks` | 查看全部任务 / 发布任务（可指派孩子） |
| PATCH | `/api/admin/tasks/:id` | 启用/停用任务 |
| POST | `/api/admin/check-in/:id/revoke` | 撤销打卡并冲正 Credit |
| GET/POST | `/api/members` | 成员管理 |
| PATCH | `/api/members/:id/role` | 调整权限 / 成长角色 / PIN |

商店目录管理（家长）：`POST /api/assets` 上架、`PATCH /api/assets/:id` 改价/上下架、`POST /api/assets/:id/sell` 挂牌。

## 🧾 测试 CURL 示例

### 1) 家长发布任务，孩子打卡

```bash
BASE=http://localhost:3000

# 家长 Token（默认 PIN 0000）
PARENT_TOKEN=$(curl -s -X POST $BASE/api/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"tenant_id":1,"pin_code":"0000"}' | jq -r .token)

# 家长创建任务并指派给孩子 #2
TASK=$(curl -s -X POST $BASE/api/admin/tasks \
  -H "Authorization: Bearer $PARENT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"阅读30分钟","base_credit":10,"child_id":2}' | jq -r .task.id)

# 孩子 Token（CHILD 无需 PIN）
CHILD_TOKEN=$(curl -s -X POST $BASE/api/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"tenant_id":2}' | jq -r .token)

# 孩子打卡
curl -s -X POST $BASE/api/tasks/$TASK/checkin \
  -H "Authorization: Bearer $CHILD_TOKEN" -H 'Content-Type: application/json' \
  -d '{"proof":"done"}'
```

### 2) 家长登录（PIN 默认 0000，可修改）

```bash
# 方式 A：直接选家长并带 PIN
PARENT_TOKEN=$(curl -s -X POST $BASE/api/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"tenant_id":1,"pin_code":"0000"}' | jq -r .token)

# 方式 B：从任意会话用 PIN 升级为家长
PARENT_TOKEN=$(curl -s -X POST $BASE/api/auth/parent-verify \
  -H 'Content-Type: application/json' \
  -d '{"pin_code":"0000"}' | jq -r .token)

# 修改家长 PIN
curl -s -X PATCH $BASE/api/members/1/role \
  -H "Authorization: Bearer $PARENT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"pin_code":"2580"}'
```

### 3) 家长查看孩子看板

```bash
curl -s $BASE/api/admin/children \
  -H "Authorization: Bearer $PARENT_TOKEN" | jq '.children[] | {name:.tenant.name, liquid:.account.liquid_balance, score:.credit_score}'
```

### 4) 家长发布任务（指派给孩子 #2；child_id 省略=全局）

```bash
curl -s -X POST $BASE/api/admin/tasks \
  -H "Authorization: Bearer $PARENT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"整理书桌","base_credit":20,"kind":"bounty","child_id":2}'
```

### 4b) 家长上架奖励 / 修改价格 / 下架

```bash
AID=$(curl -s -X POST $BASE/api/assets \
  -H "Authorization: Bearer $PARENT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"游乐园门票","price":500,"income_multiplier":1}' | jq -r .asset.id)

curl -s -X PATCH $BASE/api/assets/$AID \
  -H "Authorization: Bearer $PARENT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"for_sale":false}'
```

### 5) 撤销打卡并自动冲正

```bash
# CHILD_TOKEN 是第 1 步里孩子的 Token
CHECKIN_ID=$(curl -s $BASE/api/tasks/checkins \
  -H "Authorization: Bearer $CHILD_TOKEN" | jq -r '.checkins[0].id')

curl -s -X POST $BASE/api/admin/check-in/$CHECKIN_ID/revoke \
  -H "Authorization: Bearer $PARENT_TOKEN"
# => { "checkin": {... "is_revoked":1}, "reversed_amount": 20, "liquid_balance": ... }

# 孩子的负数冲正流水
curl -s $BASE/api/financial/transactions \
  -H "Authorization: Bearer $CHILD_TOKEN" | jq '.transactions[] | select(.type=="revoke_adjustment")'
```

### 6) 家长调整账户 / 信用分

```bash
curl -s -X POST $BASE/api/admin/children/2/adjust \
  -H "Authorization: Bearer $PARENT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"liquid_delta":50,"credit_score":700,"note":"奖励"}'
```

### 7) 审批提案

```bash
# 孩子提交
curl -s -X POST $BASE/api/proposals \
  -H "Authorization: Bearer $CHILD_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"卖柠檬水","budget_requested":30,"expected_return":45}'

# 家长批准（预算自动入账）
curl -s -X POST $BASE/api/proposals/1/review \
  -H "Authorization: Bearer $PARENT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"decision":"approved"}'
```

### 8) 储蓄 / 贷款

```bash
curl -s -X POST $BASE/api/financial/savings/deposit \
  -H "Authorization: Bearer $CHILD_TOKEN" -H 'Content-Type: application/json' -d '{"amount":20}'

curl -s -X POST $BASE/api/financial/savings/accrue \
  -H "Authorization: Bearer $CHILD_TOKEN" -H 'Content-Type: application/json' -d '{}'

curl -s -X POST $BASE/api/financial/loans \
  -H "Authorization: Bearer $CHILD_TOKEN" -H 'Content-Type: application/json' -d '{"principal":50}'
```

## 🖥️ 前端视图（Tailwind + Lucide，孩子/家长完全分离）

技术栈：Vue 3 + Vite + Vue Router + Tailwind CSS + lucide-vue-next。

- **孩子视图**（`/`、`/tasks`、`/proposals`、`/shop`、`/finance`）
  仪表盘（现金流 / 复利 / 工具资产 / 信用）、日常打卡、我的提案、积分兑换、沙盒银行。
  **没有任何管理入口** —— 任务与奖励只能消费不能创建。
- **家长后台**（`/admin`、`/admin/tasks`、`/admin/rewards`、`/admin/proposals`、`/admin/members`、`/admin/settings`）
  独立导航与页面：孩子看板 / 打卡撤销 / 任务发布 / 奖励上下架 / 提案审批 / 成员与 PIN 设置。
- **模式切换**：孩子顶栏 `🔐 家长` → 输入 PIN → Token 升级为 PARENT → 自动跳转家长后台；家长登录也直达后台。
  路由守卫 `meta.mode` 确保两种界面互不可见（家长访问孩子页→重定向 `/admin`，反之亦然）。

## ⚙️ 主要配置 (`.env`)

```env
JWT_SECRET=change-me
PARENT_DEFAULT_PIN=0000
SAVINGS_ANNUAL_RATE=0.12
LOAN_ANNUAL_RATE=0.18
BADGE_REWARD=10
SCHEDULER_ENABLED=false
```

> 上线前务必修改 `JWT_SECRET` 与家长 `PARENT_DEFAULT_PIN`。

## 📄 License

[MIT](./LICENSE.md) © 2026 Credit Incentive contributors
