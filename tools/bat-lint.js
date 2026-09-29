/**
 * bat-lint.js —— 体检 tools 下的 .bat 脚本（防止再出现那几类问题）
 *
 * 检查项：
 *   1. 内容是否纯 ASCII（中文文件名没关系，但内容里有非 ASCII，cmd 会乱码）
 *   2. 是否混入了 PowerShell 语法（以前 检查数据.bat 就犯过）
 *   3. node 要跑的 .js 是否存在（脚本改名/删除后最容易漏）
 *   4. call 的目标 .bat 是否存在
 *   5. 被别的脚本 call 的脚本，pause 必须是条件式的（否则流程会卡住）
 *   6. goto 的标签是否存在
 *   7. 是否设定了工作目录（cd /d）
 *
 * 用法：node tools/bat-lint.js      （由 检查数据.bat 自动调用）
 */
const fs = require('fs');
const path = require('path');

const TOOLS = __dirname;
const ROOT = path.join(__dirname, '..');
const bats = fs.readdirSync(TOOLS).filter(f => /\.(bat|cmd)$/i.test(f)).sort();

function readBat(f) {
  const buf = fs.readFileSync(path.join(TOOLS, f));
  let nonAscii = 0;
  for (const b of buf) if (b > 127) nonAscii++;
  return { text: buf.toString('utf8'), nonAscii };
}

// call 的目标：去掉 %~dp0 前缀只留文件名
function callTarget(raw) {
  return path.basename(String(raw).replace(/%~dp0/gi, '').replace(/^[\\/]+/, ''));
}
// 脚本实际的工作目录：cd /d "%~dp0" -> tools，cd /d "%~dp0.." -> 项目根目录
function baseDirOf(text) {
  const m = /cd\s+\/d\s+"%~dp0(\.\.)?"/i.exec(text);
  return (m && m[1]) ? ROOT : TOOLS;
}

// 谁被谁 call
const calledBy = {};
bats.forEach(f => {
  const { text } = readBat(f);
  const re = /call\s+"([^"]+)"/gi;
  let m;
  while ((m = re.exec(text))) {
    const target = callTarget(m[1]);
    if (target && target !== f) (calledBy[target] = calledBy[target] || []).push(f);
  }
});

const problems = [];
const notes = [];

console.log('检查 ' + bats.length + ' 个 bat 脚本：');
bats.forEach(f => {
  const { text, nonAscii } = readBat(f);
  const errs = [];
  const BASE = baseDirOf(text);

  if (!fs.statSync(path.join(TOOLS, f)).size) errs.push('文件是空的');
  if (nonAscii) errs.push('内容含 ' + nonAscii + ' 个非 ASCII 字节（cmd 会乱码）');

  const lines = text.split(/\r?\n/);
  lines.forEach((ln, i) => {
    const t = ln.trim();
    const n = i + 1;
    // PowerShell 语法
    if (/^\$[A-Za-z_]/.test(t) || /^##/.test(t) || /\b(Select-String|Get-ChildItem|Write-Host|ForEach-Object|ErrorActionPreference|Out-File)\b/.test(t)) {
      errs.push('第 ' + n + ' 行像 PowerShell 语法：' + t.slice(0, 40));
    }
    // node 目标
    const m = /^node\s+(?:--[\w-]+\s+)*([\w\-./\\]+\.js)\b/.exec(t);
    if (m) {
      const target = m[1];
      if (!fs.existsSync(path.resolve(BASE, target))) errs.push('第 ' + n + ' 行要跑的脚本不存在：' + target);
    }
    // 无条件 pause
    if (t === 'pause' && /NOPAUSE/.test(text)) errs.push('第 ' + n + ' 行是无条件 pause（本脚本会被 call，必须条件 pause）');
    // call 目标
    const c = /^call\s+"([^"]+)"/.exec(t);
    if (c) {
      const target = callTarget(c[1]);
      if (target && !fs.existsSync(path.join(TOOLS, target))) errs.push('第 ' + n + ' 行 call 的目标不存在：' + target);
    }
  });

  // 被调用者必须支持 nopause
  if (calledBy[f] && !/NOPAUSE/.test(text)) errs.push('被 ' + calledBy[f].join('、') + ' 调用，但没处理 nopause（流程会卡住）');

  // goto 标签
  const labels = new Set((text.match(/^\s*:([A-Za-z_]\w*)/gm) || []).map(s => s.trim().slice(1)));
  (text.match(/goto\s+([A-Za-z_]\w*)/gi) || []).forEach(g => {
    const l = g.replace(/goto\s+/i, '');
    if (!labels.has(l)) errs.push('goto ' + l + ' 没有对应标签');
  });

  // 工作目录
  if (/\bnode\b/.test(text) && !/cd\s+\/d/.test(text)) notes.push(f + '：没有 cd /d 设定工作目录');

  if (errs.length) { problems.push({ f: f, errs: errs }); console.log('  [X] ' + f); errs.forEach(e => console.log('        ' + e)); }
  else console.log('  [OK] ' + f);
});

if (notes.length) {
  console.log('');
  console.log('提醒（不算错误）：');
  notes.forEach(n => console.log('  - ' + n));
}
console.log('');
if (problems.length) {
  console.log('发现 ' + problems.length + ' 个脚本有问题，请修好后再用。');
  process.exit(1);
}
console.log('bat 脚本全部正常。');