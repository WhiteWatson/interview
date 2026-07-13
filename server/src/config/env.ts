import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// .env 位于仓库根目录（server/ 的上一级），与启动时的 cwd 无关
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: resolve(repoRoot, '.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}，请检查仓库根目录的 .env（参考 .env.example）`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),

  asr: {
    apiKey: required('VOLC_ASR_API_KEY'),
    resourceId: process.env.VOLC_ASR_RESOURCE_ID ?? 'volc.seedasr.sauc.duration',
    wsUrl:
      process.env.VOLC_ASR_WS_URL ??
      'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async',
  },

  ark: {
    apiKey: required('ARK_API_KEY'),
    baseUrl: process.env.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3',
    modelId: required('ARK_MODEL_ID'),
  },
} as const;
