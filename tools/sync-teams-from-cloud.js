/**
 * sync-teams-from-cloud.js —— 推送前把云端配队合并回本地文件
 *
 * 为什么需要：推送到 GitHub 时会强制覆盖远端。如果本地文件是空的、
 * 而你曾在线上改过配队（数据只在 GitHub 上），强制推送就会把那些改动抹掉。
 * 这个脚本会：取云端数据 + 本地数据，按 id 与 updatedAt 合并，两边都不丢。
 *
 * 由 推送到GitHub.bat 在推送前自动调用，也可以单独运行：
 *   node tools/sync-teams-from-cloud.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'assets', 'data', 'preset-teams.json');
const REPO = 'yizhishan-zzz/stellasora-team-cn';
const BRANCH = 'main';
const FILE = 'assets/data/preset-teams.json';

function get(url, strict, redirects) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: strict, headers: { 'User-Agent': 'stella-sora/1.0' } }, res => {
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
  const local = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const localTeams = Array.isArray(local.teams) ? local.teams : [];
  console.log('本地文件: ' + localTeams.length + ' 个配队');

  let remoteTeams = null;
  const raw = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' + FILE;
  for (const strict of [true, false]) {
    try {
      const txt = await get(raw + '?t=' + Date.now(), strict, 0);
      const j = JSON.parse(txt);
      if (j && Array.isArray(j.teams)) { remoteTeams = j.teams; break; }
    } catch (e) {
      if (strict) continue;
      console.log('[!] 取不到云端数据（' + e.message + '），跳过合并，保持本地不变。');
    }
  }
  if (!remoteTeams) { process.exit(0); }
  console.log('云端仓库: ' + remoteTeams.length + ' 个配队');

  // 合并：按 id，updatedAt 新的赢
  const map = {};
  remoteTeams.forEach(t => { if (t && t.id) map[t.id] = t; });
  let added = 0, updated = 0;
  localTeams.forEach(t => {
    if (!t || !t.id) return;
    const old = map[t.id];
    if (!old) { map[t.id] = t; added++; }
    else if ((t.updatedAt || 0) > (old.updatedAt || 0)) { map[t.id] = t; updated++; }
  });
  const merged = Object.keys(map).map(k => map[k]);
  // 保持稳定顺序：先按 updatedAt，再按 id
  merged.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0) || String(a.id).localeCompare(String(b.id)));

  const onlyRemote = remoteTeams.filter(t => !localTeams.some(x => x.id === t.id));
  const onlyLocal = localTeams.filter(t => !remoteTeams.some(x => x.id === t.id));
  if (onlyRemote.length) { console.log('  云端独有（会补进本地）: ' + onlyRemote.map(t => t.name).join('、')); }
  if (onlyLocal.length) { console.log('  本地独有（会保留）: ' + onlyLocal.map(t => t.name).join('、')); }
  if (updated) console.log('  本地较新（会覆盖云端）: ' + updated + ' 个');

  const same = JSON.stringify(merged.map(t => t.id + '|' + (t.updatedAt || 0))) === JSON.stringify(localTeams.map(t => t.id + '|' + (t.updatedAt || 0)));
  if (same) { console.log('合并结果与本地一致，无需改动。'); process.exit(0); }

  fs.writeFileSync(DATA, JSON.stringify({ teams: merged }, null, 2), 'utf8');
  console.log('已合并写入本地: ' + merged.length + ' 个配队（补入 ' + added + ' 个，覆盖 ' + updated + ' 个）');
})().catch(e => { console.log('[!] 合并失败: ' + e.message); process.exit(0); });
