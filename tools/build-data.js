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
wr(path.join(ROOT, 'assets/data/patterns.json'), pj);

console.log('旅人更新:', cUpd, '| 潜能描述变更:', potUpd);
console.log('秘纹更新:', pUpd, '/', pj.patterns.length);
console.log('完成。');
