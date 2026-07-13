# Interview Copilot

实时面试助手：麦克风采集面试官提问 → **豆包流式语音识别 2.0** 实时转写 → 一键交给 **Doubao-Seed-2.0-mini** 流式生成回答建议（站内全屏结果页展示）。

## 架构

```
┌─────────────────────────── pnpm monorepo ───────────────────────────┐
│                                                                      │
│  apps/web        Vite + React + TS + Tailwind v4 + shadcn 风格组件    │
│                  Vercel/Geist 暗色设计；AudioWorklet 采集 16k PCM      │
│                                                                      │
│  server          Express + TS（BFF + Agent harness）                 │
│    ├─ asr/       豆包 ASR 二进制协议封包/解包 + WS 代理                 │
│    ├─ agent/     可插拔 Agent 编排：provider / prompts / tools        │
│    └─ routes/    /ws/asr（WS 代理）、/api/analyze（SSE 流式）          │
│                                                                      │
│  packages/shared 前后端共享的消息协议类型                              │
└──────────────────────────────────────────────────────────────────────┘
```

### 数据链路

1. **语音转写**：浏览器麦克风 → AudioWorklet 重采样 16kHz/16bit/mono、200ms 分包 → `ws://…/ws/asr` → 服务端加鉴权头、按豆包二进制协议封帧（gzip）→ `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async`（双向流式优化版 + 二遍识别）→ 实时逐字上屏，`definite` 分句落为消息
2. **AI 分析**：点消息「搜索」→ `POST /api/analyze` → Agent harness 调豆包模型（OpenAI 兼容，`stream:true`）→ SSE 逐 token 回传 → 全屏结果页流式渲染 Markdown（可关闭、二次打开读缓存）

API Key 只存在于服务端 `.env`，前端零暴露。

## 运行

```bash
pnpm install
cp .env.example .env   # 填入你的火山引擎 ASR key 与方舟模型 key/接入点
pnpm dev               # 前端 :3000（代理到后端 :3001）
```

### .env 说明

| 变量 | 说明 |
| --- | --- |
| `VOLC_ASR_API_KEY` | 火山引擎新版控制台 API Key（豆包流式语音识别） |
| `VOLC_ASR_RESOURCE_ID` | `volc.seedasr.sauc.duration`（小时版）/ `…concurrent`（并发版） |
| `ARK_API_KEY` | 火山方舟 API Key |
| `ARK_MODEL_ID` | 推理接入点 ID（如 `ep-xxxx`，对应 Doubao-Seed-2.0-mini） |

## 验证工具

```bash
# 不依赖前端，直接用本地 wav 验证 ASR 协议与鉴权：
pnpm --filter @interview/server test:asr path/to/16k-mono.wav

# 流式分析接口冒烟：
curl -N -X POST localhost:3001/api/analyze -H 'Content-Type: application/json' \
  -d '{"question":"请介绍一下你自己"}'
```

## 扩展 Agent

`server/src/agent/` 是可插拔骨架：新增一个 Agent 只需一份 `AgentDefinition`（system prompt + 可选 tools + 模型），交给 `runAgent()` 即可获得流式输出与 tool-call 循环。现有的 `interview-analyst` 是第一个实例。

## 参考文档

- [豆包流式语音识别 WebSocket 协议](https://docs.volcengine.com/docs/6561/1354869)
- [火山方舟快速入门（OpenAI 兼容）](https://ark.volcengine.com/docs/82379/1399008)
