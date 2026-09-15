const fs = require('fs');
const t = fs.readFileSync('assets/js/main.js', 'utf8');
const L = t.split(String.fromCharCode(10));
console.log('=== 含 STYLE_BTN / POWER_BTN 等的行 ===');
L.forEach((l, i) => {
  if (/STYLE_BTN|POWER_BTN|STYLE_MAP|POWER_MAP/.test(l)) {
    console.log('  行' + (i + 1) + ': ' + JSON.stringify(l));
  }
});
