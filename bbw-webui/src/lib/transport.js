// WebHID 传输层:MI_02 供应商主配置通道(65B 报告 = 1B ID + 64B 载荷)
// 分帧/合帧复用 bbw-protocol 的 chunks.js
import { chunkPayload, dechunkFrames, READ_QUERY } from "../../../bbw-protocol/src/chunks.js";

export { chunkPayload, dechunkFrames, READ_QUERY };

const MARKER_READ = 0xd6;

export class HidTransport {
  constructor() {
    this.config = null;
    this.gamepad = null;
    this.queue = [];
    this.waiters = [];
    this.gamepadCbs = [];
  }

  get connected() { return !!this.config; }

  onGamepad(cb) {
    this.gamepadCbs.push(cb);
    return () => {
      const i = this.gamepadCbs.indexOf(cb);
      if (i >= 0) this.gamepadCbs.splice(i, 1);
    };
  }

  isGamepadDev(dev) {
    return dev.collections.some((c) =>
      (c.usagePage === 0x01 && c.usage === 0x05) || c.inputReports.some((r) => r.reportLength === 15));
  }

  static enumerateDevices(devices) {
    return devices.map((d, idx) => ({
      idx,
      product: d.productName,
      collections: d.collections.map((c) => ({
        up: "0x" + c.usagePage.toString(16),
        usage: "0x" + (c.usage ?? 0).toString(16),
        in: c.inputReports.map((r) => r.reportLength),
        out: c.outputReports.map((r) => r.reportLength),
      })),
    }));
  }

  async connect() {
    if (!("hid" in navigator)) throw new Error("浏览器不支持 WebHID");
    let devices;
    try {
      // Each filter has at least one matching criterion; OR across these entries.
      // Covers known controller vendors plus generic gamepad/configuration usages.
      devices = await navigator.hid.requestDevice({
        filters: [
          { vendorId: 0x413d },
          { vendorId: 0xe2b7 },
          { vendorId: 0x045e },
          { usagePage: 0x01, usage: 0x05 },
          { usagePage: 0xff7a },
        ],
      });
    } catch (error) {
      console.error("WebHID device picker failed:", error);
      throw new Error(`打开 HID 设备选择器失败: ${error?.message || error}`);
    }
    const diagnostics = HidTransport.enumerateDevices(devices);
    console.info("WebHID devices selected (usage pages and reports):", diagnostics);
    const config = devices.find((d) =>
      d.collections.some((c) => c.usagePage === 0xff7a && c.outputReports.length > 0));
    const fallback = config ? null : devices.find((d) =>
      d.collections.some((c) => c.outputReports.length > 0));
    const selectedConfig = config || fallback;
    if (!config && fallback) {
      console.warn("No MI_02 (usagePage 0xFF7A) found; trying selected output-report device:",
        HidTransport.enumerateDevices([fallback]));
    }
    if (!selectedConfig) {
      console.error("No selected device has an output report. Selected device collections:", diagnostics);
      throw new Error("未找到带输出报告的配置通道;设备集合信息已记录到控制台");
    }
    const gamepad = devices.find((d) => this.isGamepadDev(d) && d !== selectedConfig);
    await selectedConfig.open();
    this.config = selectedConfig;
    this.queue = [];
    this.waiters = [];
    this.gamepadCbs = [];
    this.devicesSeen = diagnostics;
    selectedConfig.addEventListener("inputreport", (e) => {
      const b = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
      if (this.gamepad === null && b[0] !== 0xa4) {
        for (const cb of this.gamepadCbs) cb(b);
        return;
      }
      const w = this.waiters.shift();
      if (w) w(b); else this.queue.push(b);
    });
    if (gamepad) {
      try {
        await gamepad.open();
        this.gamepad = gamepad;
        gamepad.addEventListener("inputreport", (e) => {
          const b = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
          for (const cb of this.gamepadCbs) cb(b);
        });
      } catch (e) {
        this.gamepad = null;
      }
    }
    return { config: selectedConfig, gamepad: this.gamepad, devices: this.devicesSeen };
  }

  disconnect() {
    if (this.config) { try { this.config.close(); } catch {} this.config = null; }
    if (this.gamepad) { try { this.gamepad.close(); } catch {} this.gamepad = null; }
  }

  nextInput(timeout = 4000) {
    if (this.queue.length) return Promise.resolve(this.queue.shift());
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("等待输入超时")), timeout);
      this.waiters.push((b) => { clearTimeout(t); res(b); });
    });
  }

  async readFrames() {
    await this.config.sendReport(0, READ_QUERY);
    const frames = new Map();
    const deadline = Date.now() + 5000;
    while (frames.size < 9 && Date.now() < deadline) {
      const b = await this.nextInput();
      if (b.length < 64 || b[0] !== 0xa4 || b[2] !== MARKER_READ) continue;
      frames.set(b[3], b);
    }
    if (frames.size < 9) throw new Error(`只收到 ${frames.size}/9 帧`);
    const sorted = [...frames.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    return dechunkFrames(sorted, { marker: MARKER_READ, validate: false });
  }

  async readProfile() {
    const payload = await this.readFrames();
    if (payload.length !== 508) throw new Error(`数据流长度异常 ${payload.length}`);
    return payload;
  }

  async writeProfile(payload) {
    const frames = chunkPayload(payload, 0xd7);
    for (const f of frames) await this.config.sendReport(0, f);
  }
}
