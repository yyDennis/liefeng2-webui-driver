import { decodeProfile } from "../../../bbw-protocol/src/decode.js";

// Preserve supported fields and provide the shape expected by existing read-only views.
export function gale2PayloadToProfile(payload) {
  if (!(payload instanceof Uint8Array) || payload.length !== 456) throw new Error("烈风2解析需要456字节pad set");
  const d = decodeProfile(payload);
  const curves = Array.from({ length: 6 }, (_, i) => ({
    center: [d.triggers[i]?.c ?? 0, d.triggers[i]?.s ?? 0],
    points: Array.isArray(d.triggers[i]?.curve) ? d.triggers[i].curve : new Array(8).fill(0),
    outerDz: 0, maxOut: 100, stabilize: 0, ext: [],
  }));
  return {
    deviceModel: "gale2-readonly",
    deadzone: { ...d.deadzone },
    featFlags: [payload[12] ?? 0, payload[13] ?? 0],
    curves,
    triggers: d.triggers,
    motion: d.motion,
    shock: { bytes: [] },
    stickArea: new Array(35).fill(0),
    stickAreaAvailable: false,
    keys: d.keys.map((k) => k?.key === -2 ? null : ({
      code: k.key,
      type: k.type ?? 0,
      enabled: !!k.enabled,
      keys: [k.code1, k.code2].filter((x) => x !== undefined && x !== -1),
    })),
  };
}
