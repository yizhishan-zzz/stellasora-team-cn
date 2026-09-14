/**
 * teams-store.js —— 配队数据管理（本地优先）
 *
 * 目标：本机和线上的操作体验一致 —— 新建 / 编辑 / 删除都立刻生效，不等网络。
 *
 * 读取：优先用本机缓存（localStorage），秒开；云端数据只有在确实更新时才覆盖本机缓存。
 * 写入：先改内存 + 立刻重绘，提交在后台进行（串行队列，不会撞车）。
 * 删除：记墓碑（deleted），防止被本机缓存或云端旧数据复活。
 * 跨设备：别处改过且比本机新 -> 采用云端；本机有未提交的改动 -> 保留本机。
 */
const LOCAL_KEY = 'ss_teams_v1';          // 第 3 种模式（纯本地暂存）用
const CACHE_KEY = 'ss_teams_cache_v1';    // 本机缓存：{ at, updatedAt, teams, deleted }
const DATA_FILE_PATH = 'assets/data/preset-teams.json';

const TEAM_STORE = { mode: 'loading', lastError: '', lastText: '', usedOverlay: false };
let pendingWrites = 0;
let inflight = [];
let writeQueue = [];
let writing = false;
const touchedIds = new Set();    // 本次会话改动过、还没提交成功的 id
const deletedIds = new Set();    // 本次会话删掉的 id（墓碑）

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

// ===== 本机缓存：页面启动先用它，做到秒开 =====
function readCache() {
  try {
    const o = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!o || !Array.isArray(o.teams)) return null;
    return { at: o.at || 0, updatedAt: o.updatedAt || '', teams: o.teams, deleted: Array.isArray(o.deleted) ? o.deleted : [] };
  } catch (e) { return null; }
}
function writeCache(opts) {
  try {
    const prev = readCache();
    const o = {
      at: Date.now(),
      updatedAt: (opts && opts.updatedAt != null) ? opts.updatedAt : ((prev && prev.updatedAt) || ''),
      teams: (opts && opts.teams) || allTeams(),
      deleted: (opts && opts.deleted) ? Array.from(opts.deleted) : ((prev && prev.deleted) || [])
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(o));
    return o;
  } catch (e) { return null; }
}
function markDeleted(id) {
  const c = readCache();
  const del = new Set((c && c.deleted) || []);
  del.add(id);
  writeCache({ deleted: del });
}
function clearAllTombstones() {
  const c = readCache();
  if (c && (c.deleted || []).length) writeCache({ deleted: [] });
}

// 按 id 去重（保留最后一次出现的）
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

async function healTeams() {
  const removed = dedupeTeams();
  if (removed > 0) {
    try { await persistTeams(); } catch (e) {}
    setStatus('已清理 ' + removed + ' 个重复配队');
  }
  return removed;
}

// 本机缓存与云端数据合并：谁新用谁，墓碑优先
function mergeWithCache(fileTeams, fileUpdatedAt) {
  const cache = readCache();
  if (!cache) return { teams: fileTeams || [], updatedAt: fileUpdatedAt || '', changed: false };
  const fileTime = Date.parse(fileUpdatedAt || '') || 0;
  const cacheTime = Date.parse(cache.updatedAt || '') || 0;
  const tomb = new Set((cache.deleted || []).concat(Array.from(deletedIds)));
  const fileMap = {};
  (fileTeams || []).forEach(t => { if (t && t.id) fileMap[t.id] = t; });
  const cacheMap = {};
  (cache.teams || []).forEach(t => { if (t && t.id) cacheMap[t.id] = t; });

  if (fileTime > cacheTime) {
    // 云端更新 -> 以云端为底，保留墓碑删除的、以及本机有未提交改动的
    const out = [];
    const used = {};
    (fileTeams || []).forEach(t => {
      if (!t || !t.id || tomb.has(t.id)) return;
      const local = cacheMap[t.id];
      if (local && touchedIds.has(t.id) && (local.updatedAt || 0) > (t.updatedAt || 0)) out.push(local);
      else out.push(t);
      used[t.id] = 1;
    });
    (cache.teams || []).forEach(t => {
      if (!t || !t.id || used[t.id] || tomb.has(t.id)) return;
      if (touchedIds.has(t.id)) out.push(t);
    });
    return { teams: out, updatedAt: fileUpdatedAt, changed: true };
  }
  // 本机缓存更新（或一样新）-> 用本机，补上云端多出来的
  const out = [];
  const used = {};
  (cache.teams || []).forEach(t => {
    if (!t || !t.id || tomb.has(t.id)) return;
    out.push(t);
    used[t.id] = 1;
  });
  (fileTeams || []).forEach(t => {
    if (!t || !t.id || used[t.id] || tomb.has(t.id)) return;
    out.push(t);
  });
  return { teams: out, updatedAt: cache.updatedAt || fileUpdatedAt || '', changed: true };
}

// 写入：提交用快照；成功后更新本机缓存并清墓碑
async function persistTeams(snapshot) {
  const teams = (snapshot && snapshot.length ? snapshot : allTeams()).filter(Boolean);
  const data = { teams: teams, updatedAt: new Date().toISOString() };
  const json = JSON.stringify(data, null, 2);

  if (TEAM_STORE.mode === 'file') {
    const r = await fetch('/api/teams', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: json });
    if (!r.ok) throw new Error('写入失败 HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
    clearAllTombstones();
    writeCache({ teams: teams, updatedAt: data.updatedAt, deleted: [] });
    if (!pendingWrites) setStatus('已保存到 assets/data/preset-teams.json');
    return { ok: true, where: 'file' };
  }
  if (TEAM_STORE.mode === 'github') {
    const cfg = ghGetCfg();
    await ghWriteFile(cfg, DATA_FILE_PATH, json, '更新配队数据（站内编辑）');
    clearAllTombstones();
    writeCache({ teams: teams, updatedAt: data.updatedAt, deleted: [] });
    if (typeof showToast === 'function') showToast('已同步到线上仓库');
    if (!pendingWrites) setStatus('已提交到 ' + cfg.owner + '/' + cfg.repo + '（页面稍后自动更新）');
    return { ok: true, where: 'github' };
  }
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(allTeams())); } catch (e) {}
  writeCache({ teams: teams, updatedAt: data.updatedAt });
  if (!pendingWrites) setStatus('已存到本浏览器（未上传）');
  return { ok: true, where: 'local' };
}

// 乐观更新：立刻返回，提交丢后台；所有提交串行执行（避免版本号撞车）
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
      setStatus(pendingWrites ? '正在同步 ' + pendingWrites + ' 项…' : '');
      drainQueue();
    });
}
function queuePersist() {
  const snapshot = allTeams().map(t => Object.assign({}, t));
  pendingWrites = writeQueue.length + (writing ? 1 : 0) + 1;
  setStatus('正在同步 ' + pendingWrites + ' 项…');
  const p = new Promise((resolve, reject) => {
    writeQueue.push({ snapshot: snapshot, resolve: resolve, reject: reject });
    drainQueue();
  });
  const safe = p.catch(e => {
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

// ===== 初始化：本地优先，先渲染再后台校准 =====
async function initTeamStore() {
  normList(DATA.presetTeams);
  const fileTeams = DATA.presetTeams.slice();
  const fileUpdatedAt = DATA.presetTeamsUpdatedAt || '';
  const n0 = dedupeTeams();

  // ① 同步合并本机缓存（不联网）-> 页面可以立刻渲染
  const merged = mergeWithCache(fileTeams, fileUpdatedAt);
  DATA.presetTeams = normList(merged.teams);
  dedupeTeams();
  if (allTeams().length !== fileTeams.length) TEAM_STORE.usedOverlay = true;

  // ② 判断模式
  let mode = 'local';
  if (typeof ghConfigured === 'function' && ghConfigured()) mode = 'github';
  TEAM_STORE.mode = mode;

  // ③ 后台校准（不阻塞页面渲染）
  calibrate().catch(() => {});

  await importLocalBackup();
  if (n0 > 0) setStatus('已清理 ' + n0 + ' 个重复配队');
  return mode;
}

// 后台校准：拉一次真实数据，刷新本机缓存（下次打开就是最新的）
async function calibrate() {
  let fresh = null, updatedAt = '';
  try {
    const r = await fetch('/api/teams', { cache: 'no-store' });
    const ct = (r.headers.get('content-type') || '');
    if (r.ok && ct.indexOf('application/json') >= 0) {
      const j = await r.json();
      if (j && Array.isArray(j.teams)) { fresh = j.teams; updatedAt = j.updatedAt || ''; TEAM_STORE.mode = 'file'; }
    }
  } catch (e) { /* 线上没有这个接口，正常 */ }
  if (!fresh && typeof ghConfigured === 'function' && ghConfigured()) {
    try {
      const cfg = ghGetCfg();
      const cur = await ghReadFile(cfg, DATA_FILE_PATH);
      if (cur && cur.text) {
        const j = JSON.parse(cur.text);
        if (j && Array.isArray(j.teams)) { fresh = j.teams; updatedAt = j.updatedAt || ''; }
      }
    } catch (e) { /* 令牌无效或网络问题，忽略 */ }
  }
  if (!fresh) return;
  const mergedNow = mergeWithCache(fresh, updatedAt);
  if (mergedNow.changed) writeCache({ teams: mergedNow.teams, updatedAt: mergedNow.updatedAt });
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
function readPending() {
  try {
    const c = readCache();
    const map = {};
    ((c && c.teams) || []).forEach(t => { if (t && t.id && touchedIds.has(t.id)) map[t.id] = { at: c.at, team: t }; });
    return map;
  } catch (e) { return {}; }
}

// ===== 写 =====（改完立刻返回，提交在后台）
async function createTeam(name) {
  const t = blankTeam(name);
  DATA.presetTeams.push(t);
  touchedIds.add(t.id);
  writeCache({ teams: allTeams().map(x => Object.assign({}, x)) });   // 立刻落本机：跳转后立刻能读到
  queuePersist();
  return t;
}
async function updateTeam(id, patch) {
  const i = allTeams().findIndex(t => t.id === id);
  if (i < 0) return null;
  DATA.presetTeams[i] = Object.assign({}, DATA.presetTeams[i], patch, { updatedAt: Date.now() });
  touchedIds.add(id);
  writeCache({ teams: allTeams().map(x => Object.assign({}, x)) });
  queuePersist();
  return DATA.presetTeams[i];
}
async function saveTeamPatch(id, patch) { return updateTeam(id, patch); }
async function saveTeam(id, patch) { if (patch) return updateTeam(id, patch); return queuePersist(); }
async function deleteTeam(id) {
  DATA.presetTeams = allTeams().filter(t => t.id !== id);
  deletedIds.add(id);
  markDeleted(id);                                                    // 墓碑：防止被复活
  touchedIds.add(id);
  writeCache({ teams: allTeams().map(x => Object.assign({}, x)) });   // 立刻落本机
  queuePersist();
  return true;
}
async function deletePresetOverride(id) { return deleteTeam(id); }
async function resetPresetOverride() { return true; }

// ===== 旧数据搬家（只做一次）=====
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
    else if (t.isRecommended) { /* 推荐配队只合并，不新增 */ }
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
