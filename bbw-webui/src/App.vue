<script setup>
import { ref, onMounted, computed } from "vue";
import { state, pushLog } from "./lib/store.js";
import { serializeProfile } from "../../bbw-protocol/src/write-format.js";
import { payloadToProfile } from "./lib/decode.js";
import { gale2PayloadToProfile } from "./lib/gale2-adapter.js";
import ConnectView from "./views/ConnectView.vue";
import MappingView from "./views/MappingView.vue";
import StickView from "./views/StickView.vue";
import CurveView from "./views/CurveView.vue";
import MotionShockView from "./views/MotionShockView.vue";
import ConfigView from "./views/ConfigView.vue";
const tab = ref("connect"); const showLog = ref(false); const isReading = ref(false); const theme = ref("dark");
const isGale2 = computed(() => state.profile?.deviceModel === "gale2-readonly");
const TABS = [["connect","连接设备"],["mapping","按键映射"],["stick","扳机设置"],["curve","摇杆设置"],["motion","体感震动"],["config","配置管理"]];
function applyTheme() { const stored=theme.value; const dark=stored==="dark"||(stored==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.classList.toggle("light",!dark); }
function setTheme(t) { theme.value=t; try{localStorage.setItem("bbw-theme",t);}catch{} applyTheme(); }
function cycleTheme(){setTheme(theme.value==="dark"?"light":theme.value==="light"?"system":"dark");}
onMounted(()=>{try{theme.value=localStorage.getItem("bbw-theme")||"dark";}catch{} applyTheme();});
async function doRead(){if(!state.transport||isReading.value)return;isReading.value=true;try{pushLog("读取配置…");state.payload=await state.transport.readProfile();const gale2=state.transport.lastReadIsGale2||state.transport.usagePage===0xffab;state.profile=gale2?gale2PayloadToProfile(state.payload):payloadToProfile(state.payload);state.dirty=false;pushLog(gale2?"烈风2 (只读解析模式 - 写入已安全锁定)":"读取完成,解析成功");}catch(e){pushLog("读取失败: "+e.message);console.error("Configuration read failed:",e);}finally{isReading.value=false;}}
async function doWrite(){if(isGale2.value||!state.transport||!state.profile)return;if(!confirm("确认将当前编辑写入设备?\n\n([0..1] 将按 CRC-16/MODBUS 重算;未编辑字段保留设备原值)"))return;try{const p=serializeProfile(state.profile,state.payload??null);await state.transport.writeProfile(p);state.payload=p;state.dirty=false;pushLog("写入完成("+p.length+"B,9 帧),自动回读验证…");await doRead();const back=state.payload;if(back){const sameDz=back[5]===p[5]&&back[6]===p[6]&&back[7]===p[7]&&back[8]===p[8];const sameCrc=back[0]===p[0]&&back[1]===p[1];pushLog(sameDz&&sameCrc?"✅ 回读验证:设备接受写入(死区+校验一致)":"⚠️ 回读差异:死区一致="+sameDz+", 校验一致="+sameCrc);}}catch(e){pushLog("写入失败: "+e.message);}}
</script>
<template><div class="layout"><aside class="sidebar"><div class="logo"><h1>BBW 配置器</h1><div class="sub">beta · WebHID 直驱</div></div><nav><button v-for="[k,label] in TABS" :key="k" class="nav-item" :class="{on:tab===k}" :disabled="k!=='connect'&&!state.profile" @click="tab=k"><span>{{label}}</span><span v-if="k==='mapping'&&state.profile" class="badge muted" style="margin-left:auto">{{state.profile.keys.filter(x=>x).length}}</span></button></nav><div class="foot">CRC-16/MODBUS 已破解 · 协议逆向自 WndMgr/DevMgr</div></aside><div class="main"><header class="topbar"><span class="badge" :class="state.connected?'ok':'muted'"><span class="dot" :class="state.connected?'ok':'off'"></span>{{state.connected?'已连接':'未连接'}}</span><span v-if="isGale2" class="badge warn">烈风2 (只读解析模式 - 写入已安全锁定)</span><span v-if="state.dirty" class="badge warn">⚠ 未写回</span><button class="btn small" :disabled="!state.connected||isReading" @click="doRead">{{isReading?'读取中…':'读取'}}</button><button class="btn small primary" :disabled="!state.connected||!state.profile||isReading||isGale2" @click="doWrite">{{isGale2?'写入已锁定':'写入'}}</button><span class="spacer"></span><button class="btn small ghost" @click="cycleTheme" :title="'主题:'+theme">{{theme}}</button><button class="btn small ghost" @click="showLog=!showLog">日志</button></header><main class="content"><ConnectView v-if="tab==='connect'" @read="doRead"/><MappingView v-else-if="tab==='mapping'"/><StickView v-else-if="tab==='stick'"/><CurveView v-else-if="tab==='curve'"/><MotionShockView v-else-if="tab==='motion'"/><ConfigView v-else-if="tab==='config'"/><div v-if="showLog" class="card"><h2>日志</h2><pre class="log">{{state.log.join("\n")}}</pre></div></main></div></div></template>