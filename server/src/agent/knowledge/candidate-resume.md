# resume

## 个人简介

前端开发工程师，近两年深度参与 Seed 机器学习平台\(Models / Evals / Data\)核心模块建设，覆盖业务前端、组件物料生态、BFF 服务全链路。

## 核心优势

1. **大型 AI/ML 平台前端经验**: 主导模型资产\(ModelCard\)、评估\(Evals/Arena\)等核心模块从重构到迭代的完整过程，熟悉模型训练—评估—发布的业务全流程。

2. **物料生态与工程化建设能力**:从 0 到 1 建设 aml\-design/cli、AWorkflow 编排引擎等高阶物料，有物料市场落地与最佳实践沉淀经验。

3. **全栈\(BFF\)能力与性能优化**:独立完成多个 BFF 重构与多环境迁移，擅长使用 BFF 优化系统性能。

4. **AI 工程化\(Coding Harness\)实践**:参与大型前端 Monorepo 的 AI Coding Harness 体系建设与落地，熟悉 Agent 规则资产、Skill 编排、质量门禁与验证闭环的完整方案。

## 重点项目经历

### Seed ModelCard 模型资产平台

- 主导 ModelCard 2\.0 重构:重构创建表单、实现内容推荐与一键创建，统一模型资产入口，显著降低创建成本

- 支持跨洋/多机房同步，为模型资产全球合规夯实基础;完成量化与部署解耦、临时部署等能力建设

- 打通训练数据质检\&查重、ckpt 管理、自动评估、血缘记录等平台核心能力

### Seed 评估平台 Evals / Arena\(2024–2025\)

- 重构 Arena 任务抓取链路，统一评估任务创建入口，适配 Evals 3\.0 架构

- 建设任务可观测性:运行 Timeline 可视化、Agent 任务"题目级"观测粒度，大幅提升问题定位与回溯效率

- 落地数据复用/失败用例重跑、结果指标可配置、Exercise 结构化配置等能力，持续提升评估迭代效率

### 前端物料与设计生态 AML\-Design\(2025\)

- 开发 aml\-design/cli，标准化前端物料项目的创建、开发与发布流程

- 设计实现 AWorkflow 前端编排引擎、AMarkdown 增强渲染\(表格增强/代码交互/图表直出\)等高阶物料

- 开发 ACard 核心组件支撑新控制面 UI 改造;沉淀图标库最佳实践，解决历史渲染异常问题

### BFF 与公共服务建设\(2024–2025\)

- Bernard Machine/Cluster BFF 重构:Machine 页面加载 2min → 5s，Cluster 筛选场景 7min → 1s

- 完成 mongo → bytedoc 迁移及 CN/US/SG/BOE 多环境部署;四地机房配置迁移 TCC，降低维护与扩容成本

- 建设 HDFS 文件浏览器、编辑器 LSP 智能提示与实时校验、统一资源选择组件等公共模块

### Merlin 平台国际化与多区域部署

- 参与 Merlin 平台国际化建设，支撑平台在 CN/US/SG 等多区域的独立部署与合规运行

- 打通不同区域的开发链路，统一跨区域开发、构建与发布流程；完成依赖治理，保障各区域依赖合规与构建产物一致性

- 建设平台翻译流程，推动界面文案多语言化，拉齐多区域用户体验

### AI Coding Harness 工程\(fe\_mono\)

- 参与在 Rush \+ PNPM 大型前端 Monorepo 中落地 AI Coding Harness 体系:以分层 AGENTS\.md\(仓库级 \+ 应用/库级 Scope\)与 harness\.repo\.yaml 作为 Agent 认知入口和仓库差异配置，统一约束 Agent 行动边界\(依赖方向、命令选择、文档结构\)

- 共建覆盖研发全流程的 Harness Skill 家族\(15\+\):需求计划\(task\-plan / PRD 规格化 / 前端技术方案 / 样式门禁\)→ 验证闭环\(verify\-loop 构建/lint/测试/E2E 自动修复循环、E2E 契约测试、review\-gate 独立审查\)→ 交付\(one\-git 统一提交与 MR 流程\)

- 建立 Agent 资产治理机制:Harness Doctor 巡检/修复/周报体系,配合死代码清理、技术债扫描等治理 Skill，并沉淀"需求分级路由"实践\(按小/中/大需求匹配 Skill 链路\)，保障规则资产与代码演进持续同步

## 其他产出

- Data 方向:数据送标、Release 版本管理\(发版/合版/回滚/diff\)、Pretrain Debug 模块开发上线

- 完成 Seed/Models、PE 实验模块微前端迁移;

