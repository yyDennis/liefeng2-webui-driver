<script setup>
import { computed } from "vue";
import { state, markDirty } from "../lib/store.js";
const profile = computed(() => state.profile ?? {});
const m = computed(() => profile.value.motion ?? (profile.value.motion = { sensorMode: 0, enumSensorMode: 0, axisFlags: 0, simKeys: [], gyro: new Array(7).fill(0) }));
const sh = computed(() => profile.value.shock ?? (profile.value.shock = { bytes: new Array(9).fill(0) }));
const clamp = (v, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, v));
const SIM_OPTIONS = Array.from({ length: 21 }, (_, i) => i);
function toggleSimKey(k) { const keys = Array.isArray(m.value.simKeys) ? m.value.simKeys : (m.value.simKeys = []); const i = keys.indexOf(k); if (i >= 0) keys.splice(i, 1); else keys.push(k); keys.sort((a, b) => a - b); markDirty(); }
function setByte(arr, index, raw) { arr[index] = clamp(parseInt(raw, 16) || 0); markDirty(); }
</script>
<template>
  <div class="card"><h2>体感 Motion</h2><div class="grid">
    <div class="field"><label>sensorMode [304] 高4位</label><input type="number" min="0" max="15" :value="m.sensorMode" @input="m.sensorMode = clamp(+$event.target.value || 0, 0, 15); markDirty()"></div>
    <div class="field"><label>enumSensorMode [304] 低4位</label><input type="number" min="0" max="15" :value="m.enumSensorMode" @input="m.enumSensorMode = clamp(+$event.target.value || 0, 0, 15); markDirty()"></div>
    <div class="field"><label>轴反转/模式位 [311]</label><input type="text" style="width:72px" :value="'0x' + (m.axisFlags ?? 0).toString(16)" @change="m.axisFlags = parseInt($event.target.value, 16) || 0; markDirty()"></div>
    <div class="field"><label>sim_keys(体感触发键)</label><div style="max-width:440px"><span v-for="k in SIM_OPTIONS" :key="k" class="chip" :class="{ on: (m.simKeys ?? []).includes(k) }" @click="toggleSimKey(k)">键{{ k }}</span></div></div>
  </div><h3>陀螺仪原始字节 [312..318]</h3><div class="grid" style="grid-template-columns:repeat(7,58px)">
    <div class="field" v-for="(g, i) in (m.gyro ?? [])" :key="i"><label>g{{ i }}</label><input type="text" style="width:54px" :value="'0x' + (g ?? 0).toString(16)" @change="setByte(m.gyro, i, $event.target.value)"></div>
  </div></div>
  <div class="card"><h2>震动 [352..360]</h2><p class="desc">9 字节原始透传(布局未定,不猜)。</p><div class="grid" style="grid-template-columns:repeat(9,58px)">
    <div class="field" v-for="(b, i) in (sh.bytes ?? [])" :key="i"><label>[{{ 352 + i }}]</label><input type="text" style="width:54px" :value="'0x' + (b ?? 0).toString(16).padStart(2, '0')" @change="setByte(sh.bytes, i, $event.target.value)"></div>
  </div></div>
</template>
