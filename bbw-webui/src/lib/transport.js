// WebHID transport; supports legacy 508B and Gale 2 456B read-only profiles.
import { chunkPayload, dechunkFrames, READ_QUERY, isGale2FrameSet, GALE2_PAYLOAD_SIZE } from "../../../bbw-protocol/src/chunks.js";
export { chunkPayload, dechunkFrames, READ_QUERY };
const MARKER_READ = 0xd6;
const CONFIG_USAGE_PAGES = new Set([0xff7a, 0xffab]);
const READ_TIMEOUT_MS = 8000;
export class HidTransport {
  constructor() { this.config = null; this.gamepad = null; this.queue = []; this.waiters = []; this.gamepadCbs = []; this.isReading = false; this.usagePage = null; }
  get connected() { return !!this.config; }
  onGamepad(cb) { this.gamepadCbs.push(cb); return () => { const i = this.gamepadCbs.indexOf(cb); if (i >= 0) this.gamepadCbs.splice(i, 1); }; }
  isGamepadDev(dev) { return dev.collections.some((c) => (c.usagePage === 1 && c.usage === 5) || c.inputReports.some((r) => r.reportLength === 15)); }
  static enumerateDevices(devices) { return devices.map((d, idx) => ({ idx, product: d.productName, collections: d.collections.map((c) => ({ up: `0x${c.usagePage.toString(16)}`, usage: `0x${(c.usage ?? 0).toString(16)}`, in: c.inputReports.map((r) => r.reportLength), out: c.outputReports.map((r) => r.reportLength) })) })); }
  async connect() {
    if (!("hid" in navigator)) throw new Error("浏览器不支持 WebHID");
    const devices = await navigator.hid.requestDevice({ filters: [] });
    const config = devices.find((d) => d.collections.some((c) => CONFIG_USAGE_PAGES.has(c.usagePage) && c.outputReports.length));
    const fallback = config ? null : devices.find((d) => d.collections.some((c) => c.outputReports.length));
    const selected = config || fallback;
    if (!selected) throw new Error("未找到配置通道");
    const coll = selected.collections.find((c) => CONFIG_USAGE_PAGES.has(c.usagePage) && c.outputReports.length);
    this.usagePage = coll?.usagePage ?? null;
    await selected.open(); this.config = selected; this.queue = []; this.waiters = []; this.gamepadCbs = [];
    selected.addEventListener("inputreport", (e) => {
      const b = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
      if (this.gamepad === null && b[0] !== 0xa4) { this.gamepadCbs.forEach((cb) => cb(b)); return; }
      const w = this.waiters.shift(); if (w) w(b); else this.queue.push(b);
    });
    const gamepad = devices.find((d) => this.isGamepadDev(d) && d !== selected);
    if (gamepad) { try { await gamepad.open(); this.gamepad = gamepad; gamepad.addEventListener("inputreport", (e) => { const b = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength); this.gamepadCbs.forEach((cb) => cb(b)); }); } catch { this.gamepad = null; } }
    return { config: selected, gamepad: this.gamepad, devices: HidTransport.enumerateDevices(devices), usagePage: this.usagePage };
  }
  disconnect() { if (this.config) { try { this.config.close(); } catch {} this.config = null; } if (this.gamepad) { try { this.gamepad.close(); } catch {} this.gamepad = null; } }
  nextInput(timeout = READ_TIMEOUT_MS) { if (this.queue.length) return Promise.resolve(this.queue.shift()); return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("等待输入超时")), timeout); this.waiters.push((b) => { clearTimeout(t); res(b); }); }); }
  async readFrames() {
    if (this.isReading) throw new Error("读取正在进行中"); if (!this.config) throw new Error("设备未连接"); this.isReading = true;
    const frames = new Map();
    try {
      this.queue = []; await this.config.sendReport(0, READ_QUERY);
      const deadline = Date.now() + READ_TIMEOUT_MS; let gale2 = false;
      while (Date.now() < deadline) {
        let b; try { b = await this.nextInput(Math.max(1, deadline - Date.now())); } catch { break; }
        if (b.length < 64 || b[0] !== 0xa4 || b[2] !== MARKER_READ) continue;
        const seq = b[3]; if (seq < 1 || seq > 9) continue;
        if (!frames.has(seq)) frames.set(seq, b);
        if (frames.size === 8 && frames.get(8)?.[1] === 0x30) {
          const ordered = Array.from({ length: 8 }, (_, i) => frames.get(i + 1));
          if (ordered.every(Boolean)) {
            const data = dechunkFrames(ordered, { marker: MARKER_READ, expectedLength: GALE2_PAYLOAD_SIZE });
            gale2 = true; this.lastReadIsGale2 = true; return data;
          }
        }
        if (frames.size === 9 && Array.from({ length: 9 }, (_, i) => frames.has(i + 1)).every(Boolean)) {
          this.lastReadIsGale2 = false;
          return dechunkFrames(Array.from({ length: 9 }, (_, i) => frames.get(i + 1)), { marker: MARKER_READ, expectedLength: 508 });
        }
      }
      throw new Error(`配置帧读取超时;已收到 [${[...frames.keys()].sort((a,b)=>a-b).join(", ")}]`);
    } finally { this.isReading = false; }
  }
  async readProfile() { const payload = await this.readFrames(); if (payload.length !== 456 && payload.length !== 508) throw new Error(`数据流长度异常 ${payload.length}`); return payload; }
  async writeProfile(payload) { if (this.lastReadIsGale2 || this.usagePage === 0xffab) throw new Error("烈风2安全锁定：只读解析模式，不支持写入"); const frames = chunkPayload(payload, 0xd7); for (const f of frames) await this.config.sendReport(0, f); }
}
