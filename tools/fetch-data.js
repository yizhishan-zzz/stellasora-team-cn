/**
 * fetch-data.js —— 从 GitHub 下载 ss-data（旅人 / 秘纹 / 潜能）
 *
 * 替代原来的 fetch-data.ps1：PowerShell 的 Invoke-WebRequest 在本机会被
 * TLS/代理挡住（而且它设了静默错误，失败了也不报），所以改成 Node 实现。
 *
 * 用法: node --use-system-ca tools/fetch-data.js
 *       不带 --use-system-ca 也能跑：脚本自带降级（见下）
 *
 * 下载到: tools/ss-data/
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT = path.join(__dirname, 'ss-data');
const BASE = 'https://raw.githubusercontent.com/AutumnVN/ss-data/refs/heads/main/';
const FILES = [
  'character.json',
  'disc.json',
  'CN/bin/CharPotential.json',
  'CN/bin/Potential.json',
  'CN/language/zh_CN/Character.json',
  'CN/language/zh_CN/Potential.json'
];

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
        if (buf.length < 100) return reject(new Error('内容过小 (' + buf.length + ' 字节)'));
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
  // 探测证书模式：本机 DNS 被代理接管时需要放宽校验
  let strict = true;
  try {
    await get(BASE + FILES[0], path.join(OUT, FILES[0]), true, 0);
    fs.unlinkSync(path.join(OUT, FILES[0]));
  } catch (e) {
    if (/certificate|self.signed|unable to verify/i.test(String(e.message))) {
      strict = false;
      console.log('[提示] 本机证书链无法用系统根证书校验，已改用放宽校验模式下载公开数据。');
    }
  }

  console.log('下载 ss-data 到 ' + path.relative(path.join(__dirname, '..'), OUT));
  let ok = 0, fail = 0;
  for (const f of FILES) {
    const dest = path.join(OUT, f.split('/').join(path.sep));
    try {
      const size = await get(BASE + f, dest, strict, 0);
      console.log('  [OK]   ' + f + '  ' + Math.round(size / 1024) + ' KB');
      ok++;
    } catch (e) {
      console.log('  [失败] ' + f + '  ' + e.message);
      fail++;
    }
  }
  console.log('');
  console.log('完成：成功 ' + ok + ' 个，失败 ' + fail + ' 个');
  if (fail) { console.log('失败的话检查网络，或换用 --use-system-ca 再试一次。'); process.exit(1); }
})();
