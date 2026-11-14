/**
 * HID configuration framing helpers.
 * Supports the legacy 508B write stream and the Gale 2 456B read padset.
 */
import { PAYLOAD_SIZE } from "./write-format.js";

export const REPORT_SIZE = 64;
export const FRAME_HEADER = 4;
export const BLOCK_FULL = 59;
export const BLOCK_LAST = 36;
export const CHUNK_COUNT = 9;
export const PAYLOAD_SIZE_VERIFIED = BLOCK_FULL * 8 + BLOCK_LAST;
export const GALE2_FRAME_COUNT = 8;
export const GALE2_PAYLOAD_SIZE = 456;
export const MAGIC_WRITE = 0xa4;
export const MARKER_WRITE = 0xd7;
export const MARKER_READ = 0xd6;

export const READ_QUERY = (() => {
  const f = new Uint8Array(REPORT_SIZE);
  f[0] = 0xa5; f[1] = 0x04; f[2] = 0xd6; f[3] = 0x7f;
  return f;
})();

export function computeFrameChecksum(frame, checkPos) {
  let sum = 0;
  for (let i = 0; i < checkPos; i++) sum = (sum + frame[i]) & 0xff;
  return sum;
}

// Length byte counts header + data + checksum; checksum is at length - 1.
export function checkPosOf(frame) {
  return frame[1] - 1;
}

export function buildFrame(marker, seq, block) {
  const frame = new Uint8Array(REPORT_SIZE);
  frame[0] = MAGIC_WRITE; frame[1] = FRAME_HEADER + block.length + 1;
  frame[2] = marker; frame[3] = seq; frame.set(block, FRAME_HEADER);
  const pos = checkPosOf(frame);
  frame[pos] = computeFrameChecksum(frame, pos);
  return frame;
}

export function chunkPayload(payload, marker = MARKER_WRITE) {
  const reports = [];
  let offset = 0;
  for (let s = 1; s <= CHUNK_COUNT; s++) {
    const cap = s === CHUNK_COUNT ? BLOCK_LAST : BLOCK_FULL;
    const block = new Uint8Array(cap);
    const len = Math.max(0, Math.min(payload.length - offset, cap));
    if (len) block.set(payload.subarray(offset, offset + len));
    reports.push(buildFrame(marker, s, block));
    offset += len;
  }
  return reports;
}

/** Dechunk using each frame's valid-length byte; optionally verify checksum and length. */
export function dechunkFrames(frames, opts = {}) {
  const out = [];
  for (const f of frames) {
    if (!f || f.length < REPORT_SIZE || f[0] !== MAGIC_WRITE) {
      if (opts.validate) throw new Error("帧格式错误");
      continue;
    }
    if (opts.marker !== undefined && f[2] !== opts.marker && opts.validate) throw new Error("帧 marker 错误");
    const pos = checkPosOf(f);
    const len = f[1] - FRAME_HEADER - 1;
    if (len < 0 || pos >= f.length || FRAME_HEADER + len > pos) throw new Error("帧长度无效");
    if (opts.validate && computeFrameChecksum(f, pos) !== f[pos]) throw new Error(`帧校验失败(seq=${f[3]})`);
    out.push(...f.subarray(FRAME_HEADER, FRAME_HEADER + len));
  }
  const payload = new Uint8Array(out);
  if (opts.expectedLength !== undefined && payload.length !== opts.expectedLength) {
    throw new Error(`数据流长度异常:${payload.length} != ${opts.expectedLength}`);
  }
  if (opts.validate && opts.expectedLength === undefined && payload.length !== PAYLOAD_SIZE) {
    throw new Error(`数据流长度异常:${payload.length} != ${PAYLOAD_SIZE}`);
  }
  return payload;
}

export function isGale2FrameSet(frames) {
  return frames.length === GALE2_FRAME_COUNT
    && frames.every((f, i) => f?.[3] === i + 1)
    && frames[7]?.[1] === 0x30;
}

export function chunkPadset(padset, opts = {}) {
  const payload = new Uint8Array(PAYLOAD_SIZE);
  payload.set(padset.subarray(0, Math.min(padset.length, PAYLOAD_SIZE)));
  return chunkPayload(payload, opts.marker ?? MARKER_WRITE);
}
export function dechunkReports(reports) { return dechunkFrames(reports); }
export const computeCrc = computeFrameChecksum;
export const CMD = { QUERY_STATUS: 0x04, QUERY_PROFILE: 0x0c };
