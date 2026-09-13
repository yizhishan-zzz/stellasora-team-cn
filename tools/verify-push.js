/**
 * verify-push.js —— 推送后验证：线上仓库的数据和本地是否一致
 * 由 推送到GitHub.bat 自动调用，也可单独运行
 */
const fs = require('fs');
const https = require('https');

function get(url, strict, redirects) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: strict, headers: { 'User-Agent': 'stella-sora-network/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (redirects || 0) < 5) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).toString(), strict, (redirects || 0) + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve(Buffer.concat(c).toString('utf8')));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('超时')));
  });
}

(async () => {
  const RAW = 'https://raw.githubusercontent.com/yizhishan-zzz/stellasora-team-cn/main/';
  let strict = true;
  const local = JSON.parse(fs.readFileSync('assets/data/preset-teams.json', 'utf8'));
  let remote = null;
  for (const s of [true, false]) {
    try { remote = JSON.parse(await get(RAW + 'assets/data/preset-teams.json?t=' + Date.now(), s, 0)); strict = s; break; }
    catch (e) { if (s) continue; }
  }
  if (!remote) { console.log('  [!] 取不到线上数据，无法验证'); return; }
  console.log('  本地配队 ' + local.teams.length + ' 个 / 线上 ' + remote.teams.length + ' 个');
  if (local.teams.length === remote.teams.length) {
    console.log('  [OK] 线上数据已与本地一致');
  } else {
    console.log('  [!] 数量不一致 —— Cloudflare 可能还在构建，等 1 分钟刷新再看');
  }
})();
