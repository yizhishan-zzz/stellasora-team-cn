const fs = require('fs');
const P = 'tools/check-data.js';
let t = fs.readFileSync(P, 'utf8');
if (t.indexOf('charSkills') >= 0) { console.error('已存在'); process.exit(0); }
const anchor = "    else if (j.iterations) info = 'PBKDF2 ' + j.iterations + ' 次';";
if (t.indexOf(anchor) < 0) { console.error('X 找不到识别处'); process.exit(1); }
const add = anchor + String.fromCharCode(10) +
"    else if (j.hualing !== undefined || (j.qian &#38;&#38; false)) info = Object.keys(j).length + ' 人';" + String.fromCharCode(10) +
"    else if (Object.keys(j).length && typeof j[Object.keys(j)[0]] === 'object') info = Object.keys(j).length + ' 项';";
fs.writeFileSync(P, t.replace(anchor, add), 'utf8');
console.error('check-data.js 已更新');
