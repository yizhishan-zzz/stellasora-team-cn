/**
 * teams-store.js —— 配队数据管理
 *
 * 数据源只有一个：assets/data/preset-teams.json（推荐配队 + 自己建的配队都在里面，用 isRecommended 区分）。
 *
 * 保存方式按运行环境自动选：
 *   1. 本机（tools/serve.js 在跑）  → PUT /api/teams，服务器直接写回 JSON 文件（每次写入自动备份）
 *   2. 线上 + 配了 GitHub 令牌      → 通过 GitHub 接口提交到仓库，Pages 自动重新发布
 *   3. 都不是                      → 退回 localStorage 暂存（可点「导入本地暂存」找回）
 *
 * 写入策略：乐观更新 —— 先在内存里改完、立刻重绘页面，提交放后台，不用等网络。
 */
const LOCAL_KEY = 'ss_teams_v1';
// 本地覆盖层：每次写入成功后存一份最新数据。
// 线上 GitHub 模式提交后，要等 Cloudflare 重新部署（30~60 秒）静态文件才会更新，
// 这段时间新页面读到的还是旧文件，会把刚建的配队弄丢。加载时若本地这份更新，就用它兜住。
const OVERLAY_KEY = 'ss_teams_overlay_v1';
const DATA_FILE_PATH = 'assets/data/preset-teams.json';

const TEAM_STORE = { mode: 'loading', lastError: '', lastText: '' };
let pendingWrites = 0;

function normList(list) {
  return (Array.isArray(list) ? list : []).map(t => {
    if (typeof t.pots === 'string') { try { t.pots = JSON.parse(t.pots); } catch (e) { t.pots = [{}, {}, {}]; } }
    if (!Array.isArray(t.pots)) t.pots = [{}, {}, {}];
    return t;
  });
}
function allTeams() { return DATA.presetTeams || []; }
function findTeam(id) { return allTeams().find(t => t.id === id) || null; }

function setStatus(text, err) {
  TEAM_STORE.lastError = err || '';
  if (text) TEAM_STORE.lastText = text;
  if (typeof renderTeamStoreStatus === 'function') renderTeamStoreStatus();
}

// ===== 未同步改动：把还没提交成功的队伍单独记在本机 =====
// 用途：① 云端部署有 30~60 秒延迟，期间新页面读静态文件还是旧的，用它兜住
//       ② 提交失败（网络/GitHub 报错）时改动不丢，刷新后还在
// 只覆盖 id 相同的队伍，不会把远程其他队伍挤掉。
const PENDING_KEY = 'ss_teams_pending_v1';

function readPending() {
  try {
    const o = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
    return (o && typeof o === 'object') ? o : {};
  } catch (e) { return {}; }
}
function writePending(map) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(map || {})); } catch (e) {}
}
function markPending(teams, onlyIds) {
  const map = readPending();
  const at = Date.now();
  (teams || []).forEach(x => {
    if (!x || !x.id) return;
    if (onlyIds && onlyIds.size && !onlyIds.has(x.id)) return;   // 只记这次改动过的
    map[x.id] = { at: at, team: x };
  });
  writePending(map);
}
function clearPendingFor(teams) {
  const map = readPending();
  let n = 0;
  (teams || []).forEach(x => { if (x && x.id && map[x.id]) { delete map[x.id]; n++; } });
  writePending(map);
  return n;
}
function deletePendingFor(id) {
  const map = readPending();
  if (map[id]) { delete map[id]; writePending(map); return true; }
  return false;
}
// 合并未同步改动时按 updatedAt 取新的那份，避免用旧副本覆盖别处的新改动
// 把未同步的改动合并进当前数据（页面加载时调用）
function applyPending() {
  const map = readPending();
  const ids = Object.keys(map);
  if (!ids.length) return 0;
  const allIds = new Set(allTeams().map(x => x.id));
  const now = Date.now();
  let n = 0, cleaned = 0;
  ids.forEach(id => {
    const item = map[id];
    if (!item || !item.team) { delete map[id]; cleaned++; return; }
    if (deletedIds.has(id)) { delete map[id]; cleaned++; return; }          // 本次删掉的不复活
    if (!allIds.has(id) && (now - (item.at || 0)) > 24 * 3600 * 1000) { delete map[id]; cleaned++; return; }  // 过期残留清理
    const i2 = DATA.presetTeams.findIndex(x => x.id === id);
    if (i2 >= 0) {
      const cur = DATA.presetTeams[i2];
      if ((item.team.updatedAt || 0) >= (cur.updatedAt || 0)) { DATA.presetTeams[i2] = item.team; n++; }
    } else { DATA.presetTeams.push(item.team); n++; }
  });
  if (cleaned) writePending(map);
  return n;
}

// 按 id 去重（保留最后一次出现的），防止任何来源造成重复配队
function dedupeTeams() {
  const seen = {};
  const out = [];
  const list = allTeams();
  for (let i = list.length - 1; i >= 0; i--) {
    const t = list[i];
    if (!t || !t.id) continue;
    if (seen[t.id]) continue;
    seen[t.id] = 1;
    out.unshift(t);
  }
  const removed = list.length - out.length;
  DATA.presetTeams = out;
  return removed;
}

// 自愈：发现重复就清理并写回数据源
async function healTeams() {
  const removed = dedupeTeams();
  if (removed > 0) {
    try { await persistTeams(); } catch (e) {}
    setStatus('已清理 ' + removed + ' 个重复配队');
  }
  return removed;
}

// 写入：用调用时的快照，避免提交过程中本地又改动导致内容被覆盖
async function persistTeams(snapshot) {
  dedupeTeams();
  const teams = (snapshot && snapshot.length ? snapshot : allTeams()).filter(Boolean);
  const data = { teams: teams, updatedAt: new Date().toISOString() };
  const json = JSON.stringify(data, null, 2);

  if (TEAM_STORE.mode === 'file') {
    const r = await fetch('/api/teams', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: json });
    if (!r.ok) throw new Error('写入失败 HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
    clearPendingFor(teams);
    if (typeof showToast === 'function') showToast('已保存到数据文件');
    if (!pendingWrites) setStatus('已保存到 assets/data/preset-teams.json');
    return { ok: true, where: 'file' };
  }
  if (TEAM_STORE.mode === 'github') {
    const cfg = ghGetCfg();
    await ghWriteFile(cfg, DATA_FILE_PATH, json, '更新配队数据（站内编辑）');
    clearPendingFor(teams);   // 提交成功；云端部署还要 30~60 秒，这期间靠未同步记录兜住
    if (typeof showToast === 'function') showToast('已同步到线上仓库');
    if (!pendingWrites) setStatus('已提交到 ' + cfg.owner + '/' + cfg.repo + '（页面稍后自动更新）');
    return { ok: true, where: 'github' };
  }
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(allTeams())); } catch (e) {}
  if (!pendingWrites) setStatus('已存到本浏览器（未上传）');
  return { ok: true, where: 'local' };
}



// 乐观更新的核心：立刻返回，提交丢到后台。
// 关键：所有提交串行执行（一次只提交一个）。
// 否则用户连续改几个字段时，多个提交会带着同一个过期版本号同时发出，GitHub 全部回 409。
let inflight = [];
let writeQueue = [];
let writing = false;
// 本次会话真正改动过的配队 id —— 只把这些记为未同步。
// 否则整个列表都会被标记，老队也会被本机旧副本覆盖（换设备时丢改动）。
const touchedIds = new Set();
// 本次会话删掉的配队 id —— 防止它们被"未同步记录"复活
const deletedIds = new Set();

function drainQueue() {
  if (writing || !writeQueue.length) return;
  writing = true;
  const job = writeQueue.shift();
  persistTeams(job.snapshot)
    .then(r => { job.resolve(r); })
    .catch(e => { job.reject(e); })
    .then(() => {
      writing = false;
      pendingWrites = writeQueue.length;
      if (!pendingWrites) setStatus('');
      else setStatus('正在同步 ' + pendingWrites + ' 项…');
      drainQueue();
    });
}

function queuePersist() {
  const snapshot = allTeams().map(t => Object.assign({}, t));   // 深一点的快照，避免提交过程中被改
  pendingWrites = writeQueue.length + (writing ? 1 : 0) + 1;
  markPending(snapshot, touchedIds);   // 只记本次改动过的
  setStatus('正在同步 ' + pendingWrites + ' 项…');
  const p = new Promise((resolve, reject) => {
    writeQueue.push({ snapshot: snapshot, resolve: resolve, reject: reject });
    drainQueue();
  });
  const safe = p.catch(e => {
    // 提交失败不再弹窗打断（改动已存在本机覆盖层里，不会丢）
    setStatus('有改动还没提交成功，稍后会自动重试');
    if (typeof showToast === 'function') showToast('提交失败，改动已存在本机', 'err');
    TEAM_STORE.lastError = e.message;
    return { ok: false, error: e.message };
  });
  inflight.push(safe);
  safe.then(() => { inflight = inflight.filter(x => x !== safe); });
  return safe;
}

function waitPendingWrites() {
  if (!inflight.length && !writeQueue.length && !writing) return Promise.resolve();
  return Promise.race([
    Promise.all(inflight.slice().map(p => p.catch(() => null))),
    new Promise(r => setTimeout(r, 15000))
  ]);
}

async function initTeamStore() {
  normList(DATA.presetTeams);
  const n0 = dedupeTeams();
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
  // 把还没同步成功的改动合并进来（云端部署延迟 / 提交失败都能兜住）
  const applied = applyPending();
  if (applied > 0) { TEAM_STORE.usedOverlay = true; setStatus('有 ' + applied + ' 处改动还在本机，正在等线上跟上'); }
  await importLocalBackup();
  await healTeams();
  if (n0 > 0) setStatus('已清理 ' + n0 + ' 个重复配队');
  return mode;
}

function teamStoreLabel() {
  if (TEAM_STORE.mode === 'file') return '本机文件（改完即写入 JSON）';
  if (TEAM_STORE.mode === 'github') return '线上仓库（改完自动提交，Pages 稍后更新）';
  if (TEAM_STORE.mode === 'local') return '本地暂存（未接服务器/仓库，改动不会上传）';
  return '未就绪';
}

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

// ===== 读 =====
function loadTeams() { return allTeams(); }
function getTeam(id) { return findTeam(id); }
function getBasePresetTeam(id) { return findTeam(id); }
function resolveTeam(id) { return findTeam(id); }
function isPresetTeam(id) { const t = findTeam(id); return !!(t && t.isRecommended); }
function loadPresetTeams() { return allTeams().filter(t => t.isRecommended); }
function deletedPresetTeams() { return []; }
function hasPresetOverride() { return false; }
function activePresetIds() { return allTeams().map(t => t.id); }
function presetSyncPending() { return pendingWrites; }

// ===== 写 =====（改完立刻返回，提交在后台进行）
async function createTeam(name) {
  const t = blankTeam(name);
  DATA.presetTeams.push(t);
  touchedIds.add(t.id);
  queuePersist();
  return t;
}
async function updateTeam(id, patch) {
  const i = allTeams().findIndex(t => t.id === id);
  if (i < 0) return null;
  DATA.presetTeams[i] = Object.assign({}, DATA.presetTeams[i], patch, { updatedAt: Date.now() });
  touchedIds.add(id);
  queuePersist();
  return DATA.presetTeams[i];
}
async function saveTeamPatch(id, patch) { return updateTeam(id, patch); }
async function saveTeam(id, patch) { if (patch) return updateTeam(id, patch); return queuePersist(); }
async function deleteTeam(id) {
  DATA.presetTeams = allTeams().filter(t => t.id !== id);
  deletePendingFor(id);
  deletedIds.add(id);
  touchedIds.add(id);
  queuePersist();
  return true;
}
async function deletePresetOverride(id) { return deleteTeam(id); }
async function resetPresetOverride() { return true; }

// ===== 旧数据搬家：把浏览器里的旧格式并进 JSON，只并一次 =====
async function importLocalBackup() {
  const parts = [];
  try { parts.push.apply(parts, JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')); } catch (e) {}
  try {
    const ovr = JSON.parse(localStorage.getItem('ss_preset_overrides_v1') || '{}');
    Object.keys(ovr).forEach(id => {
      const o = ovr[id] || {};
      const base2 = findTeam(id);
      if (base2) {
        if (o.__deleted) parts.push({ id: '__del__' + id, __removeId: id });
        else parts.push(Object.assign({}, base2, o, { id: id }));
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
    if (i >= 0) { DATA.presetTeams[i] = Object.assign({}, DATA.presetTeams[i], t); changed++; }
    else if (t.isRecommended) { /* 推荐配队只允许合并，不新增副本 */ }
    else { DATA.presetTeams.push(t); changed++; }
  });
  if (removals.length) DATA.presetTeams = allTeams().filter(t => removals.indexOf(t.id) < 0);
  if (changed || removals.length) await persistTeams();
  localStorage.removeItem(LOCAL_KEY);
  localStorage.removeItem('ss_preset_overrides_v1');
  if (changed) setStatus('已把浏览器里的 ' + changed + ' 处旧数据并进 JSON');
  return changed;
}

async function pullLocalBackup() {
  const n = await importLocalBackup();
  alert(n ? '已导入 ' + n + ' 支配队' : '本地暂存里没有可导入的配队');
  if (n) location.reload();
}
