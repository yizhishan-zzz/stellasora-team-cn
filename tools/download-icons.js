/**
 * download-icons.js —— 从 stelladb 的素材库下载「高清」图标
 *
 * 数据源: github.com/AutumnVN/ssassets
 *   1) 潜能图标      icon/potential/<ss-data icon>_A.webp    → assets/img/hd/potential/
 *   2) 秘纹效果图    icon/discskill/<disc.mainSkill.icon>.webp → assets/img/hd/discskill/
 *   3) 秘纹 buff 图  icon/buff/<disc.mainSkill.buffIcon>.webp  → assets/img/hd/buff/
 *
 * 需要先跑 tools/fetch-data.ps1（或 更新数据.bat 第 1 步）拿到 ss-data。
 *
 * 用法:
 *   node --use-system-ca tools/download-icons.js             # 全部
 *   node --use-system-ca tools/download-icons.js --type=potential|skill|buff
 *   node --use-system-ca tools/download-icons.js --force     # 忽略已存在，重新下载
 *   node --use-system-ca tools/download-icons.js --limit=20  # 只下前 N 个（调试）
 *
 * 说明:
 *   - 本机 DNS 若被代理接管（解析到 127.0.0.1）会换用代理自签 CA，
 *     因此脚本自带「严格校验失败 → 放宽证书校验」的降级，且只访问 raw.githubusercontent.com。
 *   - 已存在且体积合理的文件默认跳过，可反复运行做增量更新。
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const SS = path.join(__dirname, 'ss-data');
const RAW = 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/';
const OUT = {
  potential: path.join(ROOT, 'assets/img/hd/potential'),
  skill: path.join(ROOT, 'assets/img/hd/discskill'),
  buff: path.join(ROOT, 'assets/img/hd/buff')
};
const MIN_BYTES = 200;
const CONCURRENCY = 12;
const RETRY = 2;

const args = process.argv.slice(2);
const opt = {
  force: args.includes('--force'),
  types: (args.find(a => a.startsWith('--type=')) || '--type=potential,skill,buff').split('=')[1].split(',').map(s => s.trim()).filter(Boolean),
  limit: parseInt((args.find(a => a.startsWith('--limit=')) || '--limit=0').split('=')[1], 10) || 0
};

const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));
function need(p, tip) {
  if (!fs.existsSync(p)) { console.error('[缺少] ' + p); console.error(tip); process.exit(1); }
}

// ---------- 收集需要下载的文件 ----------
function collect() {
  const list = [];
  if (opt.types.includes('potential')) {
    const f = path.join(SS, 'character.json');
    need(f, '请先运行 tools/fetch-data.ps1 下载 ss-data');
    const chars = rd(f);
    const seen = new Set();
    for (const id in chars) {
      const pot = chars[id].potential || {};
      for (const k in pot) for (const p of pot[k]) {
        if (!p.icon || seen.has(p.icon)) continue;
        seen.add(p.icon);
        list.push({ type: 'potential', name: p.icon + '_A', src: 'export/assets/assetbundles/icon/potential/' + p.icon + '_A.webp', out: path.join(OUT.potential, p.icon + '_A.webp') });
      }
    }
  }
  if (opt.types.includes('skill') || opt.types.includes('buff')) {
    const f = path.join(SS, 'disc.json');
    need(f, '请先运行 tools/fetch-data.ps1 下载 ss-data');
    const discs = rd(f);
    const seenS = new Set(), seenB = new Set();
    for (const id in discs) {
      const d = discs[id];
      const skills = [d.mainSkill, d.secondarySkill1, d.secondarySkill2].filter(Boolean);
      for (const s of skills) {
        if (opt.types.includes('skill') && s.icon && !seenS.has(s.icon)) {
          seenS.add(s.icon);
          list.push({ type: 'skill', name: s.icon, src: 'export/assets/assetbundles/icon/discskill/' + s.icon + '.webp', out: path.join(OUT.skill, s.icon + '.webp') });
        }
        if (opt.types.includes('buff')) for (const b of (s.buffIcon || [])) {
          if (!b || b === 'No Icon' || seenB.has(b)) continue;
          seenB.add(b);
          list.push({ type: 'buff', name: b, src: 'export/assets/assetbundles/icon/buff/' + b + '.webp', out: path.join(OUT.buff, b + '.webp') });
        }
      }
    }
  }
  return opt.limit > 0 ? list.slice(0, opt.limit) : list;
}

// ---------- 下载（严格证书 → 降级） ----------
let relaxNoticeShown = false;
function fetchTo(url, dest, strict, redirects) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ca: undefined, rejectUnauthorized: strict, headers: { 'User-Agent': 'stella-sora-network/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (redirects || 0) < 5) {
        res.resume();
        return resolve(fetchTo(new URL(res.headers.location, url).toString(), dest, strict, (redirects || 0) + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < MIN_BYTES) return reject(new Error('内容过小 (' + buf.length + ' 字节)'));
        fs.writeFileSync(dest, buf);
        resolve(buf.length);
      });
    });
    req.on('error', reject);
    req.setTimeout(45000, () => req.destroy(new Error('超时')));
  });
}

async function downloadOne(item, strict) {
  for (let attempt = 0; attempt <= RETRY; attempt++) {
    try {
      const size = await fetchTo(RAW + item.src, item.out, strict, 0);
      return { ok: true, size };
    } catch (e) {
      if (attempt === RETRY) throw e;
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
    }
  }
}

(async () => {
  const list = collect();
  if (!list.length) { console.log('没有需要下载的文件（检查 ss-data 是否存在）'); return; }
  for (const dir of Object.values(OUT)) fs.mkdirSync(dir, { recursive: true });

  // 证书模式探测：本机 DNS 被代理接管时需要降级
  let strict = true;
  try {
    await fetchTo(RAW + list[0].src, path.join('.', '.tmp-probe.webp'), true, 0);
    fs.unlinkSync('.tmp-probe.webp');
  } catch (e) {
    if (/certificate|self.signed|unable to verify/i.test(String(e.message))) {
      strict = false;
      relaxNoticeShown = true;
    }
  }
  if (relaxNoticeShown) console.log('[提示] 本机 HTTPS 证书链无法用系统根证书校验（常见于 DNS/代理接管），已改用放宽校验模式下载公开素材。');

  const todo = opt.force ? list : list.filter(it => !(fs.existsSync(it.out) && fs.statSync(it.out).length >= MIN_BYTES));
  const skipped = list.length - todo.length;
  console.log('待下载 ' + todo.length + ' 个（已存在跳过 ' + skipped + ' 个，共 ' + list.length + ' 个）');

  let ok = 0, fail = 0;
  const failures = [];
  let cursor = 0;
  const workers = new Array(Math.min(CONCURRENCY, todo.length || 1)).fill(0).map(async () => {
    while (cursor < todo.length) {
      const it = todo[cursor++];
      try {
        const r = await downloadOne(it, strict);
        ok++;
        if (ok % 50 === 0) console.log('  ...已下载 ' + ok + '/' + todo.length);
        void r;
      } catch (e) {
        fail++;
        failures.push(it.src + '  (' + e.message + ')');
      }
    }
  });
  await Promise.all(workers);

  // 各目录统计
  const count = d => fs.readdirSync(d).filter(f => f.endsWith('.webp')).length;
  console.log('');
  console.log('========================================');
  console.log('  本次下载成功 ' + ok + ' 个，失败 ' + fail + ' 个，跳过 ' + skipped + ' 个');
  console.log('  潜能高清图标 ' + count(OUT.potential) + ' 个 -> assets/img/hd/potential/');
  console.log('  秘纹效果图   ' + count(OUT.skill) + ' 个 -> assets/img/hd/discskill/');
  console.log('  秘纹 buff 图 ' + count(OUT.buff) + ' 个 -> assets/img/hd/buff/');
  if (failures.length) {
    console.log('  失败清单（前 10 条）:');
    failures.slice(0, 10).forEach(f => console.log('    ' + f));
  }
  console.log('========================================');
  process.exit(fail && !ok ? 1 : 0);
})();
