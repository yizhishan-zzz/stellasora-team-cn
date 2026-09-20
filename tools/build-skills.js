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
        const sp = splitParams(p.params);
        // 等级上限 = 参数里最长的那个（核心潜能 13 级，普通潜能 9 级）
        let maxLv = 1;
        sp.forEach(x => { if (x.length > maxLv) maxLv = x.length; });
        one[p.id] = {
          params: sp,
          max: maxLv,
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
    // 去重：数据里最高级会重复一次（Lv90 与 Lv91 数值相同）
    // 数据里最高级重复了一次（Lv91 与 Lv90 数值完全相同），去重后上限 = 90
    const rows = s.stat.map(r => [r.Level, r.HP, r.ATK, r.DEF]);
    if (rows.length > 1) {
      const a = rows[rows.length - 1], b = rows[rows.length - 2];
      if (a[1] === b[1] && a[2] === b[2] && a[3] === b[3]) rows.pop();
    }
    stats[c.id] = rows;
  });
  wr(path.join(OUT, 'character-stats.json'), stats);

  // ===== 秘纹各级数值与音符 ===== 
  const dskills = {};
  pats.forEach(p => {
    if (!p.sid) return;
    const d = discBin[String(p.sid)];
    if (!d) return;
    // 秘纹数值表：90 个基础级 + 8 个突破级（突破级数值累加到前一级）
    // 注意：字段随星级不同 —— 5星是 [ATK, 元素伤害]，4/3星是 [HP, ATK]
    // 所以这里保留字段名，交给前端按名字显示
    const raw = d.stat || [];
    const keys = raw.length ? Object.keys(raw[0]) : [];
    const toRow = (o) => keys.map(k => o[k]);
    const rowsM = [];
    const incOf = (cur, prev, ki) => Number(cur[keys[ki]] || 0) - Number(prev[keys[ki]] || 0);
    for (let i = 0; i < raw.length; i++) {
      const cur = raw[i];
      const prevRow = raw[i - 1];
      // 突破级判定：用「数值增量明显大于常规增量」来判断
      let isBreak = false;
      if (prevRow) {
        // 取有增量的那一列作为参考（5星是 ATK，4/3星是 HP）
        let ki = 0, best = 0;
        keys.forEach((k, x) => { const v = Number(cur[k] || 0); if (v > best) { best = v; ki = x; } });
        const dCur = incOf(cur, prevRow, ki);
        // 常规增量取前几项的中位数近似（跳过首项）
        let dNorm = 0;
        for (let k = 1; k < i && k < 6; k++) {
          const dd = incOf(raw[k], raw[k - 1], ki);
          if (dd > 0) { dNorm = dd; break; }
        }
        if (!dNorm) dNorm = 1;
        isBreak = dCur >= dNorm * 3;
      }
      if (isBreak && rowsM.length) {
        const baseRow = rowsM[rowsM.length - 1];
        rowsM[rowsM.length - 1] = baseRow.map((v, idx) => (idx === 0 ? v : Number(v) + Number(cur[keys[idx]] || 0)));
      } else {
        rowsM.push(toRow(cur));
      }
    }
    // 第一列是数值主项（5星=元素伤害那种百分比的反而是第二列），按「数值最大的列」当主项排序
    const one = { stat: rowsM, statKeys: keys, supportNote: d.supportNote || null, upgrades: (d.upgrade || []).length, dupeAtk: (d.dupe || []).map(x => x.ATK) };
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
