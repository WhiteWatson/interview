/**
 * ASR 协议本地验证：读取 16k/16bit/mono wav，按 200ms 分包发给豆包，打印识别结果。
 * 用法：pnpm --filter @interview/server test:asr <path-to-wav>
 */
import { readFileSync } from 'node:fs';
import { VolcAsrSession } from '../src/asr/volc-client.js';

const wavPath = process.argv[2];
if (!wavPath) {
  console.error('用法: tsx scripts/test-asr.ts <path-to-16k-mono-wav>');
  process.exit(1);
}

/** 提取 wav 的 data chunk（假定 PCM s16le；采样率由调用方保证 16k） */
function extractPcm(buf: Buffer): Buffer {
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('不是 wav 文件');
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'data') return buf.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  throw new Error('wav 中没有 data chunk');
}

const pcm = extractPcm(readFileSync(wavPath));
const CHUNK = 16000 * 2 * 0.2; // 200ms @16k s16le mono = 6400B
console.log(`PCM ${pcm.length} bytes (~${(pcm.length / 32000).toFixed(1)}s)`);

const session = new VolcAsrSession({
  onReady: async () => {
    console.log('[test] ready, sending audio...');
    for (let i = 0; i < pcm.length; i += CHUNK) {
      session.sendAudio(pcm.subarray(i, i + CHUNK));
      await new Promise((r) => setTimeout(r, 100)); // 模拟实时发包间隔
    }
    session.end();
  },
  onResult: (payload, isFinal) => {
    const utts = payload.result?.utterances
      ?.map((u) => `${u.definite ? '[定]' : '[临]'} ${u.text}`)
      .join(' | ');
    console.log(`[result${isFinal ? '·final' : ''}] text="${payload.result?.text ?? ''}" ${utts ?? ''}`);
    if (isFinal) {
      console.log('[test] done ✓');
      session.close();
      process.exit(0);
    }
  },
  onError: (message, code) => {
    console.error(`[test] error code=${code}: ${message}`);
    process.exit(1);
  },
  onClose: () => console.log('[test] upstream closed'),
});

setTimeout(() => {
  console.error('[test] timeout (30s)');
  process.exit(1);
}, 30_000);
