/**
 * build-skills.js —— 从 ss-data 提取技能与基础数值到本地 JSON
 *
 * 产出：
 *   assets/data/character-skills.json   旅人技能（普攻/主控/援护/绝招）的文本与各级数值
 *   assets/data/character-stats.json    旅人各级基础数值（生命/攻击/防御）
 *   assets/data/disc-skills.json        秘纹的主效果/协奏效果各级数值与音符表
 *
 * 数据源：ss-data/character.json、ss-data/disc.json（由 fetch-data.js 下载）
 * 用法：node tools/build-skills.js
 *
 * 说明：只保留中文与渲染需要的字段，剔掉英文/日文/韩文，控制体积。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SD = path.join(__dirname, 'ss-data');
const OUT = path.join(ROOT, 'assets', 'data');

function need(p) {
  if (!fs.existsSync(p)) { console.error('[缺少] ' + p); console.error('请先运行 tools/update-data 或 node tools/fetch-data.js'); process.exit(1); }
}
function rd(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function wr(p, o) { fs.writeFileSync(p, JSON.stringify(o), 'utf8'); }

// 清理富文本（和 build-data.js 保持一致的处理）
function clean(s) {
  return String(s || '')
    .replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '')
    .replace(/##([^#]*)#\d+#/g, (m, t) => (/^[「『"']/.test(t) ? t : '「' + t + '」'))
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\u000b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// 把 params 里的 "a/b/c" 字符串拆成两维数组（每个参数一条，13 级）
function splitParams(params) {
  if (!params) return [];
  const arr = Array.isArray(params) ? params : [params];
  return arr.map(p => String(p).split('/').map(x => x.trim()));
}

(async () => {
  const charBin = rd(path.join(SD, 'character.json'));
  const discBin = rd(path.join(SD, 'disc.json'));
  const chars = rd(path.join(OUT, 'characters.json')).characters;
  const pats = rd(path.join(OUT, 'patterns.json')).patterns;
  const potBin = rd(path.join(SD, 'CN/bin/Potential.json'));

  // ===== 旅人技能 ===== 
  const skills = {};
  let sCount = 0;
  chars.forEach(c => {
    if (!c.sid) return;
    const s = charBin[String(c.sid)];
    if (!s) return;
    const one = {};
    [['normalAtk', '普攻'], ['skill', '主控'], ['supportSkill', '援护'], ['ultimate', '绝招']].forEach(([k, label]) => {
      const v = s[k];
      if (!v) return;
      one[k] = {
        label: label,
        name: v.nameCN || v.name || '',
        desc: clean(v.descCN || v.desc),
        params: splitParams(v.params),
        tips: v.paramsTooltips || null,
        icon: v.icon || null,
        cd: v.cooldown || null,
        energy: v.energyLimit != null ? v.energyLimit : null
      };
      sCount++;
    });
    if (Object.keys(one).length) skills[c.id] = one;
  });
  wr(path.join(OUT, 'character-skills.json'), skills);

  // ===== 潜能各级数值（每个潜能的 params 与等级上限）=====
  const pots = {};
  let pCount = 0;
  chars.forEach(c => {
    if (!c.sid) return;
    const s = charBin[String(c.sid)];
    if (!s || !s.potential) return;
    const one = {};
    ['mainCore', 'mainNormal', 'common', 'supportCore', 'supportNormal'].forEach(g => {
      (s.potential[g] || []).forEach(p => {
        const meta = potBin[String(p.id)] || {};
        one[p.id] = {
          params: splitParams(p.params),
          max: meta.MaxLevel || null,
          group: g,
          desc: clean(p.descCN) || null
        };
        pCount++;
      });
    });
    if (Object.keys(one).length) pots[c.id] = one;
  });
  wr(path.join(OUT, 'potential-levels.json'), pots);

  // ===== 旅人基础数值（只保留等级/生命/攻击/防御，去重压缩）=====
  const stats = {};
  chars.forEach(c => {
    if (!c.sid) return;
    const s = charBin[String(c.sid)];
    if (!s || !Array.isArray(s.stat)) return;
    // 每级一组，只留三个数，用数组存
    stats[c.id] = s.stat.map(r => [r.Level, r.HP, r.ATK, r.DEF]);
  });
  wr(path.join(OUT, 'character-stats.json'), stats);

  // ===== 秘纹各级数值与音符 ===== 
  const dskills = {};
  pats.forEach(p => {
    if (!p.sid) return;
    const d = discBin[String(p.sid)];
    if (!d) return;
    const one = { stat: d.stat || null, supportNote: d.supportNote || null };
    const ms = d.mainSkill || {};
    one.main = { name: ms.nameCN || '', params: splitParams(ms.params) };
    [['secondarySkill1', 'h1'], ['secondarySkill2', 'h2']].forEach(([k, key]) => {
      const v = d[k];
      if (!v) return;
      one[key] = { name: v.nameCN || '', desc: clean(v.descCN || v.desc), params: splitParams(v.params), icon: v.icon || null };
    });
    dskills[p.id] = one;
  });
  wr(path.join(OUT, 'disc-skills.json'), dskills);

  const size = f => Math.round(fs.statSync(path.join(OUT, f)).size / 1024);
  console.log('旅人技能:       ' + Object.keys(skills).length + ' 人 / ' + sCount + ' 个技能  ->  character-skills.json  ' + size('character-skills.json') + ' KB');
  console.log('旅人基础数值:   ' + Object.keys(stats).length + ' 人            ->  character-stats.json   ' + size('character-stats.json') + ' KB');
  console.log('秘纹数值与音符: ' + Object.keys(dskills).length + ' 个            ->  disc-skills.json       ' + size('disc-skills.json') + ' KB');
  console.log('潜能各级数值:   ' + Object.keys(pots).length + ' 人 / ' + pCount + ' 个潜能  ->  potential-levels.json  ' + size('potential-levels.json') + ' KB');
})();
