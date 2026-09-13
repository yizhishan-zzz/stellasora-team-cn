/**
 * serve.js —— 零依赖本地静态服务器 + 配队数据保存接口
 * 用法：node serve.js [端口]    （默认 8080）
 *
 * 除了静态文件，还提供两个接口（浏览器不允许网页直接写磁盘，所以只能由本机服务器代写）：
 *   GET  /api/teams  → 读 assets/data/preset-teams.json
 *   PUT  /api/teams  → 写回该文件（每次写入前自动备份到 assets/data/_backup/）
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

async function handleApi(req, res, urlPath) {
  if (urlPath !== '/api/teams') { sendJson(res, 404, { error: '未知接口' }); return true; }
  if (req.method === 'OPTIONS') { sendJson(res, 204, {}); return true; }
  if (req.method === 'GET') {
    try {
      if (!fs.existsSync(TEAMS_FILE)) { sendJson(res, 200, { teams: [] }); return true; }
      const data = fs.readFileSync(TEAMS_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      res.end(data);
    } catch (e) { sendJson(res, 500, { error: e.message }); }
    return true;
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    try {
      const raw = await readBody(req, 20 * 1024 * 1024);
      const clean = normalizeTeams(JSON.parse(raw));
      backupTeams();
      fs.writeFileSync(TEAMS_FILE, JSON.stringify(clean, null, 2), 'utf8');
      console.log('  [保存] ' + clean.teams.length + ' 个配队 → ' + path.relative(ROOT, TEAMS_FILE));
      sendJson(res, 200, { ok: true, teams: clean.teams.length, file: 'assets/data/preset-teams.json' });
    } catch (e) {
      sendJson(res, 400, { error: e.message });
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