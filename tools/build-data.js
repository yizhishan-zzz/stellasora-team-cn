/**
 * build-data.js — 从 ss-data 重建网站的旅人与秘纹数据
 *
 * 用法:  node tools/build-data.js [ss-data目录]
 *        默认读取 tools/ss-data/（由 fetch-data.bat 下载）
 *
 * 数据源: github.com/AutumnVN/ss-data
 *   character.json                 旅人（含潜能 5 组 + 中文名 + 描述 key）
 *   disc.json                      秘纹（mainSkill.descCN / params / buffIcon / supportNote / dupe）
 *   CN/bin/CharPotential.json      潜能在各组中的 id 列表
 *   CN/language/zh_CN/Character.json   旅人中文名
 *   CN/language/zh_CN/Potential.json   潜能中文描述（Potential.<id>.<level>）
 *
 * 策略: 保留现有的中文名 / 图标路径 / 协奏效果（ss-data 未提供），只更新文本与数值。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SD = process.argv[2] || path.join(__dirname, 'ss-data');
const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const wr = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2), 'utf8');

// ===== 高清素材路径（由 tools/download-icons.js 下载到 assets/img/hd/） =====
// 旧路径会带上复制文件时的 6 位哈希后缀（如 DiscSkill_4_2dIe6f.webp），统一去掉后映射到高清目录
const HD = {
  potential: 'assets/img/hd/potential/',
  skill: 'assets/img/hd/discskill/',
  buff: 'assets/img/hd/buff/'
};
function stripHash(p) {
  const m = /^(.*)_[A-Za-z0-9]{5,7}\.webp$/.exec(String(p || ''));
  return (m ? m[1] : String(p || '').replace(/\.webp$/, ''));
}
// 潜能图标：ss-data 的 icon 字段（如 10301_Potential_01）→ hd/potential/10301_Potential_01_A.webp
function potentialIcon(p, oldIcon) {
  if (p && p.icon) return HD.potential + p.icon + '_A.webp';
  const base = stripHash(oldIcon).split('/').pop();
  return base ? HD.potential + base + '_A.webp' : (oldIcon || null);
}
// 秘纹效果图 / buff 图：优先用 ss-data 的图标名，否则从旧路径剥离哈希后缀
function hdIcon(kind, baseName, oldPath) {
  const name = baseName || stripHash(oldPath).split('/').pop();
  if (!name) return oldPath || null;
  return HD[kind] + name + '.webp';
}

const EL = { Aqua: 'water', Ignis: 'fire', Ventus: 'wind', Terra: 'earth', Lux: 'light', Umbra: 'dark', None: 'none' };
const CLS = { Vanguard: 'vanguard', Balanced: 'balanced', Support: 'support' };
const ATK = { Melee: '近战', Ranged: '远程' };
const FLOW = { mainCore: '前排核心', mainNormal: '前排特有', common: '通用', supportCore: '后排核心', supportNormal: '后排特有' };
const isCore = k => k === 'mainCore' || k === 'supportCore';
const NOTE = {
  'Melody of Focus': 'focus', 'Melody of Stamina': 'stamina', 'Melody of Lux': 'light',
  'Melody of Terra': 'earth', 'Melody of Luck': 'luck', 'Melody of Pummel': 'power',
  'Melody of Skill': 'technique', 'Melody of Burst': 'burst', 'Melody of Umbra': 'dark',
  'Melody of Aqua': 'water', 'Melody of Ignis': 'fire', 'Melody of Ultimate': 'ultimate',
  'Melody of Ventus': 'wind'
};

// 富文本清理
function cleanTpl(s) {
  return String(s || '')
    .replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ').trim();
}

function clean(s) {
  return String(s || '')
    .replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '')
    .replace(/##([^#]*)#\d+#/g, (m, t) => (/^[「『"']/.test(t) ? t : '「' + t + '」'))
    .replace(/&Param\d+&/g, '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// ===== 新增条目的辅助 =====
// 旅人 id：优先用英文名转 slug（如 Suntide Willow -> suntide-willow），没有就用 c<sid>
function slugify(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function uniqueId(base, used) {
  let id = base || 'c';
  let n = 2;
  while (used.has(id)) { id = base + '-' + n; n++; }
  used.add(id);
  return id;
}
// 从 ss-data 的 supportNote 推断音符类型
// 秘纹新 id：接着现有的 pNNN 最大编号往下排（p001、p002 … p101）
function nextPatternId(used) {
  let max = 0;
  used.forEach(id => {
    const m = /^p(d+)$/.exec(id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  let n = max + 1;
  while (used.has('p' + String(n).padStart(3, '0'))) n++;   // 万一被占用就往下找
  const id = 'p' + String(n).padStart(3, '0');
  used.add(id);
  return id;
}

function notesFromSupportNote(supportNote) {
  if (!Array.isArray(supportNote) || !supportNote.length) return [];
  const last = supportNote[supportNote.length - 1] || {};
  return Object.keys(last).map(k => NOTE[k]).filter(Boolean);
}

function need(p) { if (!fs.existsSync(p)) { console.error('[缺少] ' + p); console.error('请先运行 tools/fetch-data.bat 下载数据'); process.exit(1); } }

const F = {
  char: path.join(SD, 'character.json'),
  disc: path.join(SD, 'disc.json'),
  charCN: path.join(SD, 'CN/language/zh_CN/Character.json'),
  potCN: path.join(SD, 'CN/language/zh_CN/Potential.json')
};
Object.values(F).forEach(need);

const charBin = rd(F.char);
const discBin = rd(F.disc);
const charCN = rd(F.charCN);
const potCN = rd(F.potCN);

// ============ 旅人 ============
const cj = rd(path.join(ROOT, 'assets/data/characters.json'));
let cUpd = 0, potUpd = 0;
for (const c of cj.characters) {
  if (!c.sid) continue;
  const s = charBin[String(c.sid)];
  if (!s) continue;
  c.rarity = s.star || c.rarity;
  if (EL[s.element]) c.element = EL[s.element];
  if (CLS[s.class]) c.role = CLS[s.class];
  if (ATK[s.attackType]) c.attackType = ATK[s.attackType];
  if (!c.name) { const cn = charCN['Character.' + c.sid + '.1']; if (cn) c.name = cn; }

  const oldByName = {};
  (c.potentials || []).forEach(p => { oldByName[p.name] = p; });
  const next = [];
  for (const key of Object.keys(FLOW)) {
    for (const p of ((s.potential || {})[key] || [])) {
      const nm = p.nameCN || p.name;
      const old = oldByName[nm];
      const rawDesc = clean(potCN['Potential.' + p.id + '.2'] || potCN['Potential.' + p.id + '.1']);
      const desc = (old && old.desc && old.desc.length > 10) ? old.desc : rawDesc;
      next.push({
        name: nm,
        flow: FLOW[key],
        type: old ? old.type : (isCore(key) ? '核心潜能' : '金潜能'),
        desc: desc,
        icon: potentialIcon(p, old && old.icon),
        potId: p.id,
        // rarity: 核心潜能=core / 彩潜能=rare / 金潜能=common；corner: 角标形状
        rarity: p.rarity || (old && old.rarity) || (isCore(key) ? 'core' : 'common'),
        corner: p.corner || null
      });
      if (old && old.desc !== desc) potUpd++;
    }
  }
  if (next.length) { c.potentials = next; cUpd++; }
}
// ===== 新增旅人：ss-data 里有、网站里没有的，自动补齐 =====
const usedCharIds = new Set(cj.characters.map(c => c.id));
let cAdded = 0;
const knownSids = new Set(cj.characters.map(c => String(c.sid)));
for (const sid of Object.keys(charBin)) {
  if (knownSids.has(String(sid))) continue;           // 已存在，跳过
  const s = charBin[sid];
  if (!s) continue;
  const cnName = charCN['Character.' + sid + '.1'] || null;
  const enName = s.name || null;
  const id = uniqueId(slugify(enName) || ('c' + sid), usedCharIds);
  const pots = [];
  for (const key of Object.keys(FLOW)) {
    for (const p of ((s.potential || {})[key] || [])) {
      pots.push({
        name: p.nameCN || p.name,
        flow: FLOW[key],
        type: isCore(key) ? '核心潜能' : '金潜能',
        desc: clean(potCN['Potential.' + p.id + '.2'] || potCN['Potential.' + p.id + '.1']),
        icon: potentialIcon(p, null),
        potId: p.id,
        rarity: p.rarity || (isCore(key) ? 'core' : 'common'),
        corner: p.corner || null
      });
    }
  }
  cj.characters.push({
    id: id,
    name: cnName || enName || ('角色' + sid),
    gkId: null,
    nameEn: enName,
    element: EL[s.element] || 'none',
    role: CLS[s.class] || null,
    rarity: s.star || null,
    attackType: ATK[s.attackType] || null,
    affiliation: s.force || null,
    birthday: s.birthday || null,
    cvCn: s.cnCv || null,
    cvJp: s.jpCv || null,
    weapon: null,
    portrait: 'assets/img/hd/head/head_' + sid + '02_XL.webp',
    description: null,
    variantOf: null,
    skills: null,
    potentials: pots,
    noteRecs: [],
    secrets: [],
    sid: Number(sid)
  });
  cAdded++;
  console.log('  [新增旅人] ' + (cnName || enName) + '  (sid ' + sid + ', id ' + id + ', ' + pots.length + ' 个潜能)');
}

wr(path.join(ROOT, 'assets/data/characters.json'), cj);

// ============ 秘纹 ============
const pj = rd(path.join(ROOT, 'assets/data/patterns.json'));
let pUpd = 0;
for (const p of pj.patterns) {
  if (!p.sid) continue;
  const d = discBin[String(p.sid)];
  if (!d) continue;
  p.rarity = d.star || p.rarity;
  if (EL[d.element]) p.element = EL[d.element];
  const ms = d.mainSkill || {};
  const params = ms.params ? String(ms.params).split('/') : [];
  p.melody = Object.assign({}, p.melody || {}, {
    name: (p.melody && p.melody.name) || ms.nameCN || '',
    tpl: ms.descCN ? cleanTpl(ms.descCN) : ((p.melody && p.melody.tpl) || ''),
    params: params.length ? params : ((p.melody && p.melody.params) || []),
    skillImg: hdIcon('skill', ms.icon, p.melody && p.melody.skillImg),
    dupe: (d.dupe || []).map(x => x.ATK).filter(v => v != null),
    buffs: ((ms.buffIcon || []).filter(v => v && v !== 'No Icon').length
      ? ms.buffIcon.filter(v => v && v !== 'No Icon').map(v => hdIcon('buff', v, null))
      : (p.melody && p.melody.buffs) || [])
  });
  // 协奏效果（Harmony）：文本来自旧抓取（ss-data 不提供），只把图标换高清源
  if (Array.isArray(d.supportNote) && d.supportNote.length) {
    p.notes = Object.keys(d.supportNote[d.supportNote.length - 1]).map(k => NOTE[k]).filter(Boolean);
  }
  const secSkills = [d.secondarySkill1, d.secondarySkill2].filter(Boolean);
  if (Array.isArray(p.harmony) && p.harmony.length) {
    p.harmony = p.harmony.map(h => {
      const sec = secSkills.find(s => (s.nameCN || s.name) === h.name);
      const buffIcons = sec ? (sec.buffIcon || []).filter(v => v && v !== 'No Icon') : [];
      return Object.assign({}, h, {
        skillImg: hdIcon('skill', sec && sec.icon, h.skillImg),
        buffs: buffIcons.length ? buffIcons.map(v => hdIcon('buff', v, null)) : (h.buffs || [])
      });
    });
  }
  pUpd++;
}
// ===== 新增秘纹：ss-data 里有、网站里没有的，自动补齐 =====
const usedPatIds = new Set(pj.patterns.map(p => p.id));
let pAdded = 0;
const knownPSids = new Set(pj.patterns.map(p => String(p.sid)));
for (const sid of Object.keys(discBin)) {
  if (knownPSids.has(String(sid))) continue;
  const d = discBin[sid];
  if (!d) continue;
  const ms = d.mainSkill || {};
  const params = ms.params ? String(ms.params).split('/') : [];
  const pname = ms.nameCN || d.name || ('秘纹' + sid);
  const elKey = EL[d.element] || 'none';
  const funcs = Array.isArray(d.tag) ? d.tag.slice(0, 4) : [];
  pj.patterns.push({
    id: nextPatternId(usedPatIds),
    name: pname,
    portrait: 'assets/img/hd/outfit/outfit_' + sid + '.webp',
    rarity: d.star || null,
    element: elKey,
    funcs: funcs,
    melody: {
      name: pname,
      tpl: ms.descCN ? cleanTpl(ms.descCN) : '',
      params: params,
      skillImg: ms.icon ? hdIcon('skill', ms.icon, null) : null,
      dupe: (d.dupe || []).map(x => x.ATK).filter(v => v != null),
      buffs: (ms.buffIcon || []).filter(v => v && v !== 'No Icon').map(v => hdIcon('buff', v, null))
    },
    harmony: [],                                    // ss-data 不提供协奏效果，需要人工补
    notes: notesFromSupportNote(d.supportNote),
    maxLevel: 5,
    gkId: null,
    sid: Number(sid)
  });
  pAdded++;
  console.log('  [新增秘纹] ' + pname + '  (sid ' + sid + ', ' + (d.star || '?') + ' 星, ' + elKey + ')');
}

wr(path.join(ROOT, 'assets/data/patterns.json'), pj);

console.log('旅人更新:', cUpd, '| 新增旅人:', cAdded, '| 潜能描述变更:', potUpd);
console.log('秘纹更新:', pUpd, '| 新增秘纹:', pAdded, '| 秘纹总数:', pj.patterns.length);
console.log('完成。');
