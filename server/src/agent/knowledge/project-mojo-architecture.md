# Mojo 架构总览与模块联动

本文档是 **Mojo 前端应用（`apps/mojo`）** 的架构总结，重点讲清「每个模块负责什么、模块之间如何联动」。

> 事实就近原则：本文是**跨模块的联动地图与指针**，各模块的权威细节仍以就近的 `AGENTS.md` 为准（文中已给出链接）。如果模块行为发生变化，请先改对应 `AGENTS.md`，再回来同步本文。

相关入口：

- 仓库整体架构：[`ARCHITECTURE.md`](../../ARCHITECTURE.md)
- 应用就近指南：[`apps/mojo/AGENTS.md`](../../apps/mojo/AGENTS.md)
- CLI 版本（终端 Agent 客户端）：[`apps/mojo-cli/AGENTS.md`](../../apps/mojo-cli/AGENTS.md)
- 用户文档站：[`apps/mojo-docs/AGENTS.md`](../../apps/mojo-docs/AGENTS.md)

---

## 1. Mojo 是什么

`apps/mojo` 是一个从 `fe_mono_m/apps/mojo` **source-first 迁移**而来的前端微前端应用，承载 Merlin / New Seed 的 agent、chat、skill、cron、附件、语音输入、行为交互等工作流。它是本仓库中体量最大、最活跃的面（`pages/` 数百文件）。

它的**核心是一条实时 agent chat 主链路**：

```text
WebSocket 传输  →  事件流分发  →  turn 状态机  →  view-model 装配  →  React 渲染
```

围绕这条主链路，还有若干功能面（cron、skill、settings、dock、behavior interactor 等）和支撑层（services、tracking、store、i18n / theme）。

同一产品还有两个兄弟工作区（不在本文详述）：

- `apps/mojo-cli`：TS + ink 5 的**终端版** Agent 客户端（`@byted/mojo`），三层解耦 `transport → engine → ui`，backend-driven。
- `apps/mojo-docs`：基于 Rspress 的**用户文档站**。

---

## 2. 顶层模块地图

| 模块 | 目录 | 职责 | 权威指南 |
| --- | --- | --- | --- |
| **客户端 Agent 运行时** | `src/hooks/useAgentChat/` | 持有 WebSocket、分发流式事件、驱动 turn 状态机、对外暴露命令式 actions | [AGENTS.md](../../apps/mojo/src/hooks/useAgentChat/AGENTS.md) |
| **Turn 状态数据层** | `src/pages/chat/[session_id]/state/` | 纯函数：把原始事件转成可渲染的 turn / session view-model | [AGENTS.md](../../apps/mojo/src/pages/chat/[session_id]/state/AGENTS.md) |
| **UI 订阅 store** | `src/hooks/useChatState.ts` | Zustand store，UI **唯一订阅来源**（`sessionViews`） | — |
| **服务 / 传输层** | `src/services/` | 生成的 API 客户端 + 请求封装 + 功能服务 | [AGENTS.md](../../apps/mojo/src/services/AGENTS.md) |
| **Chat 页面与组件** | `src/pages/chat/` | chat 页面、会话视图、全部 chat UI 组件 | — |
| **其他功能页** | `src/pages/{cron,skills,settings,dock,...}/` | 非 chat 的功能页面 | — |
| **全局 store** | `src/store/useMojoStore.ts` 等 | 应用 / 用户 / 布局 / 模型 / workspace 状态 | — |
| **埋点** | `src/tracking/` | TEA 埋点（声明式点击 + 命令式上报） | [AGENTS.md](../../apps/mojo/src/tracking/AGENTS.md) |

**禁止手改**：`src/services/bam-auto-generate/`（生成代码）、`vendor-workspaces/`、`dist/`、`documents/`、`log/`。

---

## 3. 核心主链路：一次流式会话如何流动

这是理解 Mojo 最重要的一张图。一条从服务端来的消息，会依次穿过传输层、编排器、turn store、数据层、UI store，最后到达 React 组件：

```text
┌────────────────────────────────────────────────────────────────────────┐
│ useAgentChatWebSocket.ts        传输层                                    │
│  - 构造 WS url（jwt token 或 MOJO_LOCAL_USER_ID）                         │
│  - 指数退避重连（关闭 react-use-websocket 内建重连，由外层刷新 token）    │
│  - 30s 心跳（action:0 ping）                                              │
│  - onMessage: JSON.parse → onServerMessage(data)                         │
└───────────────────────────────┬──────────────────────────────────────────┘
                                 ▼  WSServerMessage
┌────────────────────────────────────────────────────────────────────────┐
│ useAgentChat/index.tsx          编排器（唯一编排 hook）                    │
│  onServerMessage(message) 按 type 分发：                                  │
│    CHAT_DELTA        → onChatDelta                                        │
│    CHAT_FINISHED/ERR → appendTerminalTurnInput（finalize）+ 重置          │
│    CONFIRM_REQUEST   → useAgentChatConfirm（HITL 确认旁路）               │
│    ASK_USER_REQUEST  → useAgentChatAskUser（提问旁路）                    │
└───────────────────────────────┬──────────────────────────────────────────┘
             ┌───────────────────┴────────────────────┐
             ▼                                         ▼
┌──────────────────────────────┐        ┌──────────────────────────────────┐
│ useAgentChatTurnStore.ts     │        │ state/ 数据层（纯函数，无 React）  │
│ 运行中 turn 的内存暂存        │        │  toAgentEventInput  适配          │
│ （ref，非 React state）:      │───────▶│  sortTurnInputs     排序          │
│  - turnEvents Map（event id）│        │  applyTurnInput     归约→TurnState │
│  - TurnState / lastEventId   │        │  selectTurnViewModel 选择         │
│  - pendingLocalTurnKey（乐观）│        │  buildSessionTurnView 装配        │
│  - turnId→localKey 映射       │        │      ↓ SessionTurnViewModel       │
└──────────────────────────────┘        └────────────────┬─────────────────┘
                                                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│ mojoDeltaRenderScheduler.ts     合并重渲染                                 │
│  - 可见 80ms / 隐藏 1000ms 合并 partial-delta                            │
│  - finalize / confirm / ask_user 走 syncNow 绕过合并                     │
└───────────────────────────────┬──────────────────────────────────────────┘
                                 ▼  upsertSessionView / patchSessionView / renameSessionView
┌────────────────────────────────────────────────────────────────────────┐
│ useChatState.ts（Zustand）      已提交状态 —— UI 唯一订阅来源              │
│  sessionViews[sessionId] = SessionTurnViewModel[]                        │
└───────────────────────────────┬──────────────────────────────────────────┘
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│ pages/chat/[session_id]/components   渲染                                  │
│  TurnList → TurnRow → 消息 / 时间线步骤 / 工具面板 / artifact             │
└────────────────────────────────────────────────────────────────────────┘
```

**一句话概括联动**：传输层只产出原始事件 → 编排器分发并写入 turn store（暂存）+ 触发数据层纯函数装配 → 装配结果经渲染调度器合并后写入 `useChatState` → 组件订阅 `useChatState` 渲染。**只有写入 `useChatState` 才会触达 UI。**

---

## 4. 模块间联动详解

### 4.1 传输层 ↔ 编排器

- **传输层** [`useAgentChatWebSocket.ts`](../../apps/mojo/src/hooks/useAgentChat/useAgentChatWebSocket.ts) 只关心「连上、拿消息、断线重连」：它构造带 jwt/local-user 的 WS url，用 `react-use-websocket` 打开连接，30s 发一次心跳；收到消息后 `JSON.parse` 成 `WSServerMessage` 交给 `onServerMessage` 回调。它**不认识任何 UI / turn 语义**。
- **编排器** [`index.tsx`](../../apps/mojo/src/hooks/useAgentChat/index.tsx) 提供 `onServerMessage`，按 `WSServerMessageType` 分发。它也向外暴露命令式 actions（`send`、`stop`、`confirmResponse`、`askUserResponse`、pending-prompt 编辑），这些 action 通过传输层的 `sendMessage` 用 `MojoMessageAction` 枚举（`chatSubmit=1`、`chatSubscribe=2`、`chatCancel=3`、`confirmResponse=4`……）把指令发回服务端。

**Token 刷新联动**：传输层刻意**关闭** `react-use-websocket` 的内建重连，改由外层在每次连接前重新拉取 jwt——保证重连时 token 不会用旧的。

### 4.2 编排器 ↔ 两套 store（关键不变量）

Mojo 有**两套 store，只有一套是「已提交」的**：

| store | 类型 | 角色 |
| --- | --- | --- |
| [`useAgentChatTurnStore`](../../apps/mojo/src/hooks/useAgentChat/useAgentChatTurnStore.ts) | 普通 ref（非 React state） | **运行中 / 流式** turn 的暂存：事件 Map、运行时 `TurnState`、`lastEventId`、乐观 id 映射 |
| [`useChatState`](../../apps/mojo/src/hooks/useChatState.ts) | Zustand | **已提交**的 `sessionViews`，组件在此订阅 |

编排器每收到一批 delta，就把事件塞进 turn store（立即落账，不触发渲染），再触发数据层重新装配，最后**只有** `upsertSessionView` / `patchSessionView` / `renameSessionView` 才会把结果推进 `useChatState`、触达 UI。

**乐观 turn id 联动**：一次 `send` 在本地先用 `Date.now()` 造一个 pending turn（`pendingLocalTurnKey`）；收到首个服务端 delta 或 `chat_finished` 时，通过 `renameSessionView` 把它**重命名**为真实 `turn_id`。这条重命名链贯穿 turn store（`turnId→localKey` 映射）和 `useChatState`（`renameSessionTurnView`），两边必须保持一致。

### 4.3 编排器 ↔ 数据层（纯函数管线）

繁重的「事件 → 可渲染视图」转换全部落在 [`state/`](../../apps/mojo/src/pages/chat/[session_id]/state/) 纯函数层（无 React、无 I/O），管线为：

```text
原始 AgentEvent[]
  → toAgentEventInput(s)          turnInputAdapters.ts   包成 TurnInput，标记传输来源
  → sortAgentEvents / sortTurnInputs  turnEventOrdering.ts  CreatedAt → Order → EventType
  → applyTurnInput / reduceTurnInputs turnEventReducer.ts   归约出 TurnState（状态机，原地可变）
  → selectTurnViewModel           turnSelectors.tsx      TurnState → ChatTurnViewModel（时间线、subagent 嵌套）
  → buildSessionTurnViewFromState/Inputs  sessionAssembler.ts  叠加 artifact/反馈/模型 → SessionTurnViewModel
```

编排器在 `syncTurnView` 里调用这条管线，产出 `SessionTurnViewModel`（UI 实际渲染的对象），再交给 `useChatState`。

数据层的三条硬不变量（改动前必读，详见其 AGENTS.md）：

- **排序承重**：归约前必须先排序，乱序会破坏状态机。
- **原地可变 + version 失效**：reducer 复用 Map/Set 以求性能，改后要 bump scope version 使选择器缓存失效。
- **按 event id 去重**：reducer 与 `taskSubagentStore` 都要去重，因为事件可能到达两次（实时 + 续传）。
- **finalize 不可逆**：一旦 turn finalize，不得回退到运行中。

### 4.4 渲染调度器：连接数据层与 UI 的节流阀

[`mojoDeltaRenderScheduler.ts`](../../apps/mojo/src/hooks/useAgentChat/mojoDeltaRenderScheduler.ts) 把高频 partial-delta 合并成低频重渲染（**页面可见 80ms / 隐藏 1000ms**）。数据本身在 `applyRuntimeInput` 里逐个立即落账，被合并的只是「面向 React 的视图同步」。需要即时落屏的事件（finalize / confirm / ask_user）走独立的 `syncNow` 路径绕过合并。

### 4.5 编排器 ↔ 交互旁路（HITL / ask-user / subagent / 触发型 turn）

主链路之外，编排器还挂着若干旁路，它们共享同一套 turn/session 机制但走独立生命周期：

- **HITL 确认** [`useAgentChatConfirm.ts`](../../apps/mojo/src/hooks/useAgentChat/useAgentChatConfirm.ts)：处理 `CONFIRM_REQUEST` 与 hitl feedback，用 `syncTurnViewNow` 即时刷新。
- **ask-user 提问** [`useAgentChatAskUser.ts`](../../apps/mojo/src/hooks/useAgentChat/useAgentChatAskUser.ts)：处理 `ASK_USER_REQUEST`，维护 `activeAskUserQuestion`。
- **subagent 事件** [`state/taskSubagentStore.ts`](../../apps/mojo/src/pages/chat/[session_id]/state/taskSubagentStore.ts)：以 `(turnId, toolCallId)` 为 key 的全局内存缓存，合并 WS + API 队列、按 event id 去重、分页。
- **team / cron / event-trigger 触发的 turn**：由编排器用 `createCronTriggeredSessionTurnView` / `createEventTriggeredSessionTurnView` 等装配，渲染进 `BehaviorInteractor` 面板。
- **断线续传**：`last_event_id`（`computeSubscribeLastEventId` 从已渲染视图或 turn store 取）保证重连不重复流式。

### 4.6 UI 层：页面如何消费 store

- [`pages/chat/[session_id]/index.tsx`](../../apps/mojo/src/pages/chat/[session_id]/index.tsx) 是会话页容器：调用 `useAgentChat(props)` 启动运行时，用 `useSessionHistory` 拉历史、`useRenderedTurns` 从 `useChatState` 选出要渲染的 turns、`useChatScroll` 管滚动。
- `TurnList` → `TurnRow` 逐 turn 渲染消息、时间线步骤、工具面板；`BehaviorInteractor` 侧面板渲染 team / cron / preview / sandbox 浏览器等「行为交互」表面。
- 组件**只读 `useChatState`**，不直接碰 turn store 或传输层——这条边界保证了渲染与传输解耦。

### 4.7 服务 / 传输层：数据从哪来

[`src/services/`](../../apps/mojo/src/services/) 是所有对后端的出口：

- `bam-auto-generate/`：由 `bam.config.json` 生成的三套客户端类型，**禁止手改**：
  - `mojo` → `merlin.agent.console`（chat stream、session、turn、task、sandbox、websocket 类型……主 API 面）
  - `prophet` → `aml.merlin.prophet`（消息 / Lark doc / 卡片广播）
  - `seed` → `data.seed.titan_backend`（数据集、job、评测……）
- `bam-request.ts` 导出 `mojoService`（到处用作 `mojoService.ListTurn(...)`），响应拦截器解包 `res.result`，`BASE_URL=/api/agent`。
- 功能服务（可改）：`mention*Service`、`dockSessionService`、`workspaceEnvironment`、`sandboxBrowser` 等。

**联动点**：编排器与页面通过 `mojoService` / `mojoSessionService` 拉历史、列 turn、取 session；WebSocket 的类型（`WSServerMessage` / `EventType`）也来自 `bam-auto-generate`，因此**服务端协议一变，主链路的事件分发也随之改**——这是为什么改 API 面必须走「改 `bam.config.json` → 重新生成」而不是手改产物。

### 4.8 横切支撑层

- **全局 store** [`useMojoStore.ts`](../../apps/mojo/src/store/useMojoStore.ts)：布局（sider 折叠 / 设备断点）、模型（`agentModelMap`、可用模型、API 统计）、用户信息。chat 页从这里取模型列表、用户名、布局状态。
- **埋点** [`src/tracking/`](../../apps/mojo/src/tracking/)：声明式 `createClickTrackProps`（挂 `data-track-*`，由 `TrackingProvider` 自动上报）+ 命令式 `reportTrackingEvent`；label 一律取自 `TEA_TRACKING_LABELS`，禁止硬编码。
- **主题 / i18n**：样式走就近 `*.module.less` + 设计 token（禁硬编码颜色）；用户可见中文必须过 `I18n` 标签模板（`@byted-aml/reckon-i18n`），否则 eslint 报错。

---

## 5. 数据流总结（跨层不变量速查）

| 不变量 | 说明 | 涉及模块 |
| --- | --- | --- |
| **两套 store，只有一套已提交** | turn store 是暂存，`useChatState` 才触达 UI | 编排器 / turn store / useChatState |
| **乐观 turn id** | 本地 `Date.now()` → 收到 delta/finish 后 `rename` 为真实 `turn_id` | 编排器 / turn store / useChatState |
| **排序承重 + 原地可变 + 去重** | 归约前先排序；改状态后 bump version；按 event id 去重 | state/ 数据层 |
| **finalize 不可逆** | turn 一旦结束不得回退运行中 | 编排器 / reducer |
| **续传靠 last_event_id** | 重连不重复流式 | 传输层 / 编排器 / 视图选择器 |
| **协议来自生成代码** | WS 消息类型与 API 均由 `bam.config.json` 生成 | services / 编排器 |
| **UI 只读 useChatState** | 渲染与传输解耦 | pages/chat 组件 |

---

## 6. 迁移边界（当前事实）

`apps/mojo` 处于 source-first 迁移的过渡态：

- `src/`、`config/`、`documents/`、`scripts/` 从源仓库拷贝而来。
- 已提升为 workspace 包：`packages/{ts-config-fe-mono, eslint-config-fe-mono, reckon-i18n, reckon-i18n-checker, reckon-utils}`，以 `workspace:*` 引用。
- 未提升的源仓库依赖留在 `vendor-workspaces/`（如裁剪后的 `merlin-components` / `reckon-components`），是应用自有普通源码，**不注册为 package、不加 `package.json`**。
- 本轮迁移**不认证**本地构建、CI、发布、运行时宿主接入。

---

## 7. 命令与验证

- 安装依赖：仓库根目录 `emo install`
- 启动：仓库根目录 `emo start mojo`
- 类型检查：`apps/mojo` 下 `pnpm tsc-check`
- Lint：`pnpm lint`（或 `edenx lint <path>` 缩小范围）
- **前端不写单测**：本仓库前端未启用测试框架，改动通过类型检查 + lint + `emo start mojo` 跑真实会话验证。
- 改本文或模块 `AGENTS.md` / workspace 注册后：仓库根目录 `node scripts/validate-agent-docs.js`。
