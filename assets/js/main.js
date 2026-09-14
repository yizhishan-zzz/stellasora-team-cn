/**
 * main.js —— 页面路由与各页渲染逻辑
 * 每个 HTML 只声明 <body data-page="xxx">，逻辑集中在此。
 */

const routes = {
  home: renderHome,
  characters: renderCharacters,
  character: renderCharacter,
  teams: renderTeams,
  team: renderTeam,
  patterns: renderPatterns,
  pattern: renderPattern
};

async function init() {
  try {
    await loadData();
    await loadAuth();
  } catch (err) {
    showLoadError(err);
    return;
  }
  const page = document.body.dataset.page;
  initNavbar(page);
  initFooter();
    initAdminButton();
  // 接数据源：本机文件 / 线上仓库 / 本地暂存
  // （加 typeof 防御：万一某个页面漏引 teams-store.js，也不至于整页渲染不出来）
  if (typeof initTeamStore === 'function') await initTeamStore();
  if (routes[page]) routes[page]();
}

// 全站页脚（字体标注）
function initFooter() {
  if (document.querySelector('.site-footer')) return;
  const f = document.createElement('footer');
  f.className = 'site-footer';
  f.textContent = '使用字体：MiSans，MiSansLatin';
  document.body.appendChild(f);
}

document.addEventListener('DOMContentLoaded', init);

// ============ 通用：列表页（筛选 + 网格） ============
function setupListPage(defs, data, renderItem, gridId, countId, emptyId) {
  const state = {};
  defs.forEach(d => state[d.key] = 'all');

  // 渲染筛选栏
  const bar = document.getElementById('filters');
  if (bar) {
    bar.innerHTML = defs.map(d => {
      const chips = d.options.map(o =>
        '<button type="button" class="chip' + (o.value === 'all' ? ' active' : '') + (o.cls ? ' ' + o.cls : '') +
        '" data-key="' + d.key + '" data-value="' + o.value + '">' + (o.html || escapeHtml(o.label)) + '</button>'
      ).join('');
      return '<div class="filter-row"><span class="filter-label">' + d.label + '</span><div class="filter-chips">' + chips + '</div></div>';
    }).join('');

    bar.addEventListener('click', e => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      const key = btn.dataset.key, value = btn.dataset.value;
      bar.querySelectorAll('.chip[data-key="' + key + '"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state[key] = value;
      render();
    });
  }

  const grid = document.getElementById(gridId);
  const empty = document.getElementById(emptyId);

  function render() {
    const list = data.filter(item => defs.every(d => {
      if (state[d.key] === 'all') return true;
      const v = item[d.key];
      if (d.kind === 'int') return v === parseInt(state[d.key], 10);
      if (d.kind === 'bool') return v === (state[d.key] === 'true');
      if (d.kind === 'array') return Array.isArray(v) && v.includes(state[d.key]);
      return v === state[d.key];
    }));
    const count = document.getElementById(countId);
    if (count) count.textContent = list.length;
    grid.innerHTML = list.map(renderItem).join('');
    grid.style.display = list.length ? '' : 'none';
    empty.hidden = list.length > 0;
  }
  render();
}

// ============ 通用：强度排序 ============
// 强度档位顺序：T0 > T0.5 > T1 > T1.5 > T2 > T2.5 > T3 > 未设置
const POWER_ORDER = ['T0', 'T0.5', 'T1', 'T1.5', 'T2', 'T2.5', 'T3'];
function powerRank(power) {
  const s = String(power == null ? '' : power).trim().toUpperCase();
  const i = POWER_ORDER.indexOf(s);
  return i < 0 ? POWER_ORDER.length : i;
}
// 按强度稳定排序（同档位保持原顺序）
function sortByPower(list) {
  return list.map((t, i) => ({ t: t, i: i }))
    .sort((a, b) => {
      const d = powerRank((a.t.tags || {}).power) - powerRank((b.t.tags || {}).power);
      return d !== 0 ? d : a.i - b.i;
    })
    .map(x => x.t);
}
// 取配队的元素 key
function teamElementKey(t) {
  const cn = ((t.tags || {}).element) || '';
  for (const k of Object.keys(ELEMENTS)) if (ELEMENTS[k].name === cn) return k;
  return 'none';
}
// 首页每个属性最多展示的配队数
const HOME_TEAMS_PER_ELEMENT = 6;

// ============ 通用：适用场合标签 ============
const TEAM_SCENES = ['单体环境', '群体环境'];
// 兼容旧数据：没有 scene 字段时按空数组处理
function teamScenes(t) {
  const v = (t && t.tags) ? t.tags.scene : null;
  return Array.isArray(v) ? v.filter(s => TEAM_SCENES.indexOf(s) >= 0) : [];
}

// ============ 首页 ============
function renderHome() {
  const userTeams = (typeof loadTeams === 'function') ? loadTeams() : [];
  const recs = (typeof loadPresetTeams === 'function') ? loadPresetTeams() : (DATA.presetTeams || []);
  const stats = [
    { num: DATA.characters.length, label: '旅人' },
    { num: DATA.patterns.length, label: '秘纹' },
    { num: recs.length + userTeams.length, label: '配队方案' }
  ];
  document.getElementById('stats').innerHTML = stats.map(x =>
    '<div class="stat-card"><div class="stat-num">' + x.num + '</div><div class="stat-label">' + x.label + '</div></div>'
  ).join('');

  // 首页概览只列六大属性（无属性/其它不单列一块）
  const ELORDER = ['water', 'fire', 'wind', 'earth', 'light', 'dark'];
  const byEl = {};
  recs.concat(userTeams).forEach(t => { const e = teamElementKey(t); (byEl[e] = byEl[e] || []).push(t); });
  // 每个属性内按强度排序（T0 → T0.5 → …），展示时只取前 HOME_TEAMS_PER_ELEMENT 个
  Object.keys(byEl).forEach(e => { byEl[e] = sortByPower(byEl[e]); });
  const blocks = document.getElementById('elBlocks');
  if (blocks) {
    blocks.innerHTML = ELORDER.filter(e => byEl[e] && byEl[e].length).map(e => {
      const icon = elIcon(e);
      const nm = e === 'none' ? '无属性' : (ELEMENTS[e] ? ELEMENTS[e].name : e);
      return '<button class="el-block" data-el="' + e + '">' + icon + '<span class="el-block-name">' + nm + '队</span><span class="el-block-count">' + byEl[e].length + '</span></button>';
    }).join('');
    const showEl = (e) => {
      blocks.querySelectorAll('.el-block').forEach(b => b.classList.toggle('active', b.dataset.el === e));
      const grid = document.getElementById('hotTeams');
      if (!grid) return;
      const all = byEl[e] || [];
      const shown = all.slice(0, HOME_TEAMS_PER_ELEMENT);
      grid.innerHTML = shown.map(t => t.isRecommended ? renderPresetTeamCard(t) : renderUserTeamCard(t)).join('');
      const more = document.getElementById('elMore');
      if (more) {
        const rest = all.length - shown.length;
        more.hidden = rest <= 0;
        more.innerHTML = rest > 0
          ? '本属性共 ' + all.length + ' 个配队，另有 ' + rest + ' 个未展示 · <a class="nav-link" href="teams.html">查看全部 →</a>'
          : '';
      }
    };
    blocks.querySelectorAll('.el-block').forEach(b => b.addEventListener('click', () => showEl(b.dataset.el)));
    const firstEl = ELORDER.find(e => byEl[e] && byEl[e].length);
    if (firstEl) showEl(firstEl);
  }
  document.getElementById('hotChars').innerHTML = DATA.characters.slice().sort((a,b)=>(b.sid||0)-(a.sid||0)).slice(0, 8).map(renderCharCard).join('');
}

// ============ 角色图鉴 ============
function renderCharacters() {
  const defs = [
    { key: 'element', label: '属性', options: [{ value: 'all', label: '全部' }].concat(Object.entries(ELEMENTS).map(([v, o]) => ({ value: v, label: o.name, cls: 'el-' + v, html: elIcon(v) }))) },
    { key: 'role', label: '职业', options: [{ value: 'all', label: '全部' }].concat(Object.entries(ROLES).map(([v, o]) => ({ value: v, label: o.name, cls: 'role-' + v }))) },
    { key: 'rarity', label: '星级', kind: 'int', options: [{ value: 'all', label: '全部' }, { value: '5', label: '5星', html: renderStars(5) }, { value: '4', label: '4星', html: renderStars(4) }] }
  ];
  setupListPage(defs, DATA.characters.slice().sort((a,b)=>(b.sid||0)-(a.sid||0)), renderCharCard, 'grid', 'count', 'empty');
}

// ============ 角色详情 ============
function renderCharacter() {
  const char = getCharById(getUrlParam('id'));
  const root = document.getElementById('content');
  if (!char) { root.innerHTML = notFound('未找到该角色', 'characters.html', '返回角色图鉴'); return; }

  document.title = char.name + ' - 星塔旅人配队一览';

  const meta = [
    ['所属', char.affiliation],
    ['攻击距离', char.attackType], ['中文CV', char.cvCn], ['日文CV', char.cvJp]
  ].filter(m => m[1]).map(m => '<div class="meta-item"><span class="meta-k">' + m[0] + '</span><span class="meta-v">' + escapeHtml(m[1]) + '</span></div>').join('');


  // 潜能（按流派分组）
  const flows = [];
  (char.potentials || []).forEach(p => {
    let f = flows.find(x => x.name === p.flow);
    if (!f) { f = { name: p.flow || '未分类', items: [] }; flows.push(f); }
    f.items.push(p);
  });
  const potHtml = flows.length
    ? flows.map(f => '<div class="flow-block"><div class="flow-title">' + escapeHtml(f.name) + '</div>' +
        f.items.map(p => '<div class="potential">' + (p.icon ? '<span class="pot-ico ' + potRarityCls(p) + '"><img class="potential-icon" src="' + escapeHtml(p.icon) + '" alt="" loading="lazy">' + potCornerHtml(p) + '</span>' : '') + '<div class="potential-body"><div class="potential-head"><span class="potential-name">' + escapeHtml(p.name) + '</span><span class="potential-type ' + (p.type === '核心潜能' ? 'type-core' : p.type === '彩潜能' ? 'type-rare' : 'type-common') + '">' + escapeHtml(p.type || '') + '</span></div><div class="potential-desc">' + escapeHtml(p.desc || '') + '</div></div></div>').join('') + '</div>').join('')
    : emptyHint('潜能数据待补充');

  root.innerHTML = `
    <div class="detail-head">
      ${renderPortrait(char, 'detail-portrait')}
      <div class="detail-info">
        <h1 class="detail-name">${escapeHtml(char.name)}</h1>
        
        <div class="badge-row">
          <span class="badge el-${char.element}">${elementName(char.element)}元素</span>
          <span class="badge role-${char.role}">${roleName(char.role)}</span>
          <span class="badge badge-rarity">${char.rarity ? char.rarity + '星' : '稀有度待补'}</span>
        </div>
        <div class="detail-meta">${meta}</div>
      </div>
    </div>
    <section class="section"><h2 class="section-title">潜能</h2>${potHtml}</section>
  `;
}

// ============ 配队方案（列表） ============
// 取配队：我的配队 → 推荐配队（含管理员本地覆盖层）
function getTeamAny(id) {
  if (typeof resolveTeam === 'function') return resolveTeam(id);
  const mine = (typeof getTeam === 'function') ? getTeam(id) : null;
  if (mine) return mine;
  return (DATA.presetTeams || []).find(t => t.id === id) || null;
}
// 是否为可编辑的「我的配队」（推荐配队不算）
function isOwnTeam(id) { return typeof getTeam === 'function' && !!getTeam(id); }
// 保存改动：我的配队正常更新；推荐配队写入覆盖层（管理员本地编辑）
function saveTeamEdit(id, patch) {
  if (typeof saveTeamPatch === 'function') return saveTeamPatch(id, patch);
  return updateTeam(id, patch);
}

// ============ 仓库设置（线上编辑用） ============
function openRepoConfig() {
  const old = document.getElementById('repoModal');
  if (old) old.remove();
  const cfg = (typeof ghGetCfg === 'function' ? ghGetCfg() : null) || {};
  const modal = document.createElement('div');
  modal.id = 'repoModal';
  modal.className = 'picker-modal';
  const f = (id, label, val, ph, type) =>
    '<label class="rc-row"><span class="rc-label">' + label + '</span>' +
    '<input id="' + id + '" class="admin-input" type="' + (type || 'text') + '" value="' + escapeHtml(val || '') + '" placeholder="' + ph + '"></label>';
  modal.innerHTML = '<div class="admin-panel rc-panel">' +
    '<div class="admin-title">数据文件仓库设置</div>' +
    '<p class="rc-tip">线上编辑时，改配队会通过 GitHub 接口提交到仓库里的 ' +
    '<code>assets/data/preset-teams.json</code>，Pages 会自动重新发布。<br>' +
    '令牌只存在本浏览器，不会发给任何第三方；建议用 fine-grained token，只勾这一个仓库的 Contents 读写。</p>' +
    f('rcOwner', '仓库用户/组织', cfg.owner, '例如 yourname') +
    f('rcRepo', '仓库名', cfg.repo, '例如 stella-sora-network') +
    f('rcBranch', '分支', cfg.branch || 'main', 'main') +
    f('rcToken', '访问令牌', cfg.token, 'github_pat_...', 'password') +
    '<div class="admin-err" id="rcMsg"></div>' +
    '<div class="admin-actions">' +
      '<button class="btn-secondary" id="rcClear">清除</button>' +
      '<button class="btn-secondary" id="rcTest">测试连接</button>' +
      '<button class="btn" id="rcSave">保存</button>' +
    '</div>' +
    '<div class="admin-actions"><button class="btn-secondary" id="rcClose">关闭</button></div>' +
  '</div>';
  document.body.appendChild(modal);
  const val = id => (document.getElementById(id).value || '').trim();
  const readForm = () => ({ owner: val('rcOwner'), repo: val('rcRepo'), branch: val('rcBranch') || 'main', token: val('rcToken') });
  const msg = t => { document.getElementById('rcMsg').textContent = t || ''; };
  document.getElementById('rcClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('rcClear').addEventListener('click', () => {
    if (!confirm('清除本浏览器保存的仓库令牌？')) return;
    ghClearCfg();
    msg('已清除');
    if (typeof renderTeamStoreStatus === 'function') renderTeamStoreStatus();
    setTimeout(() => location.reload(), 600);
  });
  document.getElementById('rcTest').addEventListener('click', async () => {
    const c = readForm();
    if (!c.owner || !c.repo || !c.token) { msg('仓库用户、仓库名、令牌都要填'); return; }
    msg('测试中…');
    try { const r = await ghCheck(c); msg('OK：' + r.full + '（默认分支 ' + r.branch + '）'); }
    catch (e) { msg('失败：' + e.message); }
  });
  document.getElementById('rcSave').addEventListener('click', async () => {
    const c = readForm();
    if (!c.owner || !c.repo || !c.token) { msg('仓库用户、仓库名、令牌都要填'); return; }
    msg('校验中…');
    try {
      const info = await ghCheck(c);
      ghSetCfg(c);
      msg('已保存：' + info.full);
      setTimeout(() => location.reload(), 700);
    } catch (e) { msg('保存失败：' + e.message); }
  });
}
// ============ 从仓库同步到本地文件 ============
async function syncFromRepo() {
  if (typeof ghConfigured !== 'function' || !ghConfigured()) { alert('先在「仓库设置」里填仓库和令牌'); return; }
  if (!confirm('从仓库拉取 preset-teams.json，覆盖本地文件？\n（本地如果也有改动，会先自动备份）')) return;
  try {
    const cfg = ghGetCfg();
    const info = await ghReadFile(cfg, 'assets/data/preset-teams.json');
    if (!info || !info.content) { alert('仓库里找不到这个文件'); return; }
    const json = b64ToUtf8(info.content);
    const obj = JSON.parse(json);
    if (!obj || !Array.isArray(obj.teams)) { alert('仓库里的文件格式不对'); return; }
    DATA.presetTeams = obj.teams;
    await persistTeams();
    alert('已从仓库同步 ' + obj.teams.length + ' 个配队到本地文件');
    location.reload();
  } catch (e) {
    alert('同步失败：' + e.message);
  }
}

// ============ 配队数据源状态 ============
// 在管理员按钮旁显示当前保存在哪，并给一个「仓库设置」入口
// ===== 轻量提示：右上角浮层，几秒后自动消失（不打断操作）=====
function showToast(msg, kind) {
  try {
    var box = document.getElementById('toastBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toastBox';
      box.className = 'toast-box';
      document.body.appendChild(box);
    }
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () {
      el.className = 'toast out';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, 2600);
  } catch (e) {}
}

// ===== 云端同步状态提示 =====
let cloudSyncToastShown = false;
function onCloudSyncDone(r) {
  if (!r) return;
  // 只有管理员才提示同步状态：访客不涉及提交，不该看到任何同步信息
  var admin = (typeof isAdmin === "function") && isAdmin();
  if (!admin) return;
  if (!r.ok) {
    // 管理员也没配令牌（比如换了一台设备）-> 温和说明，不报错
    var configured = (typeof ghConfigured === "function") && ghConfigured();
    if (!configured) {
      if (typeof showToast === "function") showToast("本机未配置仓库令牌：改动只存在这台设备", "err");
    } else {
      if (typeof showToast === "function") showToast("云端同步失败：请检查网络或仓库令牌是否过期", "err");
    }
    if (typeof renderTeamStoreStatus === "function") renderTeamStoreStatus();
    return;
  }
  var more = r.count ? ("，共 " + r.count + " 支配队") : "";
  if (r.changed || !cloudSyncToastShown) {
    if (typeof showToast === "function") showToast("已与" + (r.source || "云端") + "同步" + more);
    cloudSyncToastShown = true;
  }
  if (typeof renderTeamStoreStatus === "function") renderTeamStoreStatus();
}

function renderTeamStoreStatus() {
  const host = document.getElementById('adminSlot');
  if (!host) return;
  // 这些是管理员的工具，访客不显示
  const admin = (typeof isAdmin === 'function') && isAdmin();
  if (!admin) {
    ['storeStatus', 'repoCfgBtn', 'repoSyncBtn', 'importLocalBtn'].forEach(id => {
      const n = document.getElementById(id);
      if (n) n.remove();
    });
    return;
  }
  let el = document.getElementById('storeStatus');
  if (!el) {
    el = document.createElement('span');
    el.id = 'storeStatus';
    el.className = 'store-status';
    host.insertBefore(el, host.firstChild);
  }
  const mode = (typeof TEAM_STORE !== 'undefined') ? TEAM_STORE.mode : '';
  const txt = (typeof teamStoreLabel === 'function') ? teamStoreLabel() : '';
  if (typeof TEAM_STORE !== "undefined" && TEAM_STORE.lastSync && TEAM_STORE.lastSync.ok) {
    el.textContent = txt + " · 已同步";
    el.title = "上次同步 " + new Date(TEAM_STORE.lastSync.at).toLocaleTimeString() + "（" + TEAM_STORE.lastSync.count + " 支配队）";
  } else if (typeof TEAM_STORE !== "undefined" && TEAM_STORE.lastSync && !TEAM_STORE.lastSync.ok) {
    el.textContent = txt + " · 未配置令牌";
  } else {
    el.textContent = txt + " · 读取中…";
  }
  el.classList.toggle('store-status-local', mode === 'local');
  if (!(typeof TEAM_STORE !== "undefined" && TEAM_STORE.lastSync)) el.title = (typeof TEAM_STORE !== 'undefined' && TEAM_STORE.lastError) ? TEAM_STORE.lastError : '数据文件：assets/data/preset-teams.json';
  const cfgReady = (typeof ghConfigured === 'function') && ghConfigured();
  // 仓库设置入口：线上编辑时用
  let repoBtn = document.getElementById('repoCfgBtn');
  if (!repoBtn) {
    repoBtn = document.createElement('button');
    repoBtn.id = 'repoCfgBtn';
    repoBtn.className = 'admin-btn';
    repoBtn.textContent = '仓库设置';
    repoBtn.addEventListener('click', () => openRepoConfig());
    host.insertBefore(repoBtn, el.nextSibling);
  }
  // 已配仓库时，给一个「从仓库同步」的入口（把线上那份拉回本地文件）
  let syncBtn = document.getElementById('repoSyncBtn');
  if (cfgReady && !syncBtn) {
    syncBtn = document.createElement('button');
    syncBtn.id = 'repoSyncBtn';
    syncBtn.className = 'admin-btn';
    syncBtn.textContent = '从仓库同步';
    syncBtn.title = '把仓库里的 preset-teams.json 拉下来覆盖本地文件';
    syncBtn.addEventListener('click', () => syncFromRepo());
    host.insertBefore(syncBtn, el.nextSibling);
  }
  if (!cfgReady && syncBtn) syncBtn.remove();
  if (mode === 'local') {
    let btn = document.getElementById('importLocalBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'importLocalBtn';
      btn.className = 'admin-btn';
      btn.textContent = '导入本地暂存';
      btn.addEventListener('click', () => pullLocalBackup());
      host.insertBefore(btn, el.nextSibling);
    }
  }
}

function renderTeams() {

  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  const count = document.getElementById('count');
  const btn = document.getElementById('newTeamBtn');

  // 按队伍标签筛选（元素 / 流派 / 强度 / 适用场合）
  const filterState = { element: 'all', style: 'all', power: 'all', scene: 'all' };
  // 每行把所有可选情况都列出来（和编辑页的选项一致）
  const FILTER_DEFS = [
    { key: 'element', label: '元素', get: t => (t.tags || {}).element || '', opts: Object.keys(ELEMENTS).map(k => ELEMENTS[k].name) },
    { key: 'style', label: '流派', get: t => (t.tags || {}).style || '', opts: ['普攻流', '技伤流', '绝招流', '印记流'] },
    { key: 'power', label: '强度', get: t => (t.tags || {}).power || '', opts: ['T0', 'T0.5', 'T1', 'T1.5', 'T2', 'T2.5', 'T3'] },
    { key: 'scene', label: '适用场合', get: t => teamScenes(t)[0] || '', opts: TEAM_SCENES }
  ];
  function allTeams() {
    const mine = loadTeams();
    const recs = (typeof loadPresetTeams === 'function') ? loadPresetTeams() : (DATA.presetTeams || []);
    return sortByPower(recs.concat(mine));
  }
  function matchFilter(t) {
    return FILTER_DEFS.every(d => {
      if (filterState[d.key] === 'all') return true;
      if (filterState[d.key] === '__none') return !d.get(t);
      if (d.key === 'scene') return teamScenes(t).indexOf(filterState[d.key]) >= 0;
      return d.get(t) === filterState[d.key];
    });
  }
  function renderFilterBar(list) {
    const bar = document.getElementById('teamFilters');
    if (!bar) return;
    const rows = FILTER_DEFS.map(d => {
      const opts = d.opts.map(v => ({ value: v, label: v }));
      const chips = [{ value: 'all', label: '全部' }].concat(opts).map(o =>
        '<button type="button" class="chip' + (filterState[d.key] === o.value ? ' active' : '') + '" data-key="' + d.key + '" data-v="' + escapeHtml(o.value) + '">' + escapeHtml(o.label) + '</button>'
      ).join('');
      return '<div class="filter-row"><span class="filter-label">' + d.label + '</span><div class="filter-chips">' + chips + '</div></div>';
    }).join('');
    bar.innerHTML = rows;
    bar.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
      filterState[c.dataset.key] = c.dataset.v;
      refresh();
    }));
  }

  function refresh() {
    const all = allTeams();
    renderFilterBar(all);
    const filtering = FILTER_DEFS.some(d => filterState[d.key] !== 'all');
    const list = all.filter(matchFilter);
    if (count) count.textContent = list.length;
    if (!list.length) {
      grid.style.display = 'none';
      if (empty) {
        empty.hidden = false;
        const txt = empty.querySelector('.empty-text');
        if (txt) txt.textContent = filtering ? '没有符合筛选条件的配队' : '还没有配队方案，点「新建配队」开始';
      }
      return;
    }
    grid.style.display = '';
    empty.hidden = true;
    grid.innerHTML = list.map(t => t.isRecommended ? renderPresetTeamCard(t) : renderUserTeamCard(t)).join('');
    if (!(typeof isAdmin === 'function' && isAdmin())) return;
    grid.querySelectorAll('.team-del').forEach(b => b.addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      const nm = b.dataset.name || '';
      if (confirm('确定删除「' + nm + '」吗？')) {
        deleteTeam(b.dataset.id);   // 立刻从内存移除并重绘，提交在后台进行
        refresh();
      }
    }));
  }
  if (btn) {
    if (typeof isAdmin === 'function' && !isAdmin()) btn.style.display = 'none';
    btn.addEventListener('click', async () => {
    const t = await createTeam();
    // 必须等提交落盘再跳转：新页面会重新从数据源加载，否则读到的还是旧数据（会显示找不到该配队）
    setStatus('正在创建…');
    await waitPendingWrites();
    location.href = 'team.html?id=' + t.id;
  });
  }
  refresh();
}

function renderUserTeamCard(t) {
  const chars = [0,1,2].map(i => (t.chars && t.chars[i]) ? getCharById(t.chars[i]) : null);
  const mains = [0,1,2].map(i => (t.mainPatterns && t.mainPatterns[i]) ? getPatternById(t.mainPatterns[i]) : null);
  const subs = [0,1,2].map(i => (t.subPatterns && t.subPatterns[i]) ? getPatternById(t.subPatterns[i]) : null);
  const charSlots = chars.map(c => c
    ? '<span class="ut-char" title="' + escapeHtml(c.name) + '">' + renderPortrait(c, 'ut-char-img') + '</span>'
    : '<span class="ut-char ut-empty">+</span>').join('');
  const patSlots = (arr, cls) => arr.map(p => p
    ? '<span class="ut-pat ' + cls + '">' + (p.portrait ? '<img loading="lazy" decoding="async" src="' + escapeHtml(p.portrait) + '" alt="">' : '') + '</span>'
    : '<span class="ut-pat ut-empty ' + cls + '"></span>').join('');
  const filled = chars.filter(Boolean).length;
  const potTotal = (t.pots || []).reduce((sum, p) => {
    if (!p) return sum;
    return sum + Object.values(p).reduce((s, v) => s + (Array.isArray(v) ? v.length : (typeof v === 'number' ? v : 0)), 0);
  }, 0);
  const tg = t.tags || {};
  const tagChips = [
    tg.element ? '<span class="ut-tag ut-tag-el">元素 · ' + escapeHtml(tg.element) + '</span>' : '',
    tg.style ? '<span class="ut-tag">流派 · ' + escapeHtml(tg.style) + '</span>' : '',
    tg.power ? '<span class="ut-tag ut-tag-pow">强度 · ' + escapeHtml(tg.power) + '</span>' : '',
    teamScenes(t).length ? '<span class="ut-tag ut-tag-scene">适用 · ' + escapeHtml(teamScenes(t).join(' / ')) + '</span>' : ''
  ].filter(Boolean).join('');
  return `
    <div class="team-card user-team">
      <a class="ut-link" href="team.html?id=${t.id}">
        <div class="team-card-head">
          <span class="team-card-name">${escapeHtml(t.name || '未命名配队')}</span>
          <span class="tier-badge tier-none">${filled}/3</span>
        </div>
        <div class="ut-chars">${charSlots}</div>
        <div class="ut-pats">
          <div class="ut-pat-row">${patSlots(mains, 'main')}</div>
          <div class="ut-pat-row">${patSlots(subs, 'sub')}</div>
        </div>
        <div class="ut-pot-total">潜能总等级 <b>${potTotal}</b></div>
        ${tagChips ? '<div class="ut-tags">' + tagChips + '</div>' : ''}
        ${t.presetCode ? '<div class="ut-code">✓ 已设置预设码</div>' : '<div class="ut-code ut-code-empty">未设置预设码</div>'}
      </a>
      ${(typeof isAdmin === 'function' && isAdmin())
        ? '<div class="ut-actions"><a class="team-edit-btn" href="team.html?id=' + t.id + '&edit=1">编辑</a>'
          + '<button class="team-del" data-id="' + t.id + '" data-name="' + escapeHtml(t.name || '') + '"' + (t.isRecommended ? ' data-preset="1"' : '') + '>删除</button>'
          + ''
          + '</div>'
        : '<div class="ut-actions"><a class="team-edit-btn" href="team.html?id=' + t.id + '">查看</a></div>'}
    </div>
  `;
}

// ============ 配队详情 / 编辑 ============
// 潜能数据兼容（旧结构 {流派:[名]} -> 新结构 {名:等级}）
function normPots(sel, char) {
  const out = {};
  if (!sel || !char) return out;
  Object.entries(sel).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      v.forEach(name => {
        const p = (char.potentials || []).find(x => x.name === name);
        if (p) out[name] = (p.flow && p.flow.indexOf('核心') >= 0) ? 1 : 6;
      });
    } else if (typeof v === 'number') {
      out[k] = v;
    }
  });
  return out;
}

// 潜能稀有度 → CSS 类名（核心=粉 / 彩=紫 / 金=金），旧数据没有 rarity 字段时按 type 推断
function potRarity(p) {
  if (!p) return 'common';
  if (p.rarity) return p.rarity;
  if (p.type === '核心潜能' || (p.flow && p.flow.indexOf('核心') >= 0)) return 'core';
  if (p.type === '彩潜能') return 'rare';
  return 'common';
}
function potRarityCls(p) { return 'rar-' + potRarity(p); }
// 稀有度角标（彩/金潜能有：Round 圆 / Diamond 菱形 / Triangle 三角）
function potCornerHtml(p) {
  const c = p && p.corner;
  if (!c) return '';
  const cls = { Round: 'round', Diamond: 'diamond', Triangle: 'triangle' }[c];
  return cls ? '<i class="pot-corner corner-' + cls + '"></i>' : '';
}

function elKeyByName(name) {
  for (const k of Object.keys(ELEMENTS)) if (ELEMENTS[k].name === name) return k;
  return 'none';
}

function renderTeam() {
  const id = getUrlParam('id');
  const root = document.getElementById('content');
  if (!getTeamAny(id)) { root.innerHTML = notFound('未找到该配队', 'teams.html', '返回配队方案'); return; }

  function render() {
    const isEdit = getUrlParam('edit') === '1' && (typeof isAdmin === 'function' && isAdmin());
    const t = getTeamAny(id);
    const isPreset = !isOwnTeam(id);
    const isEditedPreset = false;   // 现在改动直接写进 json，不再有本地覆盖层
    document.title = (t.name || '配队') + ' - 星塔旅人配队一览';
    const chars = [0,1,2].map(i => (t.chars && t.chars[i]) ? getCharById(t.chars[i]) : null);
    const mains = [0,1,2].map(i => (t.mainPatterns && t.mainPatterns[i]) ? getPatternById(t.mainPatterns[i]) : null);
    const subs = [0,1,2].map(i => (t.subPatterns && t.subPatterns[i]) ? getPatternById(t.subPatterns[i]) : null);
    const mainBk = [0,1,2,3,4].map(i => (t.mainBackup && t.mainBackup[i]) ? getPatternById(t.mainBackup[i]) : null);
    const subBk = [0,1,2,3,4].map(i => (t.subBackup && t.subBackup[i]) ? getPatternById(t.subBackup[i]) : null);
    const rawPots = t.pots || [{}, {}, {}];
    const potsArr = [0,1,2].map(i => normPots(rawPots[i], chars[i]));
    const tg = t.tags || {};
    const scenes = teamScenes(t);

    const charRow = (c, i) => {
      const sel = potsArr[i] || {};
      const keys = Object.keys(sel);
      const potIcons = keys.map(name => {
        const p = c ? (c.potentials || []).find(x => x.name === name) : null;
        const lv = sel[name];
        const isCore = !!(p && p.flow && p.flow.indexOf('核心') >= 0);
        const inner = '<span class="bpot-icon ' + potRarityCls(p) + '">' + (p && p.icon ? '<img class="bpot-img" src="' + escapeHtml(p.icon) + '" alt="" loading="lazy">' : '<span class="bpot-ph">♪</span>') + potCornerHtml(p) + '<i class="bpot-lv">' + lv + '</i></span>' + '<span class="bpot-name">' + escapeHtml(name) + '</span>';
        return isEdit
          ? '<button class="bpot" data-idx="' + i + '" data-name="' + escapeHtml(name) + '"' + (isCore ? ' data-core="1"' : '') + ' title="点击调整等级">' + inner + '</button>'
          : '<span class="bpot">' + inner + '</span>';
      }).join('');
      return `
        <div class="build-row">
          <div class="build-char${isEdit ? ' editable' : ''}" data-idx="${i}"${isEdit ? ' title="点击更换旅人"' : ''}>
            ${c ? '<span class="bc-avatar">' + renderPortrait(c, 'bc-img') + '<i class="bc-pot-count">' + keys.length + '</i></span>' + '<div class="bc-name">' + escapeHtml(c.name) + '</div><div class="bc-sub">' + escapeHtml(roleName(c.role)) + '</div>'
                : '<div class="es-empty">＋<br>选择旅人</div>'}
          </div>
          <div class="build-pots">
            ${c ? potIcons : ''}
            ${(c && isEdit) ? '<button class="bpot-add" data-idx="' + i + '" title="编配潜能">＋</button>' : ''}
            ${(c && isEdit && !keys.length) ? '<span class="pots-hint">点 ＋ 编配该旅人的潜能</span>' : ''}
          </div>
        </div>`;
    };

    const patSlot = (p, i, kind) => `
      <div class="edit-slot${isEdit ? ' editable' : ''}" data-kind="${kind}" data-idx="${i}">
        ${p ? (p.portrait ? '<img loading="lazy" decoding="async" class="es-img es-img-pat" src="' + escapeHtml(p.portrait) + '" alt="">' : '') + '<div class="es-name">' + escapeHtml(p.name) + '</div>'
            : '<div class="es-empty">＋ 选择秘纹</div>'}
      </div>`;

    const backupRow = (arr, kind) => `
      <div class="backup-list">
        ${arr.map((p, i) => `
          <div class="edit-slot backup-slot${isEdit ? ' editable' : ''}${p ? ' filled' : ' backup-empty'}" data-kind="${kind}" data-idx="${i}">
            ${p ? (isEdit ? '<i class="es-del" title="删除这个备选">✕</i>' : '') + (p.portrait ? '<img loading="lazy" decoding="async" class="es-img es-img-pat" src="' + escapeHtml(p.portrait) + '" alt="">' : '') + '<div class="es-name">' + escapeHtml(p.name) + '</div>'
                : '<div class="es-empty">备选</div>'}
          </div>`).join('')}
      </div>`;

    const tagText = [
      tg.element ? '<span class="ut-tag ut-tag-el">元素 · ' + escapeHtml(tg.element) + '</span>' : '',
      tg.style ? '<span class="ut-tag">流派 · ' + escapeHtml(tg.style) + '</span>' : '',
      tg.power ? '<span class="ut-tag ut-tag-pow">强度 · ' + escapeHtml(tg.power) + '</span>' : '',
      teamScenes(t).length ? '<span class="ut-tag ut-tag-scene">适用 · ' + escapeHtml(teamScenes(t).join(' / ')) + '</span>' : ''
    ].filter(Boolean).join('');

    const tagEditor = `
      <div class="tag-edit">
        <div class="tag-item">
          <label>元素</label>
          <div class="dd" id="ddElement">
            <button type="button" class="dd-btn" id="ddElBtn">${tg.element ? elIcon(elKeyByName(tg.element)) + '<span>' + escapeHtml(tg.element) + '</span>' : '<span class="dd-ph">未设置</span>'}</button>
            <div class="dd-menu">
              <button type="button" class="dd-opt" data-v="">未设置</button>
              ${Object.entries(ELEMENTS).map(([v, o]) => '<button type="button" class="dd-opt" data-v="' + o.name + '">' + elIcon(v) + '<span>' + o.name + '</span></button>').join('')}
            </div>
          </div>
        </div>
        <div class="tag-item">
          <label>流派</label>
          <select id="tagStyle" class="tag-select">
            <option value="">未设置</option>
            ${['普攻流','技伤流','绝招流','印记流'].map(o => '<option' + (tg.style === o ? ' selected' : '') + '>' + o + '</option>').join('')}
          </select>
        </div>
        <div class="tag-item">
          <label>强度</label>
          <select id="tagPower" class="tag-select">
            <option value="">未设置</option>
            ${['T0','T0.5','T1','T1.5','T2','T2.5','T3'].map(o => '<option' + (tg.power === o ? ' selected' : '') + '>' + o + '</option>').join('')}
          </select>
        </div>
        <div class="tag-item">
          <label>适用场合</label>
          <div class="dd" id="ddScene">
            <button type="button" class="dd-btn" id="ddSceneBtn">${scenes.length ? '<span>' + escapeHtml(scenes.join(' / ')) + '</span>' : '<span class="dd-ph">未设置</span>'}</button>
            <div class="dd-menu">
              ${TEAM_SCENES.map(o => '<label class="dd-opt dd-check"><input type="checkbox" data-scene="' + o + '"' + (scenes.indexOf(o) >= 0 ? ' checked' : '') + '><span>' + o + '</span></label>').join('')}
            </div>
          </div>
        </div>
      </div>`;

    root.innerHTML = `
      <a href="teams.html" class="back-link">← 返回配队方案</a>
      <div class="team-edit-head">
        ${isEdit
          ? '<input class="team-name-input" id="teamName" value="' + escapeHtml(t.name || '') + '" placeholder="配队名称">'
          : '<h1 class="team-title">' + escapeHtml(t.name || '未命名配队') + '</h1>'}
        ${isEdit
          ? '<button class="btn" id="saveBtn">保存</button><button class="btn-secondary" id="cancelEditBtn">取消编辑</button>'
          : ((typeof isAdmin === 'function' && isAdmin()) ? '<a class="btn" href="team.html?id=' + id + '&edit=1">编辑</a>' : '')}
        ${(typeof isAdmin === 'function' && isAdmin()) ? '<button class="btn-secondary" id="delBtn">删除配队</button>' : ''}

      </div>
      ${isEdit ? '<p class="local-edit-hint">改动会直接保存到 <b>assets/data/preset-teams.json</b>（' + teamStoreLabel() + '）</p>' : ''}
      <section class="section">
        <h2 class="section-title">队伍简介</h2>
        ${isEdit
          ? '<textarea class="team-desc-input" id="teamDesc" maxlength="500" placeholder="介绍这个队伍的玩法、适用场景、操作要点等（最多 500 字）">' + escapeHtml(t.description || '') + '</textarea><div class="desc-count"><span id="descCount">' + (t.description || '').length + '</span> / 500</div>'
          : (t.description ? '<div class="team-desc-view">' + escapeHtml(t.description).replace(/\n/g, '<br>') + '</div>' : '<div class="team-desc-view empty">暂无简介</div>')}
      </section>
      <section class="section">
        <h2 class="section-title">上场旅人 &amp; 潜能</h2>
        <div class="build-list">${chars.map((c, i) => charRow(c, i)).join('')}</div>
      </section>
      <section class="section">
        <h2 class="section-title">主位秘纹</h2>
        <div class="slot-row">${mains.map((p, i) => patSlot(p, i, 'main')).join('')}</div>
        <div class="backup-title">主位备选秘纹 <em>（上限 5 个）</em></div>
        ${backupRow(mainBk, 'mainBk')}
      </section>
      <section class="section">
        <h2 class="section-title">辅位秘纹</h2>
        <div class="slot-row">${subs.map((p, i) => patSlot(p, i, 'sub')).join('')}</div>
        <div class="backup-title">辅位备选秘纹 <em>（上限 5 个）</em></div>
        ${backupRow(subBk, 'subBk')}
      </section>
      <section class="section">
        <h2 class="section-title">队伍标签</h2>
        ${isEdit ? tagEditor : (tagText ? '<div class="ut-tags">' + tagText + '</div>' : '<div class="team-desc-view empty">暂无标签</div>')}
      </section>
      <section class="section">
        <h2 class="section-title">预设码</h2>
        ${isEdit
          ? '<div class="preset-box"><input class="preset-input" id="presetInput" value="' + escapeHtml(t.presetCode || '') + '" placeholder="粘贴游戏内预设码，或点右侧一键生成"><button class="copy-btn" id="presetImport">一键导入</button><button class="copy-btn" id="presetGen">一键生成</button></div>'
          : '<div class="preset-box"><input class="preset-input" id="presetInput" value="' + escapeHtml(t.presetCode || '') + '" readonly placeholder="未设置预设码"><button class="copy-btn" id="presetCopy">复制</button></div>'}
      </section>
    `;

    // 读写当前配队：推荐配队的改动会自动落到本地覆盖层
    const cur = () => getTeamAny(id) || {};
    const save = patch => saveTeamEdit(id, patch);

    if (isEdit) {
      const descEl = document.getElementById('teamDesc');
      if (descEl) {
        descEl.addEventListener('input', () => { const c = document.getElementById('descCount'); if (c) c.textContent = descEl.value.length; });
        descEl.addEventListener('change', () => { save({ description: descEl.value }); });
      }
      [['tagStyle','style'], ['tagPower','power']].forEach(pair => {
        const el = document.getElementById(pair[0]);
        if (el) el.addEventListener('change', () => {
          const tgg = Object.assign({}, cur().tags || {});
          tgg[pair[1]] = el.value;
          save({ tags: tgg });
        });
      });
      const ddEl = document.getElementById('ddElement');
      if (ddEl) {
        const btn = document.getElementById('ddElBtn');
        btn.addEventListener('click', ev2 => { ev2.stopPropagation(); ddEl.classList.toggle('open'); });
        ddEl.querySelectorAll('.dd-opt').forEach(o => o.addEventListener('click', ev2 => {
          ev2.stopPropagation();
          const tgg = Object.assign({}, cur().tags || {});
          tgg.element = o.dataset.v;
          save({ tags: tgg });
          render();
        }));
      }
      // 适用场合：复选框，勾选即保存
      const ddScene = document.getElementById('ddScene');
      if (ddScene) {
        const sBtn = document.getElementById('ddSceneBtn');
        sBtn.addEventListener('click', ev2 => { ev2.stopPropagation(); ddScene.classList.toggle('open'); });
        ddScene.querySelectorAll('input[data-scene]').forEach(cb => cb.addEventListener('change', ev2 => {
          ev2.stopPropagation();
          const picked = [];
          ddScene.querySelectorAll('input[data-scene]').forEach(x => { if (x.checked) picked.push(x.dataset.scene); });
          const tgg = Object.assign({}, cur().tags || {});
          tgg.scene = picked;
          save({ tags: tgg });
          render();
        }));
      }
      const nameEl = document.getElementById('teamName');
      if (nameEl) nameEl.addEventListener('change', async () => {
        await save({ name: nameEl.value.trim() || '未命名配队' });
        showToast('队名已保存', 'ok');
      });
      const presetEl = document.getElementById('presetInput');
      if (presetEl) presetEl.addEventListener('change', () => { save({ presetCode: presetEl.value.trim() }); });
      const genBtn = document.getElementById('presetGen');
      if (genBtn) genBtn.addEventListener('click', () => {
        const r = teamToPresetCode(cur());
        if (!r.code || !/[^A]/.test(r.code.slice(6))) {
          alert('还生成不了：' + (r.missing.length ? r.missing.join('；') : '请先选好 3 名旅人'));
          return;
        }
        presetEl.value = r.code;
        save({ presetCode: r.code });
        if (presetEl.select) { try { presetEl.select(); } catch (e) {} }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(r.code).then(
            () => setStatus('已生成预设码并复制到剪贴板' + (r.missing.length ? '（注意：' + r.missing.join('；') + '）' : '')),
            () => setStatus('已生成预设码' + (r.missing.length ? '（注意：' + r.missing.join('；') + '）' : ''))
          );
        } else {
          setStatus('已生成预设码' + (r.missing.length ? '（注意：' + r.missing.join('；') + '）' : ''));
        }
      });

      root.querySelectorAll('.build-char.editable').forEach(el => el.addEventListener('click', () => {
        const i = parseInt(el.dataset.idx, 10);
        const used = (cur().chars || []).filter((x, idx) => x && idx !== i);
        openPicker('选择旅人', DATA.characters,
          c => renderPortrait(c, 'pk-img') + '<span>' + escapeHtml(c.name) + '</span><em>' + elementName(c.element) + ' ' + roleName(c.role) + '</em>',
          c => {
            const arr = (cur().chars || [null, null, null]).slice(); arr[i] = c.id;
            const pots = (cur().pots || [{},{},{}]).slice(); pots[i] = {};
            save({ chars: arr, pots: pots }); render();
          }, { exclude: used });
      }));

      root.querySelectorAll('.bpot').forEach(el => el.addEventListener('click', ev => {
        ev.stopPropagation();
        const i = parseInt(el.dataset.idx, 10), name = el.dataset.name, isCore = el.dataset.core === '1';
        const curLv = normPots((cur().pots || [])[i], getCharById((cur().chars || [])[i]))[name] || 6;
        openLvPicker(name, curLv, isCore, lv => {
          const pots = (cur().pots || [{},{},{}]).map((x, idx) => idx === i ? normPots(x, getCharById((cur().chars || [])[idx])) : x);
          pots[i][name] = lv;
          save({ pots: pots });
          render();
        });
      }));

      root.querySelectorAll('.bpot-add').forEach(el => el.addEventListener('click', ev => {
        ev.stopPropagation();
        const i = parseInt(el.dataset.idx, 10);
        const c = getCharById((cur().chars || [])[i]);
        if (!c) return;
        openPotPicker(c, normPots((cur().pots || [])[i], c), i === 0, sel => {
          const pots = (cur().pots || [{},{},{}]).map((x, idx) => idx === i ? normPots(x, getCharById((cur().chars || [])[idx])) : x);
          pots[i] = sel;
          save({ pots: pots });
          render();
        });
      }));

      // 所有秘纹槽位（主位 / 主位备选 / 辅位 / 辅位备选）互斥：已放在别处的秘纹在弹窗里显示为已用
      const usedEverywhere = skip => {
        const out = [];
        ['mainPatterns', 'mainBackup', 'subPatterns', 'subBackup'].forEach(k => {
          (cur()[k] || []).forEach((x, idx) => {
            if (x && !(skip && skip.k === k && skip.i === idx)) out.push(x);
          });
        });
        return out;
      };
      const pickMain = (kind, key, i, max) => {
        const used = usedEverywhere({ k: key, i: i });
        const isBk = (key === 'mainBackup' || key === 'subBackup');
        openPicker(kind === 'main' || kind === 'mainBk' ? (kind === 'main' ? '选择主位秘纹' : '选择主位备选秘纹') : (kind === 'sub' ? '选择辅位秘纹' : '选择辅位备选秘纹'), DATA.patterns,
          p => (p.portrait ? '<img loading="lazy" decoding="async" class="pk-img pk-img-pat" src="' + escapeHtml(p.portrait) + '">' : '') + '<span>' + escapeHtml(p.name) + '</span><em>' + (p.funcs || []).join('/') + '</em>',
          list => {
            const arr = (cur()[key] || []).slice();
            const n = isBk ? 5 : 3;
            while (arr.length < n) arr.push(null);
            const picked = (list || []).map(p => p.id);
            for (let k = 0; k < n; k++) arr[k] = picked[k] || null;
            // 兜底：万一同组里出现重复，只保留第一个
            const seen = {};
            for (let k = 0; k < arr.length; k++) {
              if (!arr[k]) continue;
              if (seen[arr[k]]) arr[k] = null; else seen[arr[k]] = 1;
            }
            save({ [key]: arr }); render();
          },
          { exclude: used, multi: true, max: max });
      };
      root.querySelectorAll('.edit-slot.editable').forEach(el => el.addEventListener('click', ev => {
        const kind = el.dataset.kind, i = parseInt(el.dataset.idx, 10);
        const isBk = (kind === 'mainBk' || kind === 'subBk');
        // 点 ✕ = 删除这个秘纹（只清空槽位，不动秘纹数据）
        if (isBk && ev.target.closest('.es-del')) {
          ev.stopPropagation();
          const key = kind === 'mainBk' ? 'mainBackup' : 'subBackup';
          const arr = (cur()[key] || []).slice();
          arr[i] = null;
          save({ [key]: arr });
          render();
          return;
        }
        if (kind === 'main') pickMain('main', 'mainPatterns', i, 3);
        else if (kind === 'sub') pickMain('sub', 'subPatterns', i, 3);
        else if (kind === 'mainBk') pickMain('mainBk', 'mainBackup', i, 5);
        else if (kind === 'subBk') pickMain('subBk', 'subBackup', i, 5);
      }));

      const importBtn = document.getElementById('presetImport');
      if (importBtn) importBtn.addEventListener('click', () => {
        const code = document.getElementById('presetInput').value.trim();
        if (!code) { alert('请先粘贴预设码'); return; }
        const res = applyPreset(code, id);
        alert(res.msg);
        if (res.ok) render();
      });
      // 推荐配队：把本地改动写回 preset-teams.json（选过一次文件后就是一键覆盖）
      const saveBtn = document.getElementById('saveBtn');
      if (saveBtn) saveBtn.addEventListener('click', async () => {
        const patch = {};
        const ne = document.getElementById('teamName');
        if (ne) patch.name = ne.value.trim() || '未命名配队';
        const de = document.getElementById('teamDesc');
        if (de) patch.description = de.value;
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中…';
        try {
          await save(patch);                 // 等数据真的写进去
          await waitPendingWrites();         // 提交也要等，避免下一页读到旧数据
          showToast('已保存', 'ok');
          const sp = new URLSearchParams(location.search);
          sp.delete('edit');
          location.search = sp.toString();   // 回到队伍详情页
        } catch (e) {
          // 写入失败：按钮恢复，让用户可以重试（改动已存在本机，不会丢）
          saveBtn.disabled = false;
          saveBtn.textContent = '保存';
          showToast('保存失败：' + (e && e.message ? e.message : '未知错误'), 'err');
        }
      });
    } else {
      const copyBtn = document.getElementById('presetCopy');
      if (copyBtn) copyBtn.addEventListener('click', () => {
        const v = document.getElementById('presetInput').value;
        if (!v) { alert('未设置预设码'); return; }
        copyToClipboard(v);
      });
    }

    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      const sp = new URLSearchParams(location.search);
      sp.delete('edit');
      location.search = sp.toString();   // 退出编辑，回到详情页
    });

    const delBtn = document.getElementById('delBtn');
    if (delBtn) delBtn.addEventListener('click', () => {
      const nm = cur().name || '这个配队';
      if (confirm('确定删除「' + nm + '」吗？')) {
        deleteTeam(id);
        location.href = 'teams.html';   // 立刻返回列表，提交在后台进行
      }
    });

  }
  render();
}

function openPicker(title, items, html, onPick, opts) {
  opts = opts || {};
  const multi = !!opts.multi;
  const maxPick = opts.max || 3;
  const old = document.getElementById('pickerModal'); if (old) old.remove();
  const exclude = opts.exclude || [];
  const picked = [];
  const state = { element: 'all', rarity: 'all', q: '' };
  const modal = document.createElement('div');
  modal.id = 'pickerModal';
  modal.className = 'picker-modal';
  const elChips = Object.entries(ELEMENTS).map(([v]) => '<button class="chip" data-v="' + v + '">' + elIcon(v) + '</button>').join('') + '<button class="chip" data-v="none">' + elIcon('none') + '</button>';
  const starChips = [5,4,3].map(n => '<button class="chip" data-v="' + n + '">' + renderStars(n) + '</button>').join('');
  modal.innerHTML = `
    <div class="picker-panel">
      <div class="picker-head"><span>${escapeHtml(title)}${multi ? ' <em class="pick-multi-hint">（可多选，最多 ' + maxPick + ' 个）</em>' : ''}</span><button class="picker-close">✕</button></div>
      <div class="picker-filters">
        <div class="pf-row"><span class="pf-label">属性</span><div class="pf-chips" data-key="element"><button class="chip active" data-v="all">全部</button>${elChips}</div></div>
        <div class="pf-row"><span class="pf-label">星级</span><div class="pf-chips" data-key="rarity"><button class="chip active" data-v="all">全部</button>${starChips}</div></div>
      </div>
      <input class="picker-search" placeholder="搜索名称…">
      <div class="picker-list" id="pickerList"></div>
      ${multi ? '<div class="picker-foot"><span class="pick-count" id="pickCount">已选 0 / ' + maxPick + '</span><button class="btn" id="pickOk">确定</button></div>' : ''}
    </div>`;
  document.body.appendChild(modal);

  function renderList() {
    const list = items.filter(it => {
      if (state.element !== 'all' && (it.element || 'none') !== state.element) return false;
      if (state.rarity !== 'all' && it.rarity !== parseInt(state.rarity, 10)) return false;
      if (state.q) {
        const lab = ((it.name || '') + (it.nameEn || '')).toLowerCase();
        if (!lab.includes(state.q)) return false;
      }
      return true;
    });
    const listEl = document.getElementById('pickerList');
    listEl.innerHTML = list.map(it => {
      const used = exclude.indexOf(it.id) >= 0;
      const on = picked.indexOf(it.id) >= 0;
      return '<button class="picker-item' + (used ? ' used' : '') + (on ? ' picked' : '') + '" data-id="' + escapeHtml(it.id) + '"' + (used ? ' disabled' : '') + '>' + html(it) + (used ? '<em class="pk-used">已用</em>' : (on ? '<em class="pk-picked">✓</em>' : '')) + '</button>';
    }).join('') || '<div class="picker-empty">没有符合条件的项</div>';
    listEl.querySelectorAll('.picker-item:not(.used)').forEach(b => b.addEventListener('click', () => {
      const it = items.find(x => x.id === b.dataset.id);
      if (!it) return;
      if (multi) {
        const idx = picked.indexOf(it.id);
        if (idx >= 0) picked.splice(idx, 1);
        else {
          if (picked.length >= maxPick) { alert('最多选 ' + maxPick + ' 个'); return; }
          picked.push(it.id);
        }
        const pc = document.getElementById('pickCount');
        if (pc) pc.textContent = '已选 ' + picked.length + ' / ' + maxPick;
        renderList();
      } else { onPick(it); modal.remove(); }
    }));
  }
  modal.querySelectorAll('.pf-chips').forEach(row => row.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    row.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    b.classList.add('active');
    state[row.dataset.key] = b.dataset.v;
    renderList();
  }));
  modal.querySelector('.picker-search').addEventListener('input', e => { state.q = e.target.value.trim().toLowerCase(); renderList(); });
  modal.querySelector('.picker-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  const okBtn = document.getElementById('pickOk');
  if (okBtn) okBtn.addEventListener('click', () => {
    if (!picked.length) { alert('请至少选择 1 个'); return; }
    onPick(picked.map(id => items.find(x => x.id === id)).filter(Boolean));
    modal.remove();
  });
  renderList();
}

// ============ 潜能等级选择 ============
function openLvPicker(name, cur, isCore, onPick) {
  const old = document.getElementById('lvModal'); if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'lvModal';
  modal.className = 'picker-modal';
  const btns = isCore
    ? '<button class="lv-btn on" data-lv="1">1</button>'
    : [1,2,3,4,5,6].map(n => '<button class="lv-btn' + (n === cur ? ' on' : '') + '" data-lv="' + n + '">' + n + '</button>').join('');
  modal.innerHTML = '<div class="lv-panel">' +
    '<div class="lv-title">' + escapeHtml(name) + '</div>' +
    '<div class="lv-hint">' + (isCore ? '核心潜能固定 1 级' : '选择潜能等级') + '</div>' +
    '<div class="lv-grid">' + btns + '</div>' +
    '<button class="btn-secondary" id="lvClose">关闭</button></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#lvClose').addEventListener('click', () => modal.remove());
  modal.querySelectorAll('.lv-btn').forEach(b => b.addEventListener('click', () => { onPick(parseInt(b.dataset.lv, 10)); modal.remove(); }));
}

function openPotPicker(char, selected, isFront, onSave) {
  const old = document.getElementById('potModal'); if (old) old.remove();
  const CORE = ['前排核心', '后排核心'];
  const flowOrder = isFront ? ['前排核心', '前排特有', '通用'] : ['后排核心', '后排特有', '通用'];
  const isCoreFlow = f => CORE.indexOf(f) >= 0;
  const sel = Object.assign({}, selected || {});
  const allPots = char.potentials || [];
  const isCoreName = n => { const p = allPots.find(x => x.name === n); return p && isCoreFlow(p.flow); };
  const coreCount = () => Object.keys(sel).filter(isCoreName).length;
  let savedScroll = 0;

  function buildBody() {
    return flowOrder.map(f => {
      const items = allPots.filter(p => p.flow === f);
      if (!items.length) return '';
      const core = isCoreFlow(f);
      const cells = items.map(p => {
        const on = sel[p.name] != null;
        const lv = sel[p.name];
        let lvCtl = '';
        if (on) {
          lvCtl = core
            ? '<span class="pot-lv-fixed">固定 1 级</span>'
            : '<select class="pot-lv-select" data-name="' + escapeHtml(p.name) + '">' + [1,2,3,4,5,6].map(n => '<option value="' + n + '"' + (n === lv ? ' selected' : '') + '>' + n + ' 级</option>').join('') + '</select>';
        }
        return '<div class="pot-cell' + (on ? ' on' : '') + '" data-flow="' + escapeHtml(f) + '" data-name="' + escapeHtml(p.name) + '">' +
          '<span class="pot-cell-icon ' + potRarityCls(p) + '">' + (p.icon ? '<img class="pot-cell-img" src="' + escapeHtml(p.icon) + '" alt="" loading="lazy">' : '<span class="pot-cell-ph">♪</span>') + (on ? '<i class="pot-cell-badge">' + lv + '</i>' : '') + '</span>' +
          '<span class="pot-cell-name">' + escapeHtml(p.name) + '</span>' + lvCtl + '</div>';
      }).join('');
      return '<div class="pot-group"><div class="pot-group-title">' + escapeHtml(f) + ' <em class="core-hint">' + (core ? '(限选 2 · 固定 1 级)' : '(可选 1-6 级)') + '</em></div><div class="pot-grid2">' + cells + '</div></div>';
    }).join('');
  }

  const modal = document.createElement('div');
  modal.id = 'potModal';
  modal.className = 'picker-modal';
  modal.innerHTML = '<div class="picker-panel">' +
    '<div class="picker-head"><span>' + escapeHtml(char.name) + ' · 潜能编配（' + (isFront ? '前排' : '后排') + '）</span><button class="picker-close">✕</button></div>' +
    '<div class="pot-body" id="potBody">' + buildBody() + '</div>' +
    '<div class="pot-foot"><span class="pot-hint">' + (isFront ? '前排角色可选：前排核心 / 前排特有 / 通用' : '后排角色可选：后排核心 / 后排特有 / 通用') + '；核心限选 2 个且固定 1 级，其余可调 1-6 级</span><button class="btn" id="potSave">确定</button></div>' +
    '</div>';
  document.body.appendChild(modal);

  function bindBody() {
    const bodyEl = document.getElementById('potBody');
    bodyEl.querySelectorAll('.pot-cell').forEach(cell => cell.addEventListener('click', ev => {
      if (ev.target.closest('.pot-lv-select')) return;
      const f = cell.dataset.flow, name = cell.dataset.name;
      if (sel[name] != null) delete sel[name];
      else {
        const core = isCoreFlow(f);
        if (core && coreCount() >= 2) { alert('核心潜能最多选 2 个'); return; }
        sel[name] = core ? 1 : 6;
      }
      savedScroll = bodyEl.scrollTop;
      bodyEl.innerHTML = buildBody();
      bindBody();
      bodyEl.scrollTop = savedScroll;
    }));
    bodyEl.querySelectorAll('.pot-lv-select').forEach(sl => {
      sl.addEventListener('click', ev => ev.stopPropagation());
      sl.addEventListener('change', () => { sel[sl.dataset.name] = parseInt(sl.value, 10); });
    });
  }
  bindBody();
  modal.querySelector('.picker-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#potSave').addEventListener('click', () => { onSave(sel); modal.remove(); });
}

// ============ 预设码：解包 / 生成 ============
// 生成：把当前配队（3 名旅人 + 已选潜能及等级）编码成游戏内可用的预设码。
// 位布局与 unpackPreset 严格对应，已用 23 个真实游戏预设码做过往返验证。
function packPreset(entries) {
  const bits = [];
  const w = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  entries.forEach(e => w((e.charId || 0) >>> 0, 32));
  const packP = (sel, ids, special) => {
    for (const id of (ids || [])) {
      if (special) { w(sel[id] != null ? 1 : 0, 1); }
      else {
        let lv = sel[id] != null ? (parseInt(sel[id], 10) || 1) : 0;
        if (lv > 7) lv = 7;
        w(lv, 3);
      }
    }
  };
  entries.forEach((e, k) => {
    const cfg = DATA.potentialCfg && DATA.potentialCfg.chars[String(e.charId)];
    if (!cfg) return;
    if (k === 0) { packP(e.sel, cfg.mainCore, true); packP(e.sel, cfg.mainNormal, false); }
    else { packP(e.sel, cfg.assistCore, true); packP(e.sel, cfg.assistNormal, false); }
    packP(e.sel, cfg.common, false);
  });
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
    bytes.push(b);
  }
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s);
}

// 把队伍数据（chars + pots）转成预设码；missing 是没配全的部分
function teamToPresetCode(team) {
  const missing = [];
  const entries = [0, 1, 2].map(i => {
    const cid = (team.chars || [])[i];
    const ch = cid ? DATA.characters.find(c => c.id === cid) : null;
    if (!ch) missing.push('第 ' + (i + 1) + ' 名旅人未选');
    const sel = {};
    const potSel = (team.pots || [])[i] || {};
    Object.keys(potSel).forEach(nm => {
      const p = (ch && ch.potentials || []).find(x => x.name === nm);
      if (p && p.potId != null) sel[p.potId] = potSel[nm];
      else if (ch) missing.push(ch.name + ' 的「' + nm + '」找不到编号，已跳过');
    });
    if (ch && !Object.keys(sel).length) missing.push(ch.name + ' 还没配潜能');
    return { charId: ch ? ch.sid : 0, sel: sel };
  });
  if (!DATA.potentialCfg) return { code: '', missing: ['缺少预设码字典'] };
  return { code: packPreset(entries), missing: missing };
}

// ============ 预设码解包 / 一键导入 ============
function unpackPreset(code) {
  const cfgData = DATA.potentialCfg;
  if (!cfgData) return null;
  let b64 = String(code).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/=]/g, '');
  while (b64.length % 4 !== 0) b64 += '=';
  let raw;
  try { raw = atob(b64); } catch (e) { return null; }
  const bits = [];
  for (let i = 0; i < raw.length; i++) { const b = raw.charCodeAt(i); for (let j = 7; j >= 0; j--) bits.push((b >> j) & 1); }
  let bi = 0;
  const rb = n => { let v = 0; for (let i = 0; i < n; i++) { if (bi >= bits.length) return null; v = v * 2 + bits[bi++]; } return v; };
  const res = [];
  for (let i = 0; i < 3; i++) { const id = rb(32); if (id === null) return null; res.push({ charId: id, pots: [] }); }
  const unpackP = (arr, ids, special) => {
    for (const id of (ids || [])) {
      if (special) { if (rb(1) === 1) arr.push({ id: id, level: 1 }); }
      else { const lv = rb(3); if (lv > 0) arr.push({ id: id, level: lv }); }
    }
  };
  for (let k = 0; k < 3; k++) {
    const e = res[k], cfg = cfgData.chars[String(e.charId)];
    if (!cfg) continue;
    if (k === 0) { unpackP(e.pots, cfg.mainCore, true); unpackP(e.pots, cfg.mainNormal, false); }
    else { unpackP(e.pots, cfg.assistCore, true); unpackP(e.pots, cfg.assistNormal, false); }
    unpackP(e.pots, cfg.common, false);
  }
  return res;
}

function applyPreset(code, teamId) {
  const r = unpackPreset(code);
  if (!r) return { ok: false, msg: '预设码格式错误' };
  const chars = [null, null, null];
  const pots = [{}, {}, {}];
  let found = 0;
  r.forEach((e, i) => {
    const ch = DATA.characters.find(c => c.sid === e.charId);
    if (!ch) return;
    chars[i] = ch.id;
    found++;
    const sel = {};
    (e.pots || []).forEach(p => {
      const nm = DATA.potentialCfg.pots[p.id];
      const cp = (ch.potentials || []).find(x => x.name === nm);
      if (cp) sel[cp.name] = p.level || 1;
    });
    pots[i] = sel;
  });
  if (!found) return { ok: false, msg: '未识别到旅人（可能是外服预设码）' };
  // 用 saveTeamEdit：我的配队走 localStorage，推荐配队走本地覆盖层（直接调 updateTeam 会静默失败）
  saveTeamEdit(teamId, { chars: chars, pots: pots, presetCode: code });
  return { ok: true, msg: '已导入 ' + found + ' 名旅人及其潜能' };
}

// ============ 秘纹图鉴 ============
function renderPatterns() {
  const funcs = [...new Set(DATA.patterns.flatMap(p => p.funcs || []))];
  const defs = [
    { key: 'notes', label: '音符', kind: 'array', options: [{ value: 'all', label: '全部' }].concat(Object.entries(NOTE_TYPES).map(([v, n]) => ({ value: v, label: n, html: noteIcon(v) }))) },
    { key: 'rarity', label: '品质', kind: 'int', options: [{ value: 'all', label: '全部' }, { value: '5', label: '5星', html: renderStars(5) }, { value: '4', label: '4星', html: renderStars(4) }, { value: '3', label: '3星', html: renderStars(3) }] },
    { key: 'element', label: '属性', options: [{ value: 'all', label: '全部' }].concat(Object.entries(ELEMENTS).map(([v, o]) => ({ value: v, label: o.name, cls: 'el-' + v, html: elIcon(v) }))).concat([{ value: 'none', label: '无', html: elIcon('none') }]) },
    { key: 'funcs', label: '功能', kind: 'array', options: [{ value: 'all', label: '全部' }].concat(funcs.map(f => ({ value: f, label: f }))) }
  ];
  setupListPage(defs, DATA.patterns.slice().sort((a, b) => (b.sid || 0) - (a.sid || 0)), renderPatternCard, 'grid', 'count', 'empty');
}

// ============ 秘纹详情 ============
function renderPattern() {
  const p = getPatternById(getUrlParam('id'));
  const root = document.getElementById('content');
  if (!p) { root.innerHTML = notFound('未找到该秘纹', 'patterns.html', '返回秘纹图鉴'); return; }

  document.title = p.name + ' - 星塔旅人配队一览';
  const elBadge = elIcon(p.element || 'none');
  const funcStr = (p.funcs || []).join('、');
  const attrItems = [
    p.rarity ? p.rarity + '星' : null,
    (p.element && p.element !== 'none') ? elementName(p.element) + '元素' : null,
    funcStr || null
  ].filter(Boolean);

  const melody = p.melody || {};
  const harmony = (p.harmony || []);
  const maxLevel = p.maxLevel || 5;
  const dupeMax = (melody.params && melody.params.length) || 6;

  function renderTpl(tpl, paramStr) {
    if (!tpl) return '';
    const vals = String(paramStr || '').split(',');
    return escapeHtml(tpl).replace(/\{(\d+)\}/g, (m, n) => '<span class="val">' + escapeHtml(vals[parseInt(n, 10) - 1] || '') + '</span>');
  }
  const buffRow = (buffs) => (buffs && buffs.length)
    ? '<div class="eff-buffs">' + buffs.map(b => '<img class="buff-icon" src="' + escapeHtml(b) + '" alt="" loading="lazy">').join('') + '</div>'
    : '';

  const melodyHtml = melody.name ? `
    <div class="eff-card">
      ${melody.skillImg ? '<img loading="lazy" decoding="async" class="eff-icon" src="' + escapeHtml(melody.skillImg) + '" alt="">' : '<div class="eff-icon eff-icon-ph">♪</div>'}
      <div class="eff-body">
        <div class="eff-name">${escapeHtml(melody.name)}</div>
        <div class="eff-toolbar">
          <span class="tool-label">秘纹阶数</span>
          <input type="range" id="dupeSlider" min="1" max="${dupeMax}" value="1">
          <span class="tool-val" id="dupeVal">1</span>
          <span class="tool-extra" id="dupeExtra">${melody.dupe && melody.dupe[0] != null ? '攻击 +' + melody.dupe[0] : ''}</span>
        </div>
        <div class="eff-desc" id="melodyDesc">${renderTpl(melody.tpl, (melody.params || [])[0])}</div>
        ${buffRow(melody.buffs)}
      </div>
    </div>` : emptyHint('主效果待补充');

  const harmonyCards = harmony.map((h, i) => `
    <div class="eff-card">
      ${h.skillImg ? '<img loading="lazy" decoding="async" class="eff-icon" src="' + escapeHtml(h.skillImg) + '" alt="">' : '<div class="eff-icon eff-icon-ph">♪</div>'}
      <div class="eff-body">
        <div class="eff-name">${escapeHtml(h.name || '')}</div>
        <div class="eff-toolbar">
          <span class="tool-label">Harmony 等级</span>
          <input type="range" class="hSlider" min="1" max="${maxLevel}" value="1" data-idx="${i}">
          <span class="tool-val hVal">1</span>
        </div>
        <div class="eff-desc harmony-desc" data-params="${escapeHtml((h.params || []).join('|'))}" data-tpl="${escapeHtml(h.tpl || '')}">${renderTpl(h.tpl, (h.params || [])[0])}</div>
        <div class="eff-notes harmony-notes" data-levels="${escapeHtml(JSON.stringify(h.levels || []))}"></div>
        ${buffRow(h.buffs)}
      </div>
    </div>`).join('');
  const harmonyHtml = harmony.length ? harmonyCards : emptyHint('协奏效果待补充');

  root.innerHTML = `
    <div class="detail-head">
      ${p.portrait ? '<img loading="lazy" decoding="async" class="pattern-big" src="' + escapeHtml(p.portrait) + '" alt="' + escapeHtml(p.name) + '">' : ''}
      <div class="detail-info">
        <h1 class="detail-name">${escapeHtml(p.name)}</h1>
        <div class="badge-row">${renderStars(p.rarity)}${elBadge}</div>
        <div class="pattern-attrs">${attrItems.map(a => '<span class="attr-chip">' + escapeHtml(a) + '</span>').join('')}</div>
      </div>
    </div>
    <section class="section"><h2 class="section-title">Melody · 主效果</h2>${melodyHtml}</section>
    <section class="section"><h2 class="section-title">Harmony · 协奏效果</h2>${harmonyHtml}</section>
  `;

  const dupeSlider = document.getElementById('dupeSlider');
  if (dupeSlider) {
    dupeSlider.addEventListener('input', () => {
      const lv = parseInt(dupeSlider.value, 10);
      document.getElementById('dupeVal').textContent = lv;
      const ex = document.getElementById('dupeExtra');
      if (ex && melody.dupe) { const dv = melody.dupe[Math.min(lv - 1, melody.dupe.length - 1)]; ex.textContent = dv != null ? '攻击 +' + dv : ''; }
      const md = document.getElementById('melodyDesc');
      if (md) md.innerHTML = renderTpl(melody.tpl, (melody.params || [])[lv - 1]);
    });
  }
  root.querySelectorAll('.hSlider').forEach(slider => {
    const update = () => {
      const lv = parseInt(slider.value, 10);
      slider.parentElement.querySelector('.hVal').textContent = lv;
      const card = slider.closest('.eff-card');
      const desc = card.querySelector('.harmony-desc');
      const params = (desc.dataset.params || '').split('|');
      desc.innerHTML = renderTpl(desc.dataset.tpl, params[lv - 1] || params[0]);
      const notes = card.querySelector('.harmony-notes');
      const levels = JSON.parse(notes.dataset.levels || '[]');
      const cur = levels[Math.min(lv - 1, levels.length - 1)] || {};
      notes.innerHTML = Object.entries(cur).map(([n, c]) => '<span class="note-chip">' + noteIcon(n) + ' ×' + c + '</span>').join('') || '<em class="note-empty">无音符需求</em>';
    };
    update();
    slider.addEventListener('input', update);
  });
}

// ============ 通用小部件 ============
function notFound(msg, backHref, backLabel) {
  return '<div class="empty center"><div class="empty-icon">❓</div><p class="empty-text">' + escapeHtml(msg) + '</p><a class="btn" href="' + backHref + '">' + escapeHtml(backLabel) + '</a></div>';
}
function emptyHint(text) {
  return '<p class="hint">' + escapeHtml(text) + '</p>';
}
