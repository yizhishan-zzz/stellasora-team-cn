/**
 * check-deploy.js —— 检查线上站点是否已经是本地最新版本
 *
 * 用法：node --use-system-ca tools/check-deploy.js [等待秒数]
 *
 * 会对比这几个文件的指纹：
 *   assets/js/main.js   assets/css/style.css   teams.html   index.html
 * Cloudflare Pages 部署需要几十秒，所以默认最多等 120 秒。
 * 退出码：0 = 线上已最新；1 = 还在部署 / 不一致
 */
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://stellasora-team-cn.pages.dev';
const FILES = [
  { p: 'assets/js/main.js',   name: 'main.js' },
  { p: 'assets/css/style.css', name: 'style.css' },
  { p: 'teams.html',           name: 'teams.html' },
  { p: 'index.html',           name: 'index.html' }
];

const WAIT = Number(process.argv[2] || 120);

function norm(s) {
  return String(s || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}
function hash(s) {
  return crypto.createHash('sha1').update(norm(s), 'utf8').digest('hex').slice(0, 10);
}

function get(url) {
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'check-deploy/1.0', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http') ? res.headers.location : (BASE + res.headers.location);
        res.resume();
        return resolve(get(next));
      }
      // 必须按字节收集再统一解码，边收边拼会把中文多字节字符切断
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ ok: res.statusCode === 200, body: Buffer.concat(chunks).toString('utf8'), code: res.statusCode }));
    });
    req.on('error', e => resolve({ ok: false, body: '', code: 0, err: e.message }));

    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const local = {};
  let missing = [];
  FILES.forEach(f => {
    const p = path.join(ROOT, f.p);
    if (!fs.existsSync(p)) { missing.push(f.p); return; }
    local[f.p] = hash(fs.readFileSync(p, 'utf8'));
  });
  if (missing.length) {
    console.log('[X] 本地缺少文件: ' + missing.join(', '));
    process.exit(1);
  }

  console.log('检查线上站点是否已更新（最多等 ' + WAIT + ' 秒）...');
  const started = Date.now();
  let last = null;
  while (true) {
    const rows = [];
    let allOk = true;
    for (const f of FILES) {
      // 加时间戳参数，绕开 CDN 缓存，拿到真实的线上文件
      const r = await get(BASE + '/' + f.p + '?cb=' + Date.now());
      const online = r.ok ? hash(r.body) : '(取不到)';
      const same = r.ok && online === local[f.p];
      if (!same) allOk = false;
      rows.push({ name: f.name, same, code: r.code });
    }
    last = rows;
    if (allOk) {
      rows.forEach(x => console.log('  [OK] ' + x.name + '  已是最新'));
      console.log('');
      console.log('[OK] 线上已经是本地最新版本（用时 ' + Math.round((Date.now() - started) / 1000) + ' 秒）');
      process.exit(0);
    }
    if (Date.now() - started > WAIT * 1000) break;
    console.log('  还在部署... ' + rows.map(x => x.name + (x.same ? '=OK' : '=旧')).join('  '));
    await sleep(8000);
  }

  console.log('');
  (last || []).forEach(x => console.log('  [' + (x.same ? 'OK' : '旧') + '] ' + x.name));
  console.log('');
  console.log('[!] 线上还没更新完。常见原因：');
  console.log('    1. Cloudflare Pages 正在构建（通常 1 分钟内，稍后再看）');
  console.log('    2. 浏览器缓存了旧文件 —— 按 Ctrl+Shift+R 强制刷新，或用无痕窗口');
  console.log('    3. 构建失败 —— 打开 Cloudflare Pages 的 Deployments 看有没有报错');
  process.exit(1);
})();