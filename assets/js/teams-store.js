/**
 * teams-store.js —— 配队数据管理
 *
 * 数据源只有一个：assets/data/preset-teams.json（推荐配队 + 自己建的配队都在里面，用 isRecommended 区分）。
 *
 * 保存方式按运行环境自动选：
 *   1. 本机（tools/serve.js 在跑）  → PUT /api/teams，服务器直接写回 JSON 文件（每次写入自动备份）
 *   2. 线上 + 配了 GitHub 令牌      → 通过 GitHub 接口提交到仓库，Pages 自动重新发布
 *   3. 都不是                      → 退回 localStorage 暂存（重启用「导入本地暂存」找回）
 */
const LOCAL_KEY = 'ss_teams_v1';       // 仅第 3 种模式的暂存（ss_github_cfg 由 github-store.js 管）

const TEAM_STORE = { mode: 'loading', lastError: '', dirty: false };

function normList(list) {
  return (Array.isArray(list) ? list : []).map(t => {
    if (typeof t.pots === 'string') { try { t.pots = JSON.parse(t.pots); } catch (e) { t.pots = [{}, {}, {}]; } }
    if (!Array.isArray(t.pots)) t.pots = [{}, {}, {}];
    return t;
  });
}
// 把仓库存的 JSON 里混进来的旧格式整理一下（潜能等级曾经被存成过 JSON 字符串）
function allTeams() { return DATA.presetTeams || []; }
function findTeam(id) { return allTeams().find(t => t.id === id) || null; }

function setStatus(text, err) {
  TEAM_STORE.lastError = err || '';
  if (typeof renderTeamStoreStatus === 'function') renderTeamStoreStatus();
}

async function initTeamStore() {
  normList(DATA.presetTeams);
  let mode = 'local';
  let err = '';
  try {
    const r = await fetch('/api/teams', { cache: 'no-store' });
    const ct = (r.headers.get('content-type') || '');
    if (r.ok && ct.indexOf('application/json') >= 0) {
      const j = await r.json();
      if (j && Array.isArray(j.teams)) { DATA.presetTeams = normList(j.teams); mode = 'file'; }
    }
  } catch (e) { err = e.message; }
  if (mode !== 'file' && typeof ghConfigured === 'function' && ghConfigured()) mode = 'github';
  TEAM_STORE.mode = mode;
  setStatus('', err);
  await importLocalBackup();
  return mode;
}

function teamStoreLabel() {
  if (TEAM_STORE.mode === 'file') return '本机文件（改完即写入 JSON）';
  if (TEAM_STORE.mode === 'github') return '线上仓库（改完自动提交，Pages 稍后更新）';
  if (TEAM_STORE.mode === 'local') return '本地暂存（未接服务器/仓库，改动不会上传）';
  return '未就绪';
}

// 写入：把当前内存里的全部配队落到数据源
async function persistTeams() {
  const data = { teams: allTeams(), updatedAt: new Date().toISOString() };
  const json = JSON.stringify(data, null, 2);
  if (TEAM_STORE.mode === 'file') {
    const r = await fetch('/api/teams', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: json
    });
    if (!r.ok) throw new Error('写入失败：HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
    TEAM_STORE.dirty = false;
    setStatus('已写入 assets/data/preset-teams.json');
    return { ok: true, where: 'file' };
  }
  if (TEAM_STORE.mode === 'github') {
    const cfg = ghGetCfg();
    await ghWriteFile(cfg, DATA_FILE_PATH, json, '更新配队数据（站内编辑）');
    TEAM_STORE.dirty = false;
    setStatus('已提交到 ' + cfg.owner + '/' + cfg.repo);
    return { ok: true, where: 'github' };
  }
  // 本地暂存模式：也写一份 localStorage 兜底
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(allTeams())); } catch (e) {}
  TEAM_STORE.dirty = true;
  setStatus('已存到本浏览器（未上传）');
  return { ok: true, where: 'local' };
}

const DATA_FILE_PATH = 'assets/data/preset-teams.json';

function newTeamId() {
  return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function blankTeam(name) {
  return {
    id: newTeamId(),
    name: name || '新配队',
    presetCode: '',
    description: '',
    tags: { element: '', style: '', power: '', scene: [] },
    chars: [null, null, null],
    mainPatterns: [null, null, null],
    mainBackup: [null, null, null, null, null],
    subPatterns: [null, null, null],
    subBackup: [null, null, null, null, null],
    pots: [{}, {}, {}],
    isRecommended: false,
    updatedAt: Date.now()
  };
}

// ===== 读 =====（都从内存读，渲染函数保持同步）
function loadTeams() { return allTeams(); }
function getTeam(id) { return findTeam(id); }
function getBasePresetTeam(id) { return findTeam(id); }
function resolveTeam(id) { return findTeam(id); }
function isPresetTeam(id) { const t = findTeam(id); return !!(t && t.isRecommended); }
function loadPresetTeams() { return allTeams().filter(t => t.isRecommended); }
function deletedPresetTeams() { return []; }
function hasPresetOverride() { return false; }

// ===== 写 =====（都是异步，写完会立刻重新渲染当前页）
async function createTeam(name) {
  const t = blankTeam(name);
  DATA.presetTeams.push(t);
  try { await persistTeams(); } catch (e) { setStatus('', e.message); alert('保存失败：' + e.message); }
  return t;
}
async function updateTeam(id, patch) {
  const i = allTeams().findIndex(t => t.id === id);
  if (i < 0) return null;
  DATA.presetTeams[i] = Object.assign({}, DATA.presetTeams[i], patch, { updatedAt: Date.now() });
  try { await persistTeams(); } catch (e) { setStatus('', e.message); alert('保存失败：' + e.message); }
  return DATA.presetTeams[i];
}
async function saveTeamPatch(id, patch) { return updateTeam(id, patch); }
async function saveTeam(id, patch) { if (patch) return updateTeam(id, patch); return persistTeams(); }
async function deleteTeam(id) {
  DATA.presetTeams = allTeams().filter(t => t.id !== id);
  try { await persistTeams(); } catch (e) { setStatus('', e.message); alert('删除失败：' + e.message); }
  return true;
}
async function deletePresetOverride(id) { return deleteTeam(id); }
async function resetPresetOverride() { return true; }
function activePresetIds() { return allTeams().map(t => t.id); }

// ===== 旧数据搬家：把浏览器里的旧格式并进 JSON，只并一次 =====
async function importLocalBackup() {
  const parts = [];
  try { parts.push.apply(parts, JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')); } catch (e) {}
  try {
    const ovr = JSON.parse(localStorage.getItem('ss_preset_overrides_v1') || '{}');
    Object.keys(ovr).forEach(id => {
      const o = ovr[id] || {};
      const base = findTeam(id);
      if (base) {
        if (o.__deleted) parts.push({ id: '__del__' + id, __removeId: id });
        else parts.push(Object.assign({}, base, o, { id: id }));
      } else {
        parts.push(Object.assign({}, o, { id: id, isRecommended: false }));
      }
    });
  } catch (e) {}
  if (!parts.length) return 0;

  let changed = 0;
  const removals = [];
  parts.forEach(t => {
    if (!t) return;
    if (t.__removeId) { removals.push(t.__removeId); return; }
    const i = allTeams().findIndex(x => x.id === t.id);
    if (i >= 0) { DATA.presetTeams[i] = Object.assign({}, DATA.presetTeams[i], t); }
    else { DATA.presetTeams.push(t); }
    changed++;
  });
  if (removals.length) DATA.presetTeams = allTeams().filter(t => removals.indexOf(t.id) < 0);
  await persistTeams();
  localStorage.removeItem(LOCAL_KEY);
  localStorage.removeItem('ss_preset_overrides_v1');
  setStatus('已把浏览器里的 ' + changed + ' 处旧数据并进 JSON');
  return changed;
}

// 手动搬运按钮用：把本地暂存里的配队并进数据源
async function pullLocalBackup() {
  const n = await importLocalBackup();
  alert(n ? '已导入 ' + n + ' 支配队' : '本地暂存里没有可导入的配队');
  if (n) location.reload();
}
