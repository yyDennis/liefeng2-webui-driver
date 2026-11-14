<script setup>
import { computed } from "vue";
import { state } from "../lib/store.js";
import { slotToCode } from "../lib/names.js";
import { keyCodeToBitmap, bitmapToSlot } from "../../../bbw-protocol/src/keymap.js";
import { nameOfCode } from "../lib/names-store.js";
import KeyRow from "../components/KeyRow.vue";
import KeyLearn from "../components/KeyLearn.vue";

const profile = computed(() => state.profile ?? null);
const keys = computed(() => {
  if (!profile.value) return [];
  if (!Array.isArray(profile.value.keys)) profile.value.keys = [];
  return profile.value.keys;
});
const rows = computed(() => {
  const out = [];
  for (let code = 0; code <= 24; code++) {
    const slot = bitmapToSlot(keyCodeToBitmap(code));
    if (slot >= 0 && slot < 25) out.push({ code, slot });
  }
  return out;
});
function ensureRow(i) {
  if (!keys.value[i] || typeof keys.value[i] !== "object") {
    keys.value[i] = { code: slotToCode(i) ?? i, type: 0, enabled: false, keys: [] };
  }
  const entry = keys.value[i];
  if (!Array.isArray(entry.keys)) entry.keys = [];
  if (!Number.isFinite(Number(entry.type))) entry.type = 0;
  if (typeof entry.enabled !== "boolean") entry.enabled = !!entry.enabled;
  return entry;
}
</script>
<template>
  <div class="card" v-if="profile">
    <h2>按键映射</h2>
    <p class="desc">按键名已固化；键码 0..24 按序排列。单键/组合使用物理按键码，宏绑定使用键盘键。</p>
    <table class="tbl">
      <thead><tr><th>按键</th><th>类型</th><th>enabled</th><th>绑定内容</th></tr></thead>
      <tbody><KeyRow v-for="r in rows" :key="r.code" :entry="ensureRow(r.slot)" :name="nameOfCode(r.code) ?? `键 ${r.code}`" /></tbody>
    </table>
  </div>
  <div v-else class="card"><h2>按键映射</h2><p class="desc">请先连接设备并读取配置。</p></div>
  <KeyLearn v-if="profile" />
</template>
