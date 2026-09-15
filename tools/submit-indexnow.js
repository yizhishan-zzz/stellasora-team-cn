/**
 * submit-indexnow.js —— 把网站推给搜索引擎（IndexNow 协议）
 *
 * IndexNow 被 Bing、Yandex、Seznam 等支持，提交后通常几小时到几天内收录。
 * 用法：node --use-system-ca tools/submit-indexnow.js
 *
 * 注意：网站根目录必须有 <key>.txt 验证文件（内容就是 key 本身）。
 *       这个文件已经放好了，改动后请一并推送。
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KEY = fs.readFileSync(path.join(__dirname, 'indexnow-key.txt'), 'utf8').trim();
const HOST = 'stellasora-team-cn.pages.dev';
const BASE = 'https://' + HOST;

const PAGES = ['/', '/characters.html', '/patterns.html', '/teams.html', '/character.html', '/pattern.html', '/team.html'];

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString('utf8').slice(0, 200) }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('超时')));
    req.write(body);
    req.end();
  });
}

(async () => {
  // 先确认 key 文件已上线，否则提交会被拒
  const keyUrl = BASE + '/' + KEY + '.txt';
  let ok = false;
  try {
    const r = await fetch(keyUrl + '?t=' + Date.now());
    const txt = (await r.text()).trim();
    ok = r.ok && txt === KEY;
    console.log('验证文件 ' + keyUrl);
    console.log('  HTTP ' + r.status + '  内容匹配: ' + (txt === KEY ? '是' : '否'));
  } catch (e) {
    console.log('  取不到验证文件: ' + e.message);
  }
  if (!ok) {
    console.log('');
    console.log('[!] 验证文件还没上线，先推送一次（推送到GitHub.bat）再跑本脚本。');
    process.exit(1);
  }
  const body = JSON.stringify({ host: HOST, key: KEY, keyLocation: keyUrl, urlList: PAGES.map(p => BASE + p) });
  const endpoints = ['https://api.indexnow.org/indexnow', 'https://www.bing.com/indexnow', 'https://yandex.com/indexnow'];
  console.log('');
  console.log('提交 ' + PAGES.length + ' 个页面：');
  for (const ep of endpoints) {
    try {
      const r = await post(ep, body);
      console.log('  ' + ep.replace('https://', '') + ' -> HTTP ' + r.status + (r.body ? '  ' + r.body : ''));
    } catch (e) {
      console.log('  ' + ep + ' -> 失败: ' + e.message);
    }
  }
  console.log('');
  console.log('完成。Bing 通常几天内收录；Google 请用 Search Console 提交 sitemap。');
})();
