const fs = require('fs');
const CRLF = String.fromCharCode(13, 10);
const LF = String.fromCharCode(10);
const log = [];

// 用原版（LF）作为基底
let L = fs.readFileSync('_orig.js', 'utf8').split(LF);

const findLine = (needle, from) => { for (let i = from || 0; i < L.length; i++) if (L[i].indexOf(needle) >= 0) return i; return -1; };

// ========== 1) 替换 renderCharacter（237 起）与它的辅助函数 ==========
// 辅助函数从 "// ===== 技能 / 数值 展示的公共辅助 =====" 开始（我们新加的），原版没有 → 先插入
const rcStart = findLine('function renderCharacter() {');
if (rcStart < 0) { console.error('X renderCharacter'); process.exit(1); }
// 找函数结尾
let rcEnd = -1;
for (let i = rcStart + 1; i < L.length; i++) { if (L[i] === '}') { rcEnd = i; break; } }
console.error('原版 renderCharacter: ' + (rcStart + 1) + ' ~ ' + (rcEnd + 1));
const newRC = JSON.parse(fs.readFileSync('_newRC.json', 'utf8'));
L.splice(rcStart, rcEnd - rcStart + 1, ...newRC);
log.push('renderCharacter');

// ========== 2) 在 renderCharacter 之前插入辅助函数 ==========
const helperAnchor = findLine('// ============ 角色详情 ============');
if (helperAnchor < 0) { console.error('X 角色详情注释'); process.exit(1); }
const helpers = JSON.parse(fs.readFileSync('_helpers.json', 'utf8'));
L.splice(helperAnchor, 0, ...helpers);
log.push('辅助函数');

// ========== 3) 技能图标路径 + 元素底色 ==========
let n3 = 0;
for (let i = 0; i < L.length; i++) {
  if (L[i].indexOf('assets/img/hd/skill/') >= 0) {
    L[i] = L[i].split("'<span class=\"skill-ico\">'").join("'<span class=\"skill-ico ico-el el-' + escapeHtml(char.element || 'none') + '\">'");
    L[i] = L[i].split('assets/img/hd/skill/').join('assets/img/hd/charskill/');
    n3++;
  }
}
log.push('技能图标(' + n3 + ')');
if (n3 === 0) console.error('!! 技能图标行没找到');

// ========== 4) 替换 renderPattern（新的双滑条版） ==========
const rpStart = findLine('function renderPattern() {');
if (rpStart < 0) { console.error('X renderPattern'); process.exit(1); }
let rpEnd = -1;
for (let i = rpStart + 1; i < L.length; i++) { if (L[i] === '}') { rpEnd = i; break; } }
console.error('原版 renderPattern: ' + (rpStart + 1) + ' ~ ' + (rpEnd + 1));
const newRP = JSON.parse(fs.readFileSync('_newRP.json', 'utf8'));
L.splice(rpStart, rpEnd - rpStart + 1, ...newRP);
log.push('renderPattern');

// ========== 5) 潜能分组：在 renderCharacter 内部已包含，无需单独处理 ==========
// （新版 renderCharacter 里已经写好了 side-tab 逻辑）

// 写回（CRLF）
fs.writeFileSync('assets/js/main.js', L.join(CRLF), 'utf8');
console.error('重建完成: ' + log.join(' / ') + '，共 ' + L.length + ' 行');
