/**
 * data.js —— 数据加载器 + 展示元数据常量
 * 所有 JSON 数据统一通过 loadData() 加载到全局 DATA 对象。
 */

// ===== 展示元数据（元素/职业/音符的固定映射，非「数据」，故写在前端） =====
const ELEMENTS = {
  water: { name: '水', color: '#4A9EFF' },
  fire:  { name: '火', color: '#FF6B4A' },
  wind:  { name: '风', color: '#52C878' },
  earth: { name: '土', color: '#D4A542' },
  light: { name: '光', color: '#FFD966' },
  dark:  { name: '暗', color: '#9B6BFF' }
};

const ROLES = {
  vanguard: { name: '先锋', desc: '只能触发印记' },
  balanced: { name: '均衡', desc: '后台挂印记，前台触发印记' },
  support:  { name: '辅助', desc: '只能挂印记' }
};

const NOTE_TYPES = {
  focus: '专注之音', stamina: '体力之音', light: '光之音', earth: '地之音',
  luck: '幸运之音', power: '强攻之音', technique: '技巧之音', dark: '暗之音',
  burst: '暴发之音', water: '水之音', fire: '火之音', ultimate: '绝招之音', wind: '风之音'
};

// ss-data 里的音符英文名 -> 内部键（用于查图标与中文名）
const NOTE_BY_EN = {
  'Focus': 'focus', 'Stamina': 'stamina', 'Lux': 'light', 'Terra': 'earth',
  'Luck': 'luck', 'Pummel': 'power', 'Skill': 'technique', 'Umbra': 'dark',
  'Burst': 'burst', 'Aqua': 'water', 'Ignis': 'fire', 'Ultimate': 'ultimate', 'Ventus': 'wind'
};
// 'Melody of Luck' -> 'luck'
function noteKeyFromEn(name) {
  const m = /^Melody of ([A-Za-z]+)$/.exec(String(name || '').trim());
  if (!m) return null;
  return NOTE_BY_EN[m[1]] || null;
}

// ===== 全局数据容器 =====
const DATA = {
  characters: [],
  patterns: [],
  potentialCfg: null,
  presetTeams: [],
  presetTeamsUpdatedAt: '',  // 数据文件里的 updatedAt，用于判断本地改动是否比线上新
  charSkills: {},            // 旅人技能（普攻/主控/援护/绝招）的文本与各级数值
  charStats: {},             // 旅人各级基础数值 [等级, 生命, 攻击, 防御]
  potentialLevels: {},       // 潜能各级数值与等级上限
  discSkills: {},            // 秘纹各级数值与音符表
  dict: {}                   // 翻译字典（英文 → 中文）
};

// 数据文件表：每个文件 40~530 KB，按页面按需加载（首屏能省一大半）
const DATA_FILES = {
  characters:      'assets/data/characters.json',
  patterns:        'assets/data/patterns.json',
  potentialCfg:    'assets/data/potential-cfg.json',
  presetTeams:     'assets/data/preset-teams.json',
  charSkills:      'assets/data/character-skills.json',
  charStats:       'assets/data/character-stats.json',
  potentialLevels: 'assets/data/potential-levels.json',
  discSkills:      'assets/data/disc-skills.json',
  dict:            'assets/data/dict.json'
};

// 每个页面真正需要的数据（rest = 基础数据，所有页面都要）
// dict 很小（53 KB）且每个页面都可能用到，所以归入基础数据
const BASE_DATA = ['characters', 'patterns', 'presetTeams', 'dict'];
const PAGE_DATA = {
  home:       ['characters', 'patterns', 'presetTeams'],
  characters: ['characters'],                                  // 卡片只用 characters
  character:  ['characters', 'charSkills', 'charStats', 'potentialLevels'],
  patterns:   ['patterns'],
  pattern:    ['patterns', 'discSkills'],
  teams:      ['characters', 'patterns', 'presetTeams'],       // 配队卡片要用
  team:       ['characters', 'patterns', 'presetTeams', 'potentialCfg', 'potentialLevels', 'charSkills']
};
function dataKeysForPage() {
  const pg = (document.body && document.body.dataset && document.body.dataset.page) || 'home';
  const need = (PAGE_DATA[pg] || BASE_DATA).slice();
  // 基础数据（含翻译字典）每个页面都要，避免漏加载
  BASE_DATA.forEach(function (k) { if (need.indexOf(k) < 0) need.push(k); });
  return need;
}

async function loadData() {
  // 只加载当前页面需要的数据文件
  const keys = dataKeysForPage();
  const entries = await Promise.all(
    keys.filter(k => DATA_FILES[k]).map(async (key) => {
      const url = DATA_FILES[key];
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('加载 ' + url + ' 失败: ' + resp.status);
      return [key, await resp.json()];
    })
  );
  for (const [key, json] of entries) {
    if (key === 'potentialCfg') DATA.potentialCfg = json;
    else if (key === 'presetTeams') { DATA.presetTeams = json.teams || []; DATA.presetTeamsUpdatedAt = json.updatedAt || ''; }
    else if (key === 'charSkills' || key === 'charStats' || key === 'potentialLevels' || key === 'discSkills' || key === 'dict') DATA[key] = json;
    else DATA[key] = json[key];
  }
}

// 加载失败时的友好提示
function showLoadError(err) {
  const el = document.querySelector('#app') || document.body;
  el.innerHTML = `
    <div style="max-width:640px;margin:80px auto;padding:32px;background:#1a1d26;border:1px solid #333;border-radius:12px;text-align:center;">
      <h2 style="margin:0 0 12px;">数据加载失败</h2>
      <p style="color:#aab;line-height:1.7;">无法通过 file:// 协议读取 JSON 数据。<br>
      请使用本地服务器打开本站（双击运行项目根目录的 <code>serve.bat</code>，或命令行执行 <code>node serve.js</code>）。</p>
      <p style="color:#667;font-size:12px;margin-top:16px;">错误信息：${escapeHtml(err.message)}</p>
    </div>
  `;
}
