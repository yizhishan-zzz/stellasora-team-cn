/**
 * rewrite-history-email.js —— 把 git 历史里的指定字符串（如旧邮箱）整体替换掉
 *
 * 用途：某个提交的 diff 暴露了不该公开的信息，需要从所有历史提交里抹掉。
 * 做法：用 git 底层命令逐提交重建历史，等价于
 *   git filter-branch --tree-filter 'sed -i s/旧/新/g 文件' --prune-empty
 * 但不依赖 sh（某些受限环境跑不了 filter-branch），且会顺手把变空的提交删掉。
 *
 * 用法：
 *   node tools/rewrite-history-email.js 旧值 新值 --dry-run   # 只看会改什么
 *   node tools/rewrite-history-email.js 旧值 新值             # 真正改写
 *
 * 注意：改写会改变所有后续提交的 SHA，之后必须 git push --force。
 *       改写前请先 git branch backup-xxx 备份。
 */
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET_FILE = 'assets/js/main.js';
const OLD = process.argv[2];
const NEW = process.argv[3];
const DRY = process.argv.indexOf('--dry-run') >= 0;
if (!OLD || !NEW) {
  console.error('用法: node tools/rewrite-history-email.js <旧值> <新值> [--dry-run]');
  process.exit(1);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rwmail-'));
const tmp = (n) => path.join(TMP, n);

// 运行 git，输出写到临时文件（不用管道，受限环境下也能跑）
function git(args, env) {
  const outFile = tmp('out');
  const errFile = tmp('err');
  const fdOut = fs.openSync(outFile, 'w');
  const fdErr = fs.openSync(errFile, 'w');
  const res = cp.spawnSync('git', args, {
    cwd: ROOT,
    env: Object.assign({}, process.env, env || {}),
    stdio: ['ignore', fdOut, fdErr],   // stdout / stderr 分开，避免警告污染取值
    maxBuffer: 1 << 30
  });
  fs.closeSync(fdOut);
  fs.closeSync(fdErr);
  return { status: res.status, text: fs.readFileSync(outFile, 'utf8'), err: fs.readFileSync(errFile, 'utf8') };
}
function gitRaw(args, env) {
  const r = git(args, env);
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' 失败：' + r.text.slice(0, 300));
  return r.text;
}
function gitTrim(args, env) { return gitRaw(args, env).trim(); }

const branch = gitTrim(['rev-parse', '--abbrev-ref', 'HEAD']);
const oldHead = gitTrim(['rev-parse', 'HEAD']);
const commits = gitTrim(['rev-list', '--reverse', '--topo-order', 'HEAD']).split('\n').filter(Boolean);
console.log('分支 ' + branch + '，共 ' + commits.length + ' 个提交，开始重建…');
console.log('把 ' + TARGET_FILE + ' 里的 ' + OLD + ' 替换为 ' + NEW);

const map = new Map();
let touched = 0, pruned = 0, newHead = null;

function parseIdent(s) {
  const m = /^(.+) <(.+)> (\d+) ([+-]\d{4})$/.exec(s || '');
  return m ? { name: m[1], email: m[2], date: m[3] + ' ' + m[4] } : null;
}

for (const sha of commits) {
  const raw = gitRaw(['cat-file', 'commit', sha]);
  const cut = raw.indexOf('\n\n');
  const header = raw.slice(0, cut);
  const message = raw.slice(cut + 2);
  let tree = null, author = null, committer = null;
  const parents = [];
  header.split('\n').forEach(function (l) {
    if (l.indexOf('tree ') === 0) tree = l.slice(5).trim();
    else if (l.indexOf('parent ') === 0) parents.push(l.slice(7).trim());
    else if (l.indexOf('author ') === 0) author = l.slice(7);
    else if (l.indexOf('committer ') === 0) committer = l.slice(10);
  });
  const newParents = parents.map(function (p) { return map.has(p) ? map.get(p) : p; });

  // 需要改这棵树的 main.js 吗
  let newTree = tree;
  const probe = git(['rev-parse', sha + ':' + TARGET_FILE]);
  if (probe.status === 0 && probe.text.trim()) {
    const blob = probe.text.trim();
    const content = gitRaw(['cat-file', '-p', blob]);
    if (content.indexOf(OLD) >= 0) {
      const fixed = content.split(OLD).join(NEW);
      const f = tmp('main.js');
      fs.writeFileSync(f, fixed, 'utf8');
      // --no-filters：按原样计算哈希，避免 autocrlf 改变内容
      const newBlob = gitTrim(['hash-object', '-w', '--no-filters', f]);
      const idxFile = tmp('index');
      try { fs.unlinkSync(idxFile); } catch (e) {}
      const env = { GIT_INDEX_FILE: idxFile };
      gitTrim(['read-tree', tree], env);
      gitTrim(['update-index', '--add', '--cacheinfo', '100644,' + newBlob + ',' + TARGET_FILE], env);
      newTree = gitTrim(['write-tree'], env);
      touched++;
    }
  }

  // 内容与父提交完全一样 -> 这个提交变成空的，直接删掉（例如「邮箱已更新」那种）
  if (newParents.length === 1) {
    const parentTree = gitTrim(['rev-parse', newParents[0] + '^{tree}']);
    if (parentTree === newTree) {
      map.set(sha, newParents[0]);
      pruned++;
      console.log('  删掉变空的提交: ' + sha.slice(0, 7) + ' ' + message.split('\n')[0]);
      continue;
    }
  }

  const args = ['commit-tree', newTree];
  newParents.forEach(function (p) { args.push('-p', p); });
  const msgFile = tmp('msg');
  fs.writeFileSync(msgFile, message, 'utf8');
  args.push('-F', msgFile);
  const env = {};
  const a = parseIdent(author), c = parseIdent(committer);
  if (a) { env.GIT_AUTHOR_NAME = a.name; env.GIT_AUTHOR_EMAIL = a.email; env.GIT_AUTHOR_DATE = a.date; }
  if (c) { env.GIT_COMMITTER_NAME = c.name; env.GIT_COMMITTER_EMAIL = c.email; env.GIT_COMMITTER_DATE = c.date; }
  const created = gitTrim(args, env);
  map.set(sha, created);
  newHead = created;
}

console.log('');
console.log('改写完成：' + touched + ' 个提交的内容被替换，' + pruned + ' 个提交因变空被删除');
console.log('旧 HEAD: ' + oldHead);
console.log('新 HEAD: ' + newHead);

if (DRY) {
  console.log('（--dry-run 模式，没有真正改动仓库）');
} else {
  gitTrim(['update-ref', 'refs/heads/' + branch, newHead]);
  gitTrim(['reset', '--hard', newHead]);
  console.log('已更新分支 ' + branch + ' 并同步工作区');
}
fs.rmSync(TMP, { recursive: true, force: true });