/**
 * serve.js —— 零依赖本地静态服务器 + 配队数据保存接口
 * 用法：node serve.js [端口]    （默认 8080）
 *
 * 除了静态文件，还提供几个接口（浏览器不允许网页直接写磁盘，所以只能由本机服务器代写）：
 *   GET/PUT /api/teams      → assets/data/preset-teams.json
 *   GET/PUT /api/char-meta  → assets/data/char-meta.json（旅人加强状态）
 *   GET/PUT /api/updates    → assets/data/updates.json（更新日志）
 *   POST    /api/image      → assets/img/updates/<name>.png（更新日志配图）
 *
 * 每次写入前自动备份到 assets/data/_backup/。
 * 这样在站内改的东西会直接落到仓库文件里，「一键更新并发布.bat」能一起推上去。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2], 10) || 8080;
const ROOT = path.join(__dirname, '..');
const TEAMS_FILE = path.join(ROOT, 'assets', 'data', 'preset-teams.json');
const BACKUP_DIR = path.join(ROOT, 'assets', 'data', '_backup');
const MAX_BACKUPS = 20;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS'
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('数据过大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// 写入前先备份，最多留 MAX_BACKUPS 份
function backupTeams() {
  try {
    if (!fs.existsSync(TEAMS_FILE)) return;
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(TEAMS_FILE, path.join(BACKUP_DIR, 'preset-teams.' + stamp + '.json'));
    const olds = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('preset-teams.')).sort();
    while (olds.length > MAX_BACKUPS) {
      const f = olds.shift();
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (e) {}
    }
  } catch (e) { console.error('[备份失败]', e.message); }
}

function normalizeTeams(obj) {
  if (!obj || !Array.isArray(obj.teams)) throw new Error('数据格式不对：需要 { teams: [...] }');
  const teams = obj.teams.map(t => {
    if (!t || typeof t.id !== 'string' || !t.id) throw new Error('有配队缺少 id');
    return t;
  });
  return { teams: teams, updatedAt: new Date().toISOString() };
}

// 站内编辑可以直接写回的数据文件（本地服务器专用）
const DATA_FILES = {
  '/api/teams': { file: TEAMS_FILE, key: 'teams' },
  '/api/char-meta': { file: path.join(ROOT, 'assets', 'data', 'char-meta.json'), key: 'chars', type: 'object' },
  '/api/char-builds': { file: path.join(ROOT, 'assets', 'data', 'char-builds.json'), key: 'builds', type: 'object' },
  '/api/char-emblems': { file: path.join(ROOT, 'assets', 'data', 'char-emblems.json'), key: 'emblems', type: 'object' },
  '/api/updates': { file: path.join(ROOT, 'assets', 'data', 'updates.json'), key: 'entries', type: 'array' }
};

// 通用备份（最多留 MAX_BACKUPS 份）
function backupFile(file) {
  try {
    if (!fs.existsSync(file)) return;
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = path.basename(file, '.json');
    fs.copyFileSync(file, path.join(BACKUP_DIR, base + '.' + stamp + '.json'));
    const olds = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith(base + '.')).sort();
    while (olds.length > MAX_BACKUPS) {
      const f = olds.shift();
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (e) {}
    }
  } catch (e) { console.error('[备份失败]', e.message); }
}

// 图片上传（本地）：POST /api/image  { name, dataUrl }
async function handleImageUpload(req, res) {
  try {
    const raw = await readBody(req, 16 * 1024 * 1024);
    const body = JSON.parse(raw);
    const m = /^data:image\/(png|jpeg|jpg|webp);base64,([\s\S]+)$/.exec(String(body.dataUrl || ''));
    if (!m) { sendJson(res, 400, { ok: false, error: '图片格式不对（只支持 png/jpg/webp）' }); return true; }
    const ext = (m[1] === 'jpeg' || m[1] === 'jpg') ? 'jpg' : m[1];
    const safe = String(body.name || ('xtlr_update_' + Date.now())).replace(/[^\w\-]/g, '_').slice(0, 80);
    const dir = path.join(ROOT, 'assets', 'img', 'updates');
    fs.mkdirSync(dir, { recursive: true });
    const rel = 'assets/img/updates/' + safe + '.' + ext;
    fs.writeFileSync(path.join(ROOT, rel), Buffer.from(m[2], 'base64'));
    console.log('  [上传] ' + rel);
    sendJson(res, 200, { ok: true, path: rel });
  } catch (e) {
    sendJson(res, 400, { ok: false, error: e.message });
  }
  return true;
}

async function handleApi(req, res, urlPath) {
  if (urlPath === '/api/image') {
    if (req.method === 'OPTIONS') { sendJson(res, 204, {}); return true; }
    if (req.method === 'POST') return await handleImageUpload(req, res);
    sendJson(res, 405, { error: '不支持的方法' });
    return true;
  }
  const target = DATA_FILES[urlPath];
  if (!target) { sendJson(res, 404, { error: '未知接口' }); return true; }
  if (req.method === 'OPTIONS') { sendJson(res, 204, {}); return true; }

  if (req.method === 'GET') {
    try {
      if (!fs.existsSync(target.file)) { sendJson(res, 200, {}); return true; }
      const data = fs.readFileSync(target.file, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      res.end(data);
    } catch (e) { sendJson(res, 500, { error: e.message }); }
    return true;
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    try {
      const raw = await readBody(req, 20 * 1024 * 1024);
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') throw new Error('数据格式不对：需要 JSON 对象');
      const wantArray = target.type !== 'object';
      const got = obj[target.key];
      if (wantArray ? !Array.isArray(got) : (typeof got !== 'object' || got === null || Array.isArray(got))) {
        throw new Error('缺少字段 ' + target.key + '（应为' + (wantArray ? '数组' : '对象') + '）');
      }
      obj.updatedAt = new Date().toISOString();
      backupFile(target.file);
      fs.writeFileSync(target.file, JSON.stringify(obj, null, 2), 'utf8');
      const n = wantArray ? obj[target.key].length : Object.keys(obj[target.key]).length;
      console.log('  [保存] ' + n + ' 条 → ' + path.relative(ROOT, target.file));
      sendJson(res, 200, { ok: true, count: n, file: path.relative(ROOT, target.file).replace(/\\/g, '/') });
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e.message });
    }
    return true;
  }
  sendJson(res, 405, { error: '不支持的方法' });
  return true;
}

const server = http.createServer((req, res) => {
  (async () => {
    try {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath.indexOf('/api/') === 0) { await handleApi(req, res, urlPath); return; }
      if (urlPath === '/') urlPath = '/index.html';

      const filePath = path.normalize(path.join(ROOT, urlPath));
      if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        // 禁用缓存：开发时改了 JS/图片，刷新即可生效
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store, must-revalidate' });
        res.end(data);
      });
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('400 Bad Request');
    }
  })();
});

server.listen(PORT, () => {
  const url = 'http://localhost:' + PORT + '/';
  console.log('');
  console.log('  [OK] 服务器已启动');
  console.log('  -> ' + url);
  console.log('  配队数据文件: ' + path.relative(ROOT, TEAMS_FILE));
  console.log('  自动备份目录: ' + path.relative(ROOT, BACKUP_DIR));
  console.log('  按 Ctrl+C 停止');
  console.log('');

  if (process.env.NO_OPEN !== '1') {
    try {
      const { exec } = require('child_process');
      const cmd = process.platform === 'win32'
        ? 'start "" "' + url + '"'
        : process.platform === 'darwin' ? 'open "' + url + '"' : 'xdg-open "' + url + '"';
      exec(cmd);
    } catch (e) { /* 打开浏览器失败不影响服务 */ }
  }
});