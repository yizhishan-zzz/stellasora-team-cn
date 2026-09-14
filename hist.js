const { execSync } = require('child_process');
const fs = require('fs');
// 用 PowerShell 把每个提交的该文件导出成临时文件，再统计
const out = execSync('git log --format=@@@%h|%s -- assets/data/preset-teams.json', { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const lines = out.split(String.fromCharCode(10)).filter(l => l.trim());
console.log('=== preset-teams.json 的提交历史（队数变化）===');
let cur = null;
const items = [];
for (const l of lines) {
  if (l.indexOf('@@@') === 0) {
    if (cur) items.push(cur);
    const p = l.slice(3).split('|');
    cur = { sha: p[0], msg: p[1] || '', count: 0 };
  } else if (cur && l.trim()) {
    cur.count += (l.match(/"id"/g) || []).length;
  }
}
if (cur) items.push(cur);
items.forEach(x => console.log('  ' + x.sha + '  ' + String(x.count).padStart(3) + ' 个队  ' + x.msg.slice(0, 40)));
