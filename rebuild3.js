const fs = require('fs');
const CRLF = String.fromCharCode(13, 10);
const LF = String.fromCharCode(10);

// 当前（损坏但新代码完整）：CRLF -> 规范成 LF 数组
const cur = fs.readFileSync('assets/js/main.js', 'utf8').split(CRLF);
// 原版：LF 数组
const orig = fs.readFileSync('_orig.js', 'utf8').split(LF);
console.error('当前 ' + cur.length + ' 行 / 原版 ' + orig.length + ' 行');

const find = (arr, needle, from) => { for (let i = from || 0; i < arr.length; i++) if (arr[i].indexOf(needle) >= 0) return i; return -1; };

// ===== 提取新版：辅助函数 + renderCharacter =====
const hStart = find(cur, '// ===== 技能 / 数值 展示的公共辅助 =====');
const rcStart = find(cur, 'function renderCharacter() {');
if (hStart < 0 || rcStart < 0) { console.error('X 提取起点 h=' + hStart + ' rc=' + rcStart); process.exit(1); }
let rcEnd = -1;
for (let i = rcStart + 1; i < cur.length; i++) { if (cur[i] === '}') { rcEnd = i; break; } }
if (rcEnd < 0) { console.error('X 结尾'); process.exit(1); }
const newBlock = cur.slice(hStart, rcEnd + 1);
console.error('新版块: ' + newBlock.length + ' 行（辅助函数 ' + (rcStart - hStart) + ' 行 + renderCharacter ' + (rcEnd - rcStart + 1) + ' 行）');

// ===== 原版：替换 renderCharacter =====
const oRcStart = find(orig, 'function renderCharacter() {');
let oRcEnd = -1;
for (let i = oRcStart + 1; i < orig.length; i++) { if (orig[i] === '}') { oRcEnd = i; break; } }
console.error('原版 renderCharacter: ' + (oRcStart + 1) + ' ~ ' + (oRcEnd + 1));
orig.splice(oRcStart, oRcEnd - oRcStart + 1, ...newBlock);

// ===== 技能图标：路径 + 元素底色 =====
let n3 = 0;
for (let i = 0; i < orig.length; i++) {
  if (orig[i].indexOf('assets/img/hd/skill/') >= 0) {
    orig[i] = orig[i].split('class=\"skill-ico\"').join('class=\"skill-ico ico-el el-\' + escapeHtml(char.element || \'none\') + \'\"');
    orig[i] = orig[i].split('assets/img/hd/skill/').join('assets/img/hd/charskill/');
    n3++;
  }
}
console.error('技能图标行改了 ' + n3 + ' 处');

// ===== 替换 renderPattern（新版双滑条）=====
const oRpStart = find(orig, 'function renderPattern() {');
let oRpEnd = -1;
for (let i = oRpStart + 1; i < orig.length; i++) { if (orig[i] === '}') { oRpEnd = i; break; } }
console.error('原版 renderPattern: ' + (oRpStart + 1) + ' ~ ' + (oRpEnd + 1));
const newRP = fs.readFileSync('_newRP.txt', 'utf8').split(LF);
orig.splice(oRpStart, oRpEnd - oRpStart + 1, ...newRP);

fs.writeFileSync('assets/js/main.js', orig.join(CRLF), 'utf8');
console.error('重建完成: ' + orig.length + ' 行');
