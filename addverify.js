const fs = require('fs');
const P = 'index.html';
let t = fs.readFileSync(P, 'utf8');
const tag = '<meta name="google-site-verification" content="O0Hilo6iHNpPOKTyxnTJOJq_jqpUPHi_otUZSyjp1FI" />';
if (t.indexOf('google-site-verification') >= 0) { console.error('已经有验证标签了'); process.exit(0); }
// 放在 </head> 之前（越靠前越好，实际位置不影响验证）
t = t.replace('</head>', '  ' + tag + String.fromCharCode(10) + '</head>');
fs.writeFileSync(P, t, 'utf8');
console.error('已加入 Google 验证标签');
