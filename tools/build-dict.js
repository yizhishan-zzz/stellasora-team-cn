/**
 * build-dict.js —— 生成翻译字典（英文 → 中文）
 *
 * 1) 自动部分：从 ss-data 抽取所有 name / nameCN 配对（技能名、潜能名、秘纹名、标记名）
 * 2) 手工部分：属性与数值类标签（ATK、Skill DMG 等），数据里没有中英对照，需要人工维护
 *
 * 产出：assets/data/dict.json
 * 用法：node tools/build-dict.js   （或双击 tools/更新翻译字典.bat）
 *
 * 要加新词：编辑下面的 MANUAL 表，再跑一次脚本即可。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SS = path.join(__dirname, 'ss-data');
const OUT = path.join(ROOT, 'assets', 'data', 'dict.json');

// ===== 手工维护：属性与数值类标签 =====
const MANUAL = {
  'ATK': '攻击', 'DEF': '防御', 'HP': '生命',
  'Attack Speed': '攻击速度', 'Movement Speed': '移动速度',
  'Crit Rate': '暴击率', 'Crit DMG': '暴击伤害',
  'DEF PEN': '防御穿透', 'DMG multiplier': '伤害倍率',
  'Resilience Break Efficiency': '韧性击破效率', 'VUL Exploit': '易伤增幅',
  'DMG': '伤害', 'Skill DMG': '技能伤害', 'Ultimate DMG': '绝招伤害',
  'Auto Attack DMG': '普攻伤害', 'Minion DMG': '仆从伤害', 'Mark DMG': '印记伤害',
  'Skill Crit Rate': '技能暴击率', 'Skill Crit DMG': '技能暴击伤害',
  'Ultimate Crit Rate': '绝招暴击率', 'Ultimate Crit DMG': '绝招暴击伤害',
  'Minion Crit Rate': '仆从暴击率',
  'DMG Taken': '受到伤害提升', 'Skill DMG Taken': '受到技能伤害提升',
  'Mark DMG Taken': '受到印记伤害提升',
  'Ignis DMG': '火元素伤害', 'Ignis DMG Taken': '受到火元素伤害提升',
  'Aqua DMG': '水元素伤害', 'Aqua DMG Taken': '受到水元素伤害提升',
  'Ventus DMG': '风元素伤害', 'Ventus DMG Taken': '受到风元素伤害提升',
  'Terra DMG': '土元素伤害', 'Terra DMG Taken': '受到土元素伤害提升',
  'Lux DMG': '光元素伤害', 'Lux DMG Taken': '受到光元素伤害提升',
  'Umbra DMG': '暗元素伤害', 'Umbra DMG Taken': '受到暗元素伤害提升',

  // 单词级兜底：描述里会出现「绝招暴击 Rate」这种半英半中的写法，
  // 整串匹配不到时按单词替换。只收绝不会出现在技能名里的词。
  'Rate': '率', 'DMG': '伤害', 'ATK': '攻击', 'DEF': '防御',
  'Auto': '普攻', 'Attack': '攻击', 'Crit': '暴击', 'Minion': '仆从',
  'Speed': '速度', 'Taken': '受到', 'Mark': '印记', 'Skill': '技能',
  'Ultimate': '绝招', 'Minion DMG Taken': '受到仆从伤害提升',

  // 界面固定词（写死在页面里的英文标签）
  'Melody': '主效果', 'Harmony': '协奏',
  'CD': '冷却',
};

// ===== 自动抽取：英文名 → 中文名 =====
function autoCollect() {
  const map = {};
  const add = (en, cn) => {
    if (!en || !cn) return;
    const e = String(en).trim(), c = String(cn).trim();
    if (e && c && e !== c && /[A-Za-z]/.test(e)) map[e] = c;
  };
  const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
  const chars = rd(path.join(SS, 'character.json'));
  if (chars) Object.keys(chars).forEach(id => {
    const c = chars[id];
    ['normalAtk', 'skill', 'supportSkill', 'ultimate'].forEach(k => { if (c[k]) add(c[k].name, c[k].nameCN); });
    Object.keys(c.potential || {}).forEach(g => (c.potential[g] || []).forEach(p => add(p.name, p.nameCN)));
  });
  const discs = rd(path.join(SS, 'disc.json'));
  if (discs) Object.keys(discs).forEach(id => {
    const d = discs[id];
    ['mainSkill', 'secondarySkill1', 'secondarySkill2'].forEach(k => { if (d[k]) add(d[k].name, d[k].nameCN); });
  });
  return map;
}

// ===== 标记名：英文 desc 与中文 descCN 里的 ##名称#id# 按 id 配对 =====
function markCollect() {
  const map = {};
  const chars = (() => { try { return JSON.parse(fs.readFileSync(path.join(SS, 'character.json'), 'utf8')); } catch (e) { return null; } })();
  if (!chars) return map;
  const paired = (en, cn) => {
    const enMap = {};
    (String(en || '').match(/##([^#]+)#(\d+)#/g) || []).forEach(x => {
      const m = /##([^#]+)#(\d+)#/.exec(x);
      if (m) enMap[m[2]] = m[1];
    });
    (String(cn || '').match(/##([^#]+)#(\d+)#/g) || []).forEach(x => {
      const m = /##([^#]+)#(\d+)#/.exec(x);
      if (m && enMap[m[2]]) map[enMap[m[2]]] = m[1];
    });
  };
  Object.keys(chars).forEach(id => {
    const c = chars[id];
    ['normalAtk', 'skill', 'supportSkill', 'ultimate'].forEach(k => { if (c[k]) paired(c[k].desc, c[k].descCN); });
    Object.keys(c.potential || {}).forEach(g => (c.potential[g] || []).forEach(p => paired(p.desc, p.descCN)));
  });
  return map;
}

// ===== 合并输出（手工表优先级最高）=====
const names = autoCollect();
const marks = markCollect();
const dict = Object.assign({}, names, marks, MANUAL);
const sorted = {};
Object.keys(dict).sort((a, b) => b.length - a.length).forEach(k => { sorted[k] = dict[k]; });
fs.writeFileSync(OUT, JSON.stringify(sorted), 'utf8');

const size = Math.round(fs.statSync(OUT).size / 1024);
console.log('翻译字典已生成: assets/data/dict.json  (' + size + ' KB)');
console.log('  自动抽取（技能/潜能/秘纹名）: ' + Object.keys(names).length + ' 条');
console.log('  自动抽取（标记名）:           ' + Object.keys(marks).length + ' 条');
console.log('  手工维护（属性与数值标签）:    ' + Object.keys(MANUAL).length + ' 条');
console.log('  合计: ' + Object.keys(sorted).length + ' 条');