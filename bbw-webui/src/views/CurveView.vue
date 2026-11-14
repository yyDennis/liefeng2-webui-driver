<script setup>
import { computed } from "vue";
import { state, markDirty } from "../lib/store.js";
import { vkName } from "../lib/names.js";
import CurveEditor from "../components/CurveEditor.vue";

const LEFT = [0, 2, 4], RIGHT = [1, 3, 5], NAME = ["默认", "Curve1", "Curve2"];
const profile = computed(() => state.profile ?? null);
function safeCurve(index) {
  const p = profile.value;
  if (!p) return { center: [0, 0], points: [0, 0, 33, 33, 66, 66, 100, 100], outerDz: 0, maxOut: 100, stabilize: 0, ext: [] };
  if (!Array.isArray(p.curves)) p.curves = [];
  while (p.curves.length < 6) p.curves.push(null);
  let c = p.curves[index];
  if (!c || typeof c !== "object") c = p.curves[index] = {};
  if (!Array.isArray(c.center)) c.center = [0, 0];
  while (c.center.length < 2) c.center.push(0);
  if (!Array.isArray(c.points)) c.points = [0, 0, 33, 33, 66, 66, 100, 100];
  while (c.points.length < 8) c.points.push(0);
  if (!Array.isArray(c.ext)) c.ext = [];
  if (!Number.isFinite(Number(c.outerDz))) c.outerDz = 0;
  if (!Number.isFinite(Number(c.maxOut))) c.maxOut = 100;
  if (!Number.isFinite(Number(c.stabilize))) c.stabilize = 0;
  return c;
}
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number(v) || 0));
function addExtKey(g, vk) {
  if (!g || !g.entry || !Array.isArray(g.entry.keys) || vk === "" || vk == null) return;
  const n = Number(vk);
  if (Number.isFinite(n) && !g.entry.keys.includes(n)) { g.entry.keys.push(n); markDirty(); }
}
function setPoint(si, idx, raw) {
  const pts = safeCurve(si).points;
  let v = Math.round(clamp(raw));
  if (idx % 2 === 0) v = Math.max(idx >= 2 ? pts[idx - 2] : 0, Math.min(idx <= 4 ? pts[idx + 2] : 100, v));
  pts[idx] = v; markDirty();
}
</script>
<template>
  <div v-if="profile" class="split">
    <div v-for="side in ['left', 'right']" :key="side" class="col">
      <h2 style="margin-bottom:10px">{{ side === 'left' ? '左摇杆' : '右摇杆' }}</h2>
      <div class="card"><h2>{{ side === 'left' ? '左' : '右' }}摇杆死区</h2><div class="grid">
        <div class="field"><label>中心死区 正半程</label><input type="number" min="0" max="100" :value="safeCurve(side === 'left' ? 0 : 1).center[0] ?? 0" @input="safeCurve(side === 'left' ? 0 : 1).center[0] = clamp($event.target.value); markDirty()"></div>
        <div class="field"><label>中心死区 负半程</label><input type="number" min="0" max="100" :value="safeCurve(side === 'left' ? 0 : 1).center[1] ?? 0" @input="safeCurve(side === 'left' ? 0 : 1).center[1] = clamp($event.target.value); markDirty()"></div>
        <div class="field"><label>外圈死区</label><input type="number" min="0" max="100" :value="safeCurve(side === 'left' ? 0 : 1).outerDz" @input="safeCurve(side === 'left' ? 0 : 1).outerDz = clamp($event.target.value); markDirty()"></div>
      </div></div>
      <div v-for="(si, k) in (side === 'left' ? LEFT : RIGHT)" :key="si" class="card">
        <h2>{{ side === 'left' ? '左' : '右' }}摇杆 {{ NAME[k] }}</h2><div class="grid">
          <div class="field"><label>中心正半程</label><input type="number" min="0" max="100" :value="safeCurve(si).center[0] ?? 0" @input="safeCurve(si).center[0] = clamp($event.target.value); markDirty()"></div>
          <div class="field"><label>中心负半程</label><input type="number" min="0" max="100" :value="safeCurve(si).center[1] ?? 0" @input="safeCurve(si).center[1] = clamp($event.target.value); markDirty()"></div>
          <div class="field"><label>外圈死区</label><input type="number" min="0" max="100" :value="safeCurve(si).outerDz" @input="safeCurve(si).outerDz = clamp($event.target.value); markDirty()"></div>
          <div class="field"><label>上限输出</label><input type="number" min="0" max="100" :value="safeCurve(si).maxOut" @input="safeCurve(si).maxOut = clamp($event.target.value); markDirty()"></div>
          <div class="field"><label>稳定系数</label><input type="number" min="-10" max="10" :value="safeCurve(si).stabilize" @input="safeCurve(si).stabilize = Math.max(-10, Math.min(10, Number($event.target.value) || 0)); markDirty()"></div>
        </div>
        <h3>响应曲线 (4 点)</h3><div style="display:flex;gap:16px;flex-wrap:wrap">
          <CurveEditor :points="safeCurve(si).points" @change="markDirty()" />
          <table class="tbl" style="max-width:230px;align-self:center"><thead><tr><th>点</th><th>x</th><th>y</th></tr></thead><tbody>
            <tr v-for="j in 4" :key="j"><td>P{{ j - 1 }}</td><td><input type="number" min="0" max="100" style="width:58px" :value="safeCurve(si).points[(j - 1) * 2] ?? 0" @change="setPoint(si, (j - 1) * 2, $event.target.value)"></td><td><input type="number" min="0" max="100" style="width:58px" :value="safeCurve(si).points[(j - 1) * 2 + 1] ?? 0" @change="setPoint(si, (j - 1) * 2 + 1, $event.target.value)"></td></tr>
          </tbody></table>
        </div>
        <h3>扩展键映射</h3><div v-for="(g, gi) in safeCurve(si).ext" :key="gi" class="field">
          <label>组 {{ gi }}: 类型</label><input type="number" min="0" max="255" style="width:60px" :value="g?.type ?? 0" @input="g.type = Math.max(0, Math.min(255, Number($event.target.value) || 0)); markDirty()">
          <select v-if="g?.entry" :value="g.entry.type ?? 0" @change="g.entry.type = Number($event.target.value); markDirty()"><option :value="0">单键/组合</option><option :value="1">宏A(键盘)</option><option :value="2">宏B(单值)</option></select>
          <span v-for="(kk, i) in (g?.entry?.keys ?? [])" :key="i" class="chip">{{ vkName(kk) }} <button class="btn small" @click="g.entry.keys.splice(i, 1); markDirty()">×</button></span>
          <select v-if="g?.entry" style="width:100px" @change="addExtKey(g, $event.target.value); $event.target.value=''" ><option value="">+键</option><option v-for="c in 25" :key="c - 1" :value="c - 1">按键{{ c - 1 }}</option><option v-for="vk in [65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,48,49,50,51,52,53,54,55,56,57,162,160,164,91,13,32,8,27]" :key="'v' + vk" :value="vk">键盘 {{ vkName(vk) }}</option></select>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="card"><h2>摇杆 / 扳机设置</h2><p class="desc">请先连接设备并读取配置。</p></div>
</template>
