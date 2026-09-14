/**
 * components.js —— 共享组件与工具函数
 */

// ===== 工具 =====
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function copyToClipboard(text, btn) {
  if (!text) return;
  const done = () => {
    if (!btn) return;
    const old = btn.dataset.label || btn.textContent;
    btn.textContent = '✓ 已复制';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1800);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta); done();
}

// ===== 查询 =====
const getCharById = id => DATA.characters.find(c => c.id === id);
const getPatternById = id => DATA.patterns.find(p => p.id === id);

const elementName = el => ELEMENTS[el] ? ELEMENTS[el].name : '?';
const roleName = r => ROLES[r] ? ROLES[r].name : '?';
const noteName = n => NOTE_TYPES[n] || '?';

// ===== 渲染元素 =====
function renderStars(rarity, size) {
  const n = parseInt(rarity) || 0;
  if (n <= 0 || n > 5) return '';
  return '<img loading="lazy" decoding="async" class="star-img' + (size ? ' star-img-' + size : '') + '" src="assets/img/ui/star-' + n + '.png" alt="' + n + '星">';
}

// 属性图标 / 音符图标
function elIcon(el) {
  return '<img loading="lazy" decoding="async" class="el-icon" src="assets/img/ui/el-' + (el || 'none') + '.png" alt="' + elementName(el) + '">';
}
function noteIcon(id) {
  return '<img loading="lazy" decoding="async" class="note-icon" src="assets/img/ui/note-' + id + '.png" alt="' + noteName(id) + '">';
}

function renderPortrait(char, cls) {
  if (char.portrait) {
    return '<img class="' + (cls || '') + '" src="' + escapeHtml(char.portrait) + '" alt="' + escapeHtml(char.name) + '" loading="lazy">';
  }
  return '<div class="' + (cls || '') + ' portrait-fallback el-' + (char.element || 'none') + '">' + escapeHtml((char.name || '?').charAt(0)) + '</div>';
}

// ===== 导航 =====
const NAV_LINKS = [
  { href: 'index.html', key: 'home', label: '首页' },
  { href: 'characters.html', key: 'characters', label: '旅人' },
  { href: 'patterns.html', key: 'patterns', label: '秘纹' },
  { href: 'teams.html', key: 'teams', label: '配队' }
];

function initNavbar(active) {
  const links = NAV_LINKS.map(l =>
    '<a class="nav-link' + (l.key === active ? ' active' : '') + '" href="' + l.href + '">' + l.label + '</a>'
  ).join('');
  const el = document.getElementById('navbar');
  if (el) el.innerHTML = `
    <header class="navbar">
      <div class="navbar-inner">
        <a class="brand" href="index.html"><img loading="lazy" decoding="async" class="brand-logo" src="assets/img/logo.ico" alt="" width="26" height="26">星塔旅人配队一览</a>
        <nav class="nav-links">${links}</nav>
        <span id="adminSlot" class="admin-slot"></span>
      </div>
    </header>
  `;
}

// ===== 角色卡片 =====
function renderCharCard(char) {
  const meta = [
    char.element ? elIcon(char.element) : '<span class="badge badge-none">元素待补</span>',
    char.role ? '<span class="badge role-' + char.role + '">' + roleName(char.role) + '</span>' : '<span class="badge badge-none">职业待补</span>'
  ].join('');
  return `
    <a class="char-card" href="character.html?id=${char.id}">
      <div class="char-card-media">${renderPortrait(char, 'char-portrait')}${renderStars(char.rarity)}</div>
      <div class="char-card-body">
        <div class="char-card-name">${escapeHtml(char.name)}</div>
        <div class="char-card-meta">${meta}</div>
      </div>
    </a>
  `;
}

// ===== 秘纹卡片 =====
function renderPatternCard(p) {
  const elBadge = elIcon(p.element || 'none');
  return `
    <a class="pattern-card" href="pattern.html?id=${p.id}">
      ${p.portrait ? '<div class="pattern-card-media"><img class="pattern-img" src="' + escapeHtml(p.portrait) + '" alt="" loading="lazy"></div>' : ''}
      <div class="pattern-card-body">
        <div class="pattern-card-head">
          ${renderStars(p.rarity)}
          ${elBadge}
        </div>
        <div class="pattern-card-name">${escapeHtml(p.name)}</div>
      </div>
    </a>
  `;
}
// ===== 推荐配队卡片（与我的配队同格式） =====
function renderPresetTeamCard(t) {
  const chars = [0,1,2].map(i => (t.chars && t.chars[i]) ? getCharById(t.chars[i]) : null);
  const mains = [0,1,2].map(i => (t.mainPatterns && t.mainPatterns[i]) ? getPatternById(t.mainPatterns[i]) : null);
  const subs = [0,1,2].map(i => (t.subPatterns && t.subPatterns[i]) ? getPatternById(t.subPatterns[i]) : null);
  const charSlots = chars.map(x => x
    ? '<span class="ut-char" title="' + escapeHtml(x.name) + '">' + renderPortrait(x, 'ut-char-img') + '</span>'
    : '<span class="ut-char ut-empty">+</span>').join('');
  const patSlots = (arr, cls) => arr.map(p => p
    ? '<span class="ut-pat ' + cls + '">' + (p.portrait ? '<img loading="lazy" decoding="async" src="' + escapeHtml(p.portrait) + '" alt="">' : '') + '</span>'
    : '<span class="ut-pat ut-empty ' + cls + '"></span>').join('');
  const potTotal = (t.pots || []).reduce((s, p) => s + Object.values(p || {}).reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0), 0);
  const tg = t.tags || {};
  const tagChips = [
    tg.element ? '<span class="ut-tag ut-tag-el">元素 · ' + escapeHtml(tg.element) + '</span>' : '',
    tg.style ? '<span class="ut-tag">流派 · ' + escapeHtml(tg.style) + '</span>' : '',
    tg.power ? '<span class="ut-tag ut-tag-pow">强度 · ' + escapeHtml(tg.power) + '</span>' : '',
    teamScenes(t).length ? '<span class="ut-tag ut-tag-scene">适用 · ' + escapeHtml(teamScenes(t).join(' / ')) + '</span>' : ''
  ].filter(Boolean).join('');
  return `
    <div class="team-card user-team">
      <a class="ut-link" href="team.html?id=${t.id}&preset=1">
        <div class="team-card-head">
          <span class="team-card-name">${escapeHtml(t.name || '推荐配队')}</span>
          <span class="tier-badge tier-none">${chars.filter(Boolean).length}/3</span>
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
          + '<button class="team-del" data-id="' + t.id + '" data-name="' + escapeHtml(t.name || '') + '" data-preset="1">删除</button>'
          + ''
          + '</div>'
        : '<div class="ut-actions"><a class="team-edit-btn" href="team.html?id=' + t.id + '&preset=1">查看</a></div>'}
    </div>
  `;
}

