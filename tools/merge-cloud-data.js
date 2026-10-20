/**
 * merge-cloud-data.js —— 推送前把「网页后台」改过的数据合并回本地文件
 *
 * 背景：管理员在网站上写更新日志、改加强状态时，内容是通过 GitHub API 直接提交到云端的。
 *       如果发布脚本拿本地文件强制推送，这些云端提交会被删掉。
 *       所以推送前先把云端的 updates.json / char-meta.json 合并进本地，再一起推上去。
 *
 * 用法（由 PUSH-TO-GITHUB.bat 调用）：
 *   git show origin/main:assets/data/updates.json  > tools/_cloud_updates.json
 *   git show origin/main:assets/data/char-meta.json > tools/_cloud_charmeta.json
 *   node tools/merge-cloud-data.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 兼容 UTF-8 / UTF-16 / 带 BOM 的文件（不同 shell 重定向编码不一样）
function readJson(p) {
  try {
    const buf = fs.readFileSync(p);
    if (!buf.length) return null;
    let text;
    if (buf[0] === 0xFF && buf[1] === 0xFE) text = buf.toString('utf16le');
    else if (buf[0] === 0xFE && buf[1] === 0xFF) { const sw = Buffer.from(buf); sw.swap16(); text = sw.toString('utf16le'); }
    else text = buf.toString('utf8');
    text = text.replace(/^\uFEFF/, '');
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch (e) { return null; }
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

const time = (s) => { const t = Date.parse(s || ''); return isNaN(t) ? 0 : t; };

// 更新日志：按 id 合并，同一条取 updatedAt 较新的
function mergeUpdates(local, cloud) {
  const a = (local && local.entries) || [];
  const b = (cloud && cloud.entries) || [];
  const map = {};
  a.forEach(e => { if (e && e.id) map[e.id] = e; });
  let added = 0, updated = 0;
  b.forEach(e => {
    if (!e || !e.id) return;
    const old = map[e.id];
    if (!old) { map[e.id] = e; added++; return; }
    if (time(e.updatedAt) > time(old.updatedAt)) { map[e.id] = e; updated++; }
  });
  const entries = Object.keys(map).map(k => map[k]);
  entries.sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')) || time(y.updatedAt) - time(x.updatedAt));
  const newer = time(cloud && cloud.updatedAt) > time(local && local.updatedAt) ? (cloud.updatedAt) : ((local && local.updatedAt) || (cloud && cloud.updatedAt) || '');
  return { entries: entries, updatedAt: newer, _added: added, _updated: updated };
}

// 加强状态：按旅人 id 合并；两边都有时，所属文件 updatedAt 较新的那边为准
function mergeChars(local, cloud) {
  const a = (local && local.chars) || {};
  const b = (cloud && cloud.chars) || {};
  const cloudNewer = time(cloud && cloud.updatedAt) > time(local && local.updatedAt);
  const out = {};
  let added = 0, updated = 0;
  Object.keys(a).forEach(k => out[k] = a[k]);
  Object.keys(b).forEach(k => {
    if (!(k in out)) { out[k] = b[k]; added++; return; }
    if (JSON.stringify(out[k]) !== JSON.stringify(b[k]) && cloudNewer) { out[k] = b[k]; updated++; }
  });
  const newer = cloudNewer ? cloud.updatedAt : ((local && local.updatedAt) || (cloud && cloud.updatedAt) || '');
  return { chars: out, updatedAt: newer, _added: added, _updated: updated };
}

function handle(localPath, cloudPath, mergeFn, label) {
  const cloud = readJson(cloudPath);
  if (!cloud) {
    console.log('  [跳过] 没有取到云端的 ' + label + '（可能是第一次推送）');
    return;
  }
  const local = readJson(localPath) || {};
  const merged = mergeFn(local, cloud);
  const added = merged._added || 0, updated = merged._updated || 0;
  delete merged._added; delete merged._updated;
  if (!added && !updated) {
    console.log('  [一致] ' + label + ' 两边相同，无需合并');
    return;
  }
  writeJson(localPath, merged);
  console.log('  [合并] ' + label + '：补入 ' + added + ' 项，更新 ' + updated + ' 项');
}

console.log('把网页后台的改动合并回本地：');
handle(path.join(ROOT, 'assets/data/updates.json'), path.join(__dirname, '_cloud_updates.json'), mergeUpdates, '更新日志');
handle(path.join(ROOT, 'assets/data/char-meta.json'), path.join(__dirname, '_cloud_charmeta.json'), mergeChars, '旅人加强状态');

['_cloud_updates.json', '_cloud_charmeta.json'].forEach(f => {
  try { fs.unlinkSync(path.join(__dirname, f)); } catch (e) {}
});
console.log('完成。');