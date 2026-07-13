# fe\_mono AI Coding Harness 实践方案与亮点解读

# 一、它解决什么问题

fe\_mono 是一个 Rush \+ PNPM 管理的大型前端 Monorepo\(6 个 app \+ 10\+ library/package\)。当 AI Coding Agent\(Trae/Claude/Cursor 等\)进入这种仓库时,普遍会遇到四类问题:

1. **不认路**:不知道仓库结构、依赖方向、该用 rush 还是 pnpm,凭其他仓库经验瞎猜

2. **不守规**:破坏单向依赖、手改 lockfile、样式硬编码、绕过质量门禁

3. **不可控**:大任务中途断了接不上,交付流程各写各的

4. **会腐烂**:规则文档和代码演进脱节,skill 越积越多质量却没人管

Harness 工程的答案是:**把"如何在这个仓库里干活"本身做成一套可配置、可校验、可巡检的工程资产**,而不是散落的口头约定。

# 二、整体架构:四层模型

## 1\. 认知层 —— Agent 进仓库先读什么

- **分层 AGENTS\.md**:仓库级 `AGENTS.md` 定义全局认知\(仓库结构、Rush 操作规范、单向依赖约束、排障优先级\);每个 app/library 有自己的 scope 级 AGENTS\.md。查找规则是"**最近优先**":距离目标文件最近的 AGENTS\.md 是最高优先级约束,且明确"不要假设不同 app 的规则一样"

- **harness\.repo\.yaml**:仓库差异配置的单一事实源,声明了 docs 标准、14 个 scope 的注册表、skill 根目录、journeys 等。它是给"机器"读的契约,让巡检工具可以机检

- **docs/ 五大分区**:governance\(治理规则\)/ runtime\(运行时关系\)/ capabilities\(能力专题\)/ documents\(迭代过程文档\)/ harness\(巡检产物\),每个分区 README 只做导航,不做事实源

## 2\. 流程层 —— 覆盖"计划 → 实现 → 验证 → 交付"的 Skill 链

15 个 harness\-\* skill 按研发生命周期分工:

|阶段|Skill|职责|
|---|---|---|
|计划|harness\-task\-plan|复杂任务写自包含计划,支持中断恢复\(proposal → active → completed 生命周期\)|
|计划|harness\-prd|把模糊需求/设计稿规格化为可落地 PRD|
|计划|harness\-fe\-tech\-solution|PRD 落成前端技术方案:组件绑定、props、数据契约、下游生成 skill|
|门禁|harness\-style\-gate|约束高度滚动、颜色 token、间距尺寸,计划和实现阶段都生效|
|门禁|harness\-hook\-init|安装/修复提交前、推送前质量护栏|
|验证|harness\-verify\-loop|编排"构建/类型/lint/测试/E2E → 分析 → 修复 → 再验证"闭环,限定最大修复轮数|
|验证|harness\-e2e\-test|用 entry\.yaml 验收契约生成 Playwright/Midscene E2E 测试|
|验证|harness\-review\-gate|提交/MR 前独立审查,并验证审查发现|
|交付|harness\-one\-git|统一 add → commit → push → MR 三条路径,禁止 \-\-no\-verify|
|治理|harness\-doctor\-init/check/repair/patrol|Harness 资产从初始化、诊断、修复到周期巡检的完整闭环|
|治理|harness\-dead\-code\-cleanup|删除前证明全仓无引用,删除后目标构建验证|
|治理|harness\-debt\-gardener|扫描重复实现、状态散落、模型漂移等架构债|
|沉淀|harness\-practice\-export|判断仓库实践能否抽象进通用 Harness Dev Kit|

配套还有业务"样板间"skill\(fe\-mono\-list\-page / detail\-page / form\-page 等\),让 Agent 按标准范式生成列表页、详情页、表单页。

## 3\. 治理层 —— 让规则资产不腐烂

- **Doctor 三件套职责分离**:check 只读诊断、repair 只修 Harness 资产\(明确禁止改业务逻辑/API/依赖版本\)、patrol 编排"巡检 → 修复 → 复查 → 报告归档 → 可选 MR"

- **每周巡检报告**:归档在 docs/harness/patrol//,含 report\.md/meta\.json/evidence,index\.json 保留最近 4 次。健康地图从 7 个能力面打分:入口可发现性、Scope 覆盖、事实一致性、任务可执行性、Skill 有效性、维护可持续性、漂移风险\(近两次总分 92 → 95\)

- **Skill 质量可度量**:用 darwin\-8d 评分规约给每个 skill 打 8 维分\(boundaries/checkpoints/workflow/observedPerformance 等\),低分 skill 作为"Skill 债"进巡检报告,附具体改进建议

## 4\. 方法论层 —— 需求分级路由

不是每个需求都跑全流程,按规模匹配 skill 链路控制成本:

- **小需求**:读最近 AGENTS\.md → 改 → 最小验证 → one\-git 交付

- **中需求**:涉及页面/交互/hook/请求时,按风险补 e2e\-test、verify\-loop

- **大需求**\(跨模块/超 1 小时/高不确定性\):先 task\-plan,前端需求串联 PRD → 技术方案 → 样式门禁,完成后进 verify/review/delivery

- **周期治理**:hook 初始化、Doctor 巡检、实践导出只在新环境、主动诊断或周期节点跑

# 三、最值得借鉴的设计亮点

## 1\. Journeys:用"用户旅程"验证 Harness 是否真的可用

harness\.repo\.yaml 里声明了 required journeys\(修改 app 页面、修改共享库、API 下线、BAM 更新、本地调试、复杂任务规划等\),每个 journey 定义 entryPaths\(该读哪些文档\)、skillRoutes\(该走哪个 skill\)、checks\(能否回答关键问题,如"能否找到最近的 AGENTS\.md""能否说明单向依赖边界"\)。巡检时对 journey 做仿真,**验证的不是文档存在,而是 Agent 沿着文档真能把活干成**——这是从"写了规则"到"规则有效"的关键一步。

## 2\. 单一事实源 \+ 多端曝光的 Skill 适配器

Skill 只在 canonical root\(\.trae/skills\)维护一份,通过 symlink 曝光到 \.claude/\.cursor/\.agents/\.trae\-cn 等目录,多个 Agent IDE 共享同一套 skill 资产。巡检会校验 symlink、frontmatter 和引用资源完整性,避免多份拷贝漂移。

## 3\. 配置即契约,巡检可机检

harness\.repo\.yaml 用 schemaVersion 管理,scope 注册、必需文档、skill 根目录都是结构化声明。Doctor 巡检不是靠 LLM 自由发挥,而是拿配置逐项核对事实——"strict: true 的 required docs 缺一个就扣分"。**规则先结构化,才谈得上自动治理。**

## 4\. 产物边界与权限收敛

每个 skill 的"不能做什么"写得和"能做什么"一样清楚:Doctor 只能动 AGENTS/docs/skills/adapter,不得改业务逻辑和 lockfile;one\-git 只做 add/commit/push/MR,不做 rebase/reset;dead\-code\-cleanup 只删已证明不可达的闭包;临时产物进 \.harness\-doctor/scratch/ 不进 Git,正式巡检产物才随代码提交。**边界清晰是多 skill 协作不打架的前提。**

## 5\. E2E 验收契约化

harness\-e2e\-test 把"这个功能怎么算做完了"前置成 entry\.yaml 验收契约\(目标路由、登录态、起始状态、用户动作、最终断言\),不清楚就先问,再由契约生成 Playwright/Midscene 测试。产物分 contracts\(契约\)/ generated\(生成的 spec\)/ runs\(执行证据\),**把"自测清楚了吗"变成结构化门禁**。

## 6\. 过程文档与长期事实源分离

plan/spec/design/review 等迭代过程文档进 docs/documents/\(或模块内 documents/\),明确声明"过程文档不是长期事实源";迭代完成后稳定结论必须沉淀回 docs/ 或最近的 AGENTS\.md,代码变了就更新或删除过期文档。**避免了"旧 plan 变成代码行为唯一解释"的经典腐烂路径。**

## 7\. 计划自包含、可中断恢复

task\-plan 要求计划包含目标、仓库事实、范围边界、阶段进度、每阶段验证方式和恢复点,标准是"**下一个 Agent 只靠文件就能接上**"。这把 Agent 会话的易失性变成了工程上可管理的问题。

# 四、建议学习路径

5. 先读根 `AGENTS.md`:体会"给 Agent 当新同事写的入职手册"该长什么样\(仓库认知 → 操作规范 → 执行路由表 → 分层查找规则\)

6. 再读 `harness.repo.yaml`:看规则如何结构化成机器可校验的契约,重点看 scopes、skills、journeys 三段

7. 读 `docs/harness/README.md`:理解 skill 分工、需求分级和产物边界

8. 挑 2\~3 个 skill 精读:建议 harness\-task\-plan\(计划范式\)、harness\-verify\-loop\(验证闭环\)、harness\-doctor\-patrol\(治理编排\)

9. 看一份真实巡检报告 `docs/harness/patrol/2026-06-22/report.md`:理解健康地图 7 能力面和 Skill 债的度量方式

10. 迁移到自己仓库时,从最小集起步:一份 AGENTS\.md \+ hook 门禁 \+ one\-git 交付,再逐步补 doctor 巡检和 journeys

