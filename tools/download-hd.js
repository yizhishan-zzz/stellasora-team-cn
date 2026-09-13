/**
 * download-hd.js —— 下载高清旅人头像与秘纹立绘
 * 替代 download-hd.ps1（PowerShell 的 Invoke-WebRequest 在本机被 TLS/代理挡住）
 * 用法: node --use-system-ca tools/download-hd.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const RAW = 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/';
const OUT = path.join(ROOT, 'assets/img/hd');
const MIN = 200;
const CONCURRENCY = 12;

function get(url, dest, strict, redirects) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: strict, headers: { 'User-Agent': 'stella-sora-network/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (redirects || 0) < 5) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).toString(), dest, strict, (redirects || 0) + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < MIN) return reject(new Error('内容过小'));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        resolve(buf.length);
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('超时')));
  });
}

(async () => {
  const chars = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/characters.json'), 'utf8')).characters;
  const pats = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/patterns.json'), 'utf8')).patterns;
  const list = [];
  for (const c of chars) {
    if (!c.sid) continue;
    list.push({ dir: 'head', name: 'head_' + c.sid + '02_XL', src: 'head/head_' + c.sid + '02_XL.webp' });
  }
  for (const p of pats) {
    if (!p.sid) continue;
    list.push({ dir: 'outfit', name: 'outfit_' + p.sid, src: 'outfit/outfit_' + p.sid + '.webp' });
  }
  // 证书模式探测
  let strict = true;
  try { await get(RAW + list[0].src, path.join(OUT, list[0].dir, list[0].name + '.webp'), true, 0); }
  catch (e) { if (/certificate|self.signed|unable to verify/i.test(String(e.message))) strict = false; }
  if (!strict) console.log('[提示] 已改用放宽证书校验模式。');

  const todo = list.filter(it => {
    const dst = path.join(OUT, it.dir, it.name + '.webp');
    return !(fs.existsSync(dst) && fs.statSync(dst).size >= MIN);
  });
  console.log('共 ' + list.length + ' 个（头像 + 立绘），需要下载 ' + todo.length + ' 个');
  let ok = 0, fail = 0;
  const failures = [];
  let cursor = 0;
  const workers = new Array(Math.min(CONCURRENCY, todo.length || 1)).fill(0).map(async () => {
    while (cursor < todo.length) {
      const it = todo[cursor++];
      try {
        await get(RAW + it.src, path.join(OUT, it.dir, it.name + '.webp'), strict, 0);
        ok++;
        if (ok % 30 === 0) console.log('  ...已下载 ' + ok + '/' + todo.length);
      } catch (e) { fail++; failures.push(it.src + ' (' + e.message + ')'); }
    }
  });
  await Promise.all(workers);
  const count = d => fs.existsSync(path.join(OUT, d)) ? fs.readdirSync(path.join(OUT, d)).filter(f => f.endsWith('.webp')).length : 0;
  console.log('');
  console.log('本次成功 ' + ok + '，失败 ' + fail);
  console.log('  头像目录 ' + count('head') + ' 个');
  console.log('  立绘目录 ' + count('outfit') + ' 个');
  if (failures.length) { console.log('  失败清单（前 5）:'); failures.slice(0, 5).forEach(f => console.log('    ' + f)); }
  process.exit(fail && !ok ? 1 : 0);
})();
