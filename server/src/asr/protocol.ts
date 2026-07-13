/**
 * 豆包流式语音识别 WebSocket 二进制协议
 * 文档：https://docs.volcengine.com/docs/6561/1354869
 *
 * 帧结构：4 字节 header + [4 字节 sequence] + 4 字节 payload size + payload
 * 整数一律大端（Big Endian）。
 *
 * header:
 *   byte0 = (protocol version << 4) | (header size / 4)      => 0x11
 *   byte1 = (message type << 4)     | message type flags
 *   byte2 = (serialization << 4)    | compression
 *   byte3 = reserved (0x00)
 */
import { gzipSync, gunzipSync } from 'node:zlib';

// message type
export const MSG_FULL_CLIENT_REQUEST = 0b0001;
export const MSG_AUDIO_ONLY_REQUEST = 0b0010;
export const MSG_FULL_SERVER_RESPONSE = 0b1001;
export const MSG_SERVER_ERROR = 0b1111;

// message type specific flags
const FLAG_POSITIVE_SEQ = 0b0001; // header 后 4 字节为正 sequence
const FLAG_NEGATIVE_SEQ = 0b0011; // header 后 4 字节为负 sequence（最后一包）
const FLAG_LAST_NO_SEQ = 0b0010; // 无 sequence，仅标记最后一包

// serialization / compression
const SERIALIZATION_NONE = 0b0000;
const SERIALIZATION_JSON = 0b0001;
const COMPRESSION_GZIP = 0b0001;

function buildFrame(opts: {
  messageType: number;
  flags: number;
  serialization: number;
  compression: number;
  sequence?: number;
  payload: Buffer;
}): Buffer {
  const { messageType, flags, serialization, compression, sequence, payload } = opts;
  const hasSeq = sequence !== undefined;
  const frame = Buffer.alloc(4 + (hasSeq ? 4 : 0) + 4 + payload.length);
  frame[0] = 0x11; // version 1, header size 4B
  frame[1] = (messageType << 4) | flags;
  frame[2] = (serialization << 4) | compression;
  frame[3] = 0x00;
  let offset = 4;
  if (hasSeq) {
    frame.writeInt32BE(sequence, offset);
    offset += 4;
  }
  frame.writeUInt32BE(payload.length, offset);
  payload.copy(frame, offset + 4);
  return frame;
}

/** 建连后第一包：full client request（JSON + gzip，seq=1） */
export function buildFullClientRequest(params: object, sequence = 1): Buffer {
  return buildFrame({
    messageType: MSG_FULL_CLIENT_REQUEST,
    flags: FLAG_POSITIVE_SEQ,
    serialization: SERIALIZATION_JSON,
    compression: COMPRESSION_GZIP,
    sequence,
    payload: gzipSync(Buffer.from(JSON.stringify(params))),
  });
}

/** 音频包（raw PCM + gzip）。isLast 时 sequence 取负值标记最后一包。 */
export function buildAudioRequest(audio: Buffer, sequence: number, isLast = false): Buffer {
  return buildFrame({
    messageType: MSG_AUDIO_ONLY_REQUEST,
    flags: isLast ? FLAG_NEGATIVE_SEQ : FLAG_POSITIVE_SEQ,
    serialization: SERIALIZATION_NONE,
    compression: COMPRESSION_GZIP,
    sequence: isLast ? -Math.abs(sequence) : sequence,
    payload: gzipSync(audio),
  });
}

export interface ParsedServerFrame {
  messageType: number;
  /** 是否为最后一包（负 seq 或 last 标记） */
  isFinal: boolean;
  sequence?: number;
  /** full server response：解析后的 JSON */
  payload?: unknown;
  /** error frame */
  errorCode?: number;
  errorMessage?: string;
}

/** 解析服务端下发帧（full server response / error） */
export function parseServerFrame(data: Buffer): ParsedServerFrame {
  const headerSize = (data[0] & 0x0f) * 4;
  const messageType = data[1] >> 4;
  const flags = data[1] & 0x0f;
  const compression = data[2] & 0x0f;
  let offset = headerSize;

  const isFinal = flags === FLAG_NEGATIVE_SEQ || flags === FLAG_LAST_NO_SEQ;

  if (messageType === MSG_SERVER_ERROR) {
    const errorCode = data.readUInt32BE(offset);
    const size = data.readUInt32BE(offset + 4);
    let body = data.subarray(offset + 8, offset + 8 + size);
    if (compression === COMPRESSION_GZIP) body = gunzipSync(body);
    return { messageType, isFinal: true, errorCode, errorMessage: body.toString('utf8') };
  }

  let sequence: number | undefined;
  if (flags === FLAG_POSITIVE_SEQ || flags === FLAG_NEGATIVE_SEQ) {
    sequence = data.readInt32BE(offset);
    offset += 4;
  }

  const size = data.readUInt32BE(offset);
  let body = data.subarray(offset + 4, offset + 4 + size);
  if (compression === COMPRESSION_GZIP && body.length > 0) body = gunzipSync(body);

  let payload: unknown;
  if (body.length > 0) {
    try {
      payload = JSON.parse(body.toString('utf8'));
    } catch {
      payload = undefined;
    }
  }
  return { messageType, isFinal, sequence, payload };
}
