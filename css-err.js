const fs = require('fs');
const P = 'assets/css/style.css';
let t = fs.readFileSync(P, 'utf8');
const NL = String.fromCharCode(10);
if (t.indexOf('.toast.toast-err') < 0) {
  t = t.replace(".toast.toast-ok {" + NL + "  border-left-color: #52c878;" + NL + "}",
    ".toast.toast-ok {" + NL + "  border-left-color: #52c878;" + NL + "}" + NL +
    ".toast.toast-err {" + NL + "  border-left-color: #ff6b4a;" + NL + "}");
  fs.writeFileSync(P, t, 'utf8');
  console.log('已加失败提示样式');
} else console.log('已有');
