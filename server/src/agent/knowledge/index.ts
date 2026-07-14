/**
 * 候选人背景知识库：启动时读取本目录下的 Markdown 资料，
 * 组装成注入 Agent system prompt 的知识块。
 *
 * 新增资料 = 往本目录丢一份 .md 并在 projectDocs 注册，无需改其它代码。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function load(file: string): string {
  return readFileSync(join(here, file), 'utf8').trim();
}

export interface KnowledgeDoc {
  /** 展示给模型的资料标题 */
  title: string;
  body: string;
}

/** 候选人简历（始终相关，代表"候选人是谁"） */
export const candidateResume = load('candidate-resume.md');

/** 项目深度资料：面试官问到对应项目时结合作答 */
export const projectDocs: KnowledgeDoc[] = [
  {
    title: 'AI Coding Harness 工程（fe_mono，Rush + PNPM 大型前端 Monorepo）',
    body: load('project-fe-mono-harness.md'),
  },
  {
    title: 'Mojo 前端应用架构（apps/mojo，实时 agent chat 微前端）',
    body: load('project-mojo-architecture.md'),
  },
  {
    title: 'AML Design 组件与 AI UI 生态架构（组件库 / 浏览器编译器 / AI 动态 UI 沙箱 / 轨迹库 / 文档站）',
    body: load('project-aml-design.md'),
  },
];

/** 组装成一整块知识文本，注入到 system prompt 尾部 */
export function buildKnowledgeBlock(): string {
  const projects = projectDocs
    .map((d) => `## 项目资料：${d.title}\n\n${d.body}`)
    .join('\n\n---\n\n');
  return `# 候选人简历\n\n${candidateResume}\n\n---\n\n${projects}`;
}
