/**
 * check-data.js —— 数据文件体检
 * 检查 assets/data/*.json 能否正常解析、有没有合并冲突标记残留。
 * 用法：双击 tools/检查数据.bat，或 node tools/check-data.js
 */
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'assets', 'data');
let bad = 0;
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json'));
console.log('检查 ' + files.length + ' 个数据文件：');
for (const f of files) {
  const p = path.join(DIR, f);
  const text = fs.readFileSync(p, 'utf8');
  const marks = (text.match(/<<<<<<<|>>>>>>>|^=======$/gm) || []).length;
  try {
    const j = JSON.parse(text);
    let info = '';
    if (j.teams) info = '配队 ' + j.teams.length + ' 个';
    else if (j.characters) info = '旅人 ' + j.characters.length + ' 名';
    else if (j.patterns) info = '秘纹 ' + j.patterns.length + ' 个';
    else if (j.chars) info = '潜能配置 ' + Object.keys(j.chars).length + ' 人';
    else if (j.iterations) info = 'PBKDF2 ' + j.iterations + ' 次';
    if (marks) { console.log('  [X] ' + f + '  —— 有 ' + marks + ' 处合并冲突标记（会令网页打不开）'); bad++; }
    else console.log('  [OK] ' + f + '  ' + info);
  } catch (e) {
    console.log('  [X] ' + f + '  —— JSON 格式错误：' + e.message);
    bad++;
  }
}
console.log('');
if (bad) {
  console.log('发现 ' + bad + ' 个文件有问题。修复办法：git checkout -- assets/data/ 还原，或告诉助手。');
} else {
  console.log('全部正常。');
}
process.exit(bad ? 1 : 0);
