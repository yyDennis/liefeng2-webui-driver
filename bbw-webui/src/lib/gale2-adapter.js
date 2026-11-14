import { decodeProfile } from "../../../bbw-protocol/src/decode.js";

const byteArray = (value, length) => Array.from({ length }, (_, i) => {
  const n = Number(value?.[i]);
  return Number.isInteger(n) && n >= 0 && n <= 255 ? n : 0;
});
const curvePoints = (value) => Array.from({ length: 8 }, (_, i) => {
  const n = Number(value?.[i]);
  return Number.isFinite(n) ? n : 0;
});

// Preserve supported fields and provide complete, safe shapes for every view.
export function gale2PayloadToProfile(payload) {
  if (!(payload instanceof Uint8Array) || payload.length !== 456) throw new Error("烈风2解析需要456字节pad set");
  const d = decodeProfile(payload) ?? {};
  const deadzone = d.deadzone ?? {};
  const triggers = Array.from({ length: 6 }, (_, i) => {
    const t = d.triggers?.[i] ?? {};
    return { ...t, c: Number.isFinite(Number(t.c)) ? Number(t.c) : 0, s: Number.isFinite(Number(t.s)) ? Number(t.s) : 0, curve: curvePoints(t.curve) };
  });
  const curves = Array.from({ length: 6 }, (_, i) => ({
    center: [triggers[i].c, triggers[i].s], points: curvePoints(triggers[i].curve),
    outerDz: 0, maxOut: 100, stabilize: 0, ext: [],
  }));
  const sourceKeys = Array.isArray(d.keys) ? d.keys : [];
  const keys = Array.from({ length: 25 }, (_, i) => {
    const k = sourceKeys[i];
    if (!k || k.key === -2) return { code: i, type: 0, enabled: false, keys: [] };
    return { code: Number.isFinite(Number(k.key)) ? Number(k.key) : i, type: Number(k.type) || 0, enabled: !!k.enabled,
      keys: [k.code1, k.code2].filter(x => Number.isFinite(Number(x)) && Number(x) !== -1).map(Number) };
  });
  const m = d.motion ?? {};
  return {
    deviceModel: "gale2-readonly", deadzone: { c0: 0, s0: 100, c1: 0, s1: 100, hire0: false, hire1: false, ...deadzone },
    featFlags: byteArray([payload[12], payload[13]], 2), curves, triggers, keys,
    motion: { sensorMode: 0, enumSensorMode: 0, axisFlags: 0, simKeys: [], gyro: new Array(7).fill(0), ...m,
      simKeys: Array.isArray(m.simKeys) ? m.simKeys : [], gyro: byteArray(m.gyro, 7) },
    shock: { bytes: byteArray(d.shock?.bytes, 9) },
    stickArea: byteArray(d.stickArea, 35), stickAreaAvailable: Array.isArray(d.stickArea),
  };
}
