/**
 * 浏览器侧 ASR 客户端：麦克风 → AudioWorklet(16k PCM) → /ws/asr → 转写结果进 store。
 */
import type { AsrServerMessage } from '@interview/shared';
import { useAppStore } from '@/store';

interface ActiveSession {
  ws: WebSocket;
  audioContext: AudioContext;
  mediaStream: MediaStream;
}

let active: ActiveSession | null = null;

export async function startRecording(): Promise<void> {
  const store = useAppStore.getState();
  if (active) return;
  store.newSession();
  store.setStatus('connecting');

  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });

    // 优先让 AudioContext 直接跑 16k（Chrome/Safari 均支持），worklet 内兜底重采样
    const audioContext = new AudioContext({ sampleRate: 16000 });
    await audioContext.audioWorklet.addModule('/pcm-worklet.js');

    const source = audioContext.createMediaStreamSource(mediaStream);
    const worklet = new AudioWorkletNode(audioContext, 'pcm-processor');
    source.connect(worklet);
    worklet.connect(audioContext.destination); // 保持图运行（worklet 无输出内容）

    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${location.host}/ws/asr`);
    ws.binaryType = 'arraybuffer';

    worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(event.data);
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      const msg = JSON.parse(event.data) as AsrServerMessage;
      const s = useAppStore.getState();
      switch (msg.type) {
        case 'ready':
          s.setStatus('recording');
          break;
        case 'result':
          s.applyAsrResult(msg.payload);
          break;
        case 'error':
          s.setAsrError(`语音识别出错：${msg.message}${msg.code ? ` (${msg.code})` : ''}`);
          void stopRecording();
          break;
        case 'closed':
          break;
      }
    };

    ws.onclose = () => {
      cleanup();
      const s = useAppStore.getState();
      s.setStatus('idle');
    };

    ws.onerror = () => {
      useAppStore.getState().setAsrError('无法连接语音识别服务，请确认后端已启动');
    };

    active = { ws, audioContext, mediaStream };
  } catch (err) {
    cleanup();
    store.setStatus('idle');
    store.setAsrError(
      err instanceof DOMException && err.name === 'NotAllowedError'
        ? '麦克风权限被拒绝，请在浏览器设置中允许访问麦克风'
        : `启动录音失败：${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function stopRecording(): Promise<void> {
  if (!active) return;
  const { ws } = active;
  useAppStore.getState().setStatus('stopping');
  stopAudioOnly();
  if (ws.readyState === WebSocket.OPEN) {
    // 通知服务端发最后一包；服务端回传最终结果后会关闭连接（触发 onclose → idle）
    ws.send(JSON.stringify({ type: 'end' }));
  } else {
    ws.close();
  }
}

/** 只停采集，不关 ws（等最终识别结果回来） */
function stopAudioOnly(): void {
  if (!active) return;
  active.mediaStream.getTracks().forEach((t) => t.stop());
  void active.audioContext.close().catch(() => {});
}

function cleanup(): void {
  if (!active) return;
  stopAudioOnly();
  if (active.ws.readyState === WebSocket.OPEN || active.ws.readyState === WebSocket.CONNECTING) {
    active.ws.close();
  }
  active = null;
}
