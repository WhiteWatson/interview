/**
 * PCM 采集 worklet：把输入音频（context 采样率）线性重采样到 16kHz、
 * 转 Int16，攒满 200ms（3200 采样点）后 postMessage 给主线程。
 */
const TARGET_RATE = 16000;
const CHUNK_SAMPLES = TARGET_RATE * 0.2; // 200ms

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE; // sampleRate 为 worklet 全局（context 实际采样率）
    this.pendingFloat = new Float32Array(0);
    this.outBuffer = new Int16Array(CHUNK_SAMPLES);
    this.outLength = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel || channel.length === 0) return true;

    // 追加到待重采样缓冲
    const merged = new Float32Array(this.pendingFloat.length + channel.length);
    merged.set(this.pendingFloat, 0);
    merged.set(channel, this.pendingFloat.length);

    // 线性插值重采样（ratio=1 时等价于直通）
    const outCount = Math.floor((merged.length - 1) / this.ratio);
    for (let i = 0; i < outCount; i++) {
      const pos = i * this.ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const sample = merged[idx] * (1 - frac) + merged[idx + 1] * frac;
      const clamped = Math.max(-1, Math.min(1, sample));
      this.outBuffer[this.outLength++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      if (this.outLength === CHUNK_SAMPLES) {
        const chunk = this.outBuffer.slice();
        this.port.postMessage(chunk.buffer, [chunk.buffer]);
        this.outLength = 0;
      }
    }
    // 保留未消费的尾部，保证重采样连续
    this.pendingFloat = merged.slice(Math.floor(outCount * this.ratio));
    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
