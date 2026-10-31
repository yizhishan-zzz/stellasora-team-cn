/**
 * build-emblems.js —— 生成 assets/data/emblems.json（纹章 / Emblem 属性表）
 *
 * 数据来源：https://raw.githubusercontent.com/AutumnVN/ss-data/main/emblem.json
 * （stelladb 的 Emblem 页用的就是这份数据）
 *
 * 用法：node --use-system-ca tools/build-emblems.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const URL = 'https://raw.githubusercontent.com/AutumnVN/ss-data/refs/heads/main/emblem.json';

// 官方数据是英文，这里补中文名（词典里已有的优先用词典）
const CN = {
  'HP': '生命', 'ATK': '攻击', 'DEF': '防御',
  'Crit Rate': '暴击率', 'Crit DMG': '暴击伤害',
  'Auto Attack': '普攻', 'Auto Attack DMG': '普攻伤害', 'Auto Attack Crit Rate': '普攻暴击率',
  'Skill DMG': '技能伤害', 'Skill Crit Rate': '技能暴击率',
  'Ultimate': '绝招', 'Ultimate DMG': '绝招伤害', 'Ultimate Crit Rate': '绝招暴击率',
  'Mark DMG': '印记伤害', 'Mark Crit Rate': '印记暴击率',
  'Minion DMG': '仆从伤害', 'Minion Crit Rate': '仆从暴击率',
  'Derivative DMG': '衍生伤害', 'Derivative Crit Rate': '衍生暴击率',
  'Elemental DMG': '元素伤害', 'Elemental PEN': '元素穿透',
  'Charge Efficiency (Main)': '充能效率（主控）', 'Charge Efficiency (Support)': '充能效率（援护）',
  // 这几条是「技能等级 +N」类词条
  'Auto Attack': '普攻等级', 'Main Skill': '主控技等级', 'Support Skill': '援护技等级',
  'Ultimate': '绝招等级', 'Potential': '潜能等级'
};

// 分类（用于编辑器分组）
const GROUP = {
  'HP': '基础', 'ATK': '基础', 'DEF': '基础',
  'Crit Rate': '暴击', 'Crit DMG': '暴击',
  'Auto Attack Crit Rate': '暴击', 'Skill Crit Rate': '暴击', 'Ultimate Crit Rate': '暴击',
  'Mark Crit Rate': '暴击', 'Minion Crit Rate': '暴击', 'Derivative Crit Rate': '暴击',
  'Auto Attack DMG': '伤害', 'Skill DMG': '伤害', 'Ultimate DMG': '伤害', 'Mark DMG': '伤害',
  'Minion DMG': '伤害', 'Derivative DMG': '伤害', 'Elemental DMG': '伤害',
  'Elemental PEN': '特殊', 'Charge Efficiency (Main)': '特殊', 'Charge Efficiency (Support)': '特殊',
  'Main Skill': '特殊', 'Support Skill': '特殊', 'Potential': '特殊', 'Auto Attack': '特殊', 'Ultimate': '特殊'
};

// 这些暴击率实际只有 3 档（没有 15% 那档），暴击率/暴击伤害仍是 4 档
const THREE_TIER_CRIT = ['Auto Attack Crit Rate', 'Skill Crit Rate', 'Ultimate Crit Rate', 'Mark Crit Rate', 'Minion Crit Rate', 'Derivative Crit Rate'];

// 档位配色方案：4 档绿蓝金粉紫；3 档暴击率绿蓝金；3 档技能等级/潜能金粉紫粉紫
function schemeOf(en, values) {
  if (values.length >= 4) return 'g-b-gold-pink';
  const isSkillLevel = ['Auto Attack', 'Main Skill', 'Support Skill', 'Ultimate', 'Potential'].indexOf(en) >= 0;
  return isSkillLevel ? 'gold-pink-pink' : 'green-blue-gold';
}

// 特殊词条的补充说明（展示在展开的档位下面）
const NOTES = {
  'Potential': '除核心潜能外，任意潜能都能加点；每档 +1 / +2 / +3',
  'Auto Attack': '普攻技能等级 +1 / +2 / +3',
  'Main Skill': '主控技能等级 +1 / +2 / +3',
  'Support Skill': '援护技能等级 +1 / +2 / +3',
  'Ultimate': '绝招技能等级 +1 / +2 / +3'
};

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'stellasora-network/1.0' } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('超时')));
  });
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

(async () => {
  console.log('下载 emblem.json ...');
  const raw = await get(URL);
  const json = JSON.parse(raw);

  // 收集：属性名 → 各级数值（取出现的第一份阶梯） / 出现的等级段
  const map = {};
  const walk = (node, bracket) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(v => walk(v, bracket)); return; }
    Object.keys(node).forEach(k => {
      if (k === 'attr' && Array.isArray(node[k])) {
        node[k].forEach(line => {
          const s = String(line);
          const i = s.indexOf(':');
          if (i < 0) return;
          const name = s.slice(0, i).trim();
          let vals = s.slice(i + 1).split('/').map(x => x.trim().replace(/\*$/, ''));
          if (THREE_TIER_CRIT.indexOf(name) >= 0) vals = vals.slice(0, 3);   // 这几个只有 3 档
          // 同名属性可能有两种：具体数值（生命 680/850/...）和百分比（生命 4%/5%/...）
          const isPct = vals.length > 0 && vals.every(v => /%$/.test(v));
          const key = name + '|' + (isPct ? 'pct' : 'flat');
          if (!map[key]) map[key] = { name: name, isPct: isPct, values: vals, brackets: {} };
          if (vals.length > (map[key].values || []).length) map[key].values = vals;
          map[key].brackets[bracket] = true;
        });
      } else walk(node[k], /^lv\d+$/.test(k) ? k : bracket);
    });
  };
  walk(json, '');

  // 词典兜底（项目里已有的翻译优先）
  let dict = {};
  try { const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/dict.json'), 'utf8')); dict = d.dict || d; } catch (e) {}

  const BASE_NAMES = ['HP', 'ATK', 'DEF'];
  const attrs = Object.keys(map).map(key => {
    const item = map[key];
    const en = item.name;
    const isPctBase = item.isPct && BASE_NAMES.indexOf(en) >= 0;
    const baseCn = CN[en] || dict[en] || en;
    return {
      id: isPctBase ? slug(en) + '-pct' : slug(en),
      en: en,
      // 显式映射优先（词典里 Ultimate 只译成「绝招」，这里需要「绝招等级」）
      cn: isPctBase ? baseCn + '%' : baseCn,
      group: isPctBase ? '大基础' : (GROUP[en] || '其他'),
      values: item.values,             // 完整档位数值阶梯（一般 4 档，少数 3 档）
      max: item.values.length ? item.values[item.values.length - 1] : '',
      brackets: Object.keys(item.brackets).sort(),  // 出现在哪些等级段：lv70/lv80/lv90
      note: NOTES[en] || '',                        // 特殊词条说明（可为空）
      scheme: schemeOf(en, item.values)             // 配色方案
    };
  }).sort((a, b) => {
    const order = { '基础': 0, '大基础': 1, '暴击': 2, '伤害': 3, '特殊': 4, '其他': 5 };
    return (order[a.group] - order[b.group]) || a.cn.localeCompare(b.cn, 'zh');
  });

  const out = { attrs: attrs, updatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(ROOT, 'assets/data/emblems.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');

  const noCn = attrs.filter(a => a.cn === a.en);
  console.log('已生成 assets/data/emblems.json');
  console.log('  属性条数: ' + attrs.length);
  console.log('  分类: ' + JSON.stringify(attrs.reduce((o, a) => { o[a.group] = (o[a.group] || 0) + 1; return o; }, {})));
  if (noCn.length) console.log('  [注意] 这些还没有中文名: ' + noCn.map(a => a.en).join('、'));
  else console.log('  全部有中文名 ✅');
})().catch(e => { console.log('[X] 生成失败: ' + e.message); process.exit(1); });