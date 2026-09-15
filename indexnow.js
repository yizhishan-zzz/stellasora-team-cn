// IndexNow：向 Bing / Yandex / Seznam 即时提交网址收录请求
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

const HOST = 'stellasora-team-cn.pages.dev';
const URLS = [
  'https://stellasora-team-cn.pages.dev/',
  'https://stellasora-team-cn.pages.dev/characters.html',
  'https://stellasora-team-cn.pages.dev/patterns.html',
  'https://stellasora-team-cn.pages.dev/teams.html',
  'https://stellasora-team-cn.pages.dev/character.html',
  'https://stellasora-team-cn.pages.dev/pattern.html',
  'https://stellasora-team-cn.pages.dev/team.html'
];

function post(url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) }, headers)
    }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString('utf8').slice(0, 300) }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('超时')));
    req.write(body);
    req.end();
  });
}

(async () => {
  // IndexNow 要求一个验证 key：放在网站根目录的 <key>.txt，内容就是 key
  const KEY = crypto.randomBytes(16).toString('hex');
  console.log('生成 IndexNow key: ' + KEY);
  fs.writeFileSync(KEY + '.txt', KEY, 'utf8');
  console.log('已生成验证文件: ' + KEY + '.txt （需要推送到网站根目录）');
  console.log('');

  const body = JSON.stringify({ host: HOST, key: KEY, keyLocation: 'https://' + HOST + '/' + KEY + '.txt', urlList: URLS });
  const endpoints = ['https://api.indexnow.org/indexnow', 'https://www.bing.com/indexnow', 'https://yandex.com/indexnow'];
  for (const ep of endpoints) {
    try {
      const r = await post(ep, body, {});
      console.log('  ' + ep + ' -> HTTP ' + r.status + (r.body ? '  ' + r.body : ''));
    } catch (e) {
      console.log('  ' + ep + ' -> 失败: ' + e.message);
    }
  }
  console.log('');
  console.log('说明：keyLocation 必须真实可访问，否则请求会被拒。');
  console.log('所以要先推送 key 文件，再重跑本脚本。');
})().catch(e => console.log('ERR', e.message));
