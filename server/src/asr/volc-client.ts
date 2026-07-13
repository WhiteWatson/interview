/**
 * 与火山「豆包流式语音识别」服务的单次会话（双向流式优化版 bigmodel_async）。
 * 负责：握手鉴权头、full client request、音频封包、服务端帧解析。
 */
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type { AsrResultPayload } from '@interview/shared';
import { env } from '../config/env.js';
import {
  buildAudioRequest,
  buildFullClientRequest,
  MSG_FULL_SERVER_RESPONSE,
  MSG_SERVER_ERROR,
  parseServerFrame,
} from './protocol.js';

export interface VolcAsrCallbacks {
  /** 握手完成、full client request 已发出，可以开始送音频 */
  onReady: () => void;
  onResult: (payload: AsrResultPayload, isFinal: boolean) => void;
  onError: (message: string, code?: number) => void;
  onClose: () => void;
}

export class VolcAsrSession {
  private ws: WebSocket;
  private seq = 1;
  private closed = false;
  readonly logid: string | undefined;

  constructor(private cb: VolcAsrCallbacks) {
    const connectId = randomUUID();
    this.ws = new WebSocket(env.asr.wsUrl, {
      headers: {
        // 新版控制台鉴权：仅需 X-Api-Key + Resource-Id
        'X-Api-Key': env.asr.apiKey,
        'X-Api-Resource-Id': env.asr.resourceId,
        'X-Api-Request-Id': randomUUID(),
        'X-Api-Connect-Id': connectId,
      },
    });

    this.ws.on('upgrade', (res) => {
      const logid = res.headers['x-tt-logid'];
      // logid 是官方排错线索，务必记录
      console.log(`[asr] upstream connected, X-Tt-Logid=${logid}`);
    });

    this.ws.on('open', () => {
      this.ws.send(
        buildFullClientRequest(
          {
            user: { uid: 'interview-copilot' },
            audio: {
              format: 'pcm',
              codec: 'raw',
              rate: 16000,
              bits: 16,
              channel: 1,
            },
            request: {
              model_name: 'bigmodel',
              enable_punc: true,
              enable_itn: true,
              // 二遍识别：实时逐字上屏（快）+ 分句后用非流式重识别（准），
              // definite=true 的分句即为最终结果
              enable_nonstream: true,
              show_utterances: true,
              result_type: 'full',
            },
          },
          this.seq,
        ),
      );
      this.cb.onReady();
    });

    this.ws.on('message', (data: Buffer, isBinary) => {
      if (!isBinary && !Buffer.isBuffer(data)) return;
      try {
        const frame = parseServerFrame(Buffer.isBuffer(data) ? data : Buffer.from(data));
        if (frame.messageType === MSG_SERVER_ERROR) {
          console.error(`[asr] server error ${frame.errorCode}: ${frame.errorMessage}`);
          this.cb.onError(frame.errorMessage ?? 'ASR 服务错误', frame.errorCode);
          return;
        }
        if (frame.messageType === MSG_FULL_SERVER_RESPONSE && frame.payload) {
          this.cb.onResult(frame.payload as AsrResultPayload, frame.isFinal);
        }
      } catch (err) {
        console.error('[asr] failed to parse server frame', err);
      }
    });

    this.ws.on('error', (err) => {
      console.error('[asr] upstream error:', err.message);
      this.cb.onError(err.message);
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[asr] upstream closed code=${code} reason=${reason.toString()}`);
      this.closed = true;
      this.cb.onClose();
    });
  }

  /** 发送一包 PCM 音频（16k/16bit/mono） */
  sendAudio(chunk: Buffer): void {
    if (this.closed || this.ws.readyState !== WebSocket.OPEN) return;
    this.seq += 1;
    this.ws.send(buildAudioRequest(chunk, this.seq));
  }

  /** 结束输入：发送负 seq 的最后一包（空音频），等待服务端吐完最终结果 */
  end(): void {
    if (this.closed || this.ws.readyState !== WebSocket.OPEN) return;
    this.seq += 1;
    this.ws.send(buildAudioRequest(Buffer.alloc(0), this.seq, true));
  }

  close(): void {
    this.closed = true;
    if (
      this.ws.readyState === WebSocket.OPEN ||
      this.ws.readyState === WebSocket.CONNECTING
    ) {
      this.ws.close();
    }
  }
}
