/**
 * subset-fonts.js —— 把 MiSans 中文字体按站点实际用到的字符裁切（子集化）
 *
 * 为什么要做：完整 MiSans 每个字重 4.7 MB，4 个字重共 19 MB，首屏要等它们下载完。
 * 站点实际用到的汉字只有一千多个，裁完每个字重约 0.3 MB，总 1.2 MB 左右。
 *
 * 用法：node tools/subset-fonts.js
 * 依赖：先在本目录执行  npm install subset-font --no-audit --no-fund
 *      （脚本会自动去 tools/_fonttmp 找这个包）
 *
 * 什么时候要重跑：
 *   更新了旅人/秘纹/潜能数据、或者加了新文案之后，如果出现了新的汉字，
 *   字体里没有那个字形就会用系统字体显示（一般看不出来，但不统一）。
 *   重跑一次本脚本即可。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FONT_DIR = path.join(ROOT, 'assets', 'fonts');
const DATA_DIR = path.join(ROOT, 'assets', 'data');
const JS_DIR = path.join(ROOT, 'assets', 'js');

let subsetFont;
try {
  subsetFont = require('subset-font');
} catch (e) {
  try { subsetFont = require(path.join(__dirname, '_fonttmp', 'node_modules', 'subset-font')); }
  catch (e2) {
    console.error('[缺少依赖] 请先在本目录执行：');
    console.error('  cd tools && npm install subset-font --no-audit --no-fund');
    process.exit(1);
  }
}

// 收集站点会用到的字符（中文 + 标点 + 数字字母 + 常用符号）
function collectChars() {
  const set = new Set();
  const add = t => { for (const ch of String(t)) set.add(ch); };

  // 1) 页面、脚本、样式
  fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).forEach(f => add(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js')).forEach(f => add(fs.readFileSync(path.join(JS_DIR, f), 'utf8')));
  add(fs.readFileSync(path.join(ROOT, 'assets', 'css', 'style.css'), 'utf8'));

  // 2) 全部数据文件（旅人名、潜能描述、秘纹描述、配队名与简介都在里面）
  fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).forEach(f => add(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')));

  // 3) 通用缓冲：ASCII 可打印字符、常用标点、全角符号
  for (let c = 0x20; c <= 0x7e; c++) set.add(String.fromCharCode(c));
  ['　', '、', '。', '「', '」', '『', '』', '（', '）', '【', '】', '《', '》', '·', '—', '…', '～', '！', '？', '：', '；', '，', '．', '％', '＋', '－', '×', '÷', '＝', '／', '＼', '＃', '＆', '＊', '＠', '｜', '△', '○', '●', '★', '☆', '✓', '✕', '✕', '♪', '✦', '❓', '🎒', '🔍', '↔', '→', '←', '↑', '↓', '⚠', '，', '。'].forEach(c => set.add(c));

  return set;
}

(async () => {
  const chars = collectChars();
  const text = [...chars].join('');
  console.log('收集到 ' + chars.size + ' 个字符（含中文、标点、字母数字）');

  const files = fs.readdirSync(FONT_DIR).filter(f => f.endsWith('.woff2'));
  let before = 0, after = 0;
  const backupDir = path.join(FONT_DIR, '_original');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  for (const f of files) {
    const src = path.join(FONT_DIR, f);
    const buf = fs.readFileSync(src);
    before += buf.length;
    // 原始文件备份一份（只在第一次做）
    const backup = path.join(backupDir, f);
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, buf);
    try {
      const out = await subsetFont(buf, text, { targetFormat: 'woff2' });
      fs.writeFileSync(src, out);
      after += out.length;
      console.log('  ' + f.padEnd(28) + (buf.length / 1048576).toFixed(2) + ' MB -> ' + (out.length / 1024).toFixed(1) + ' KB');
    } catch (e) {
      after += buf.length;
      console.error('  ' + f + ' 失败: ' + e.message);
    }
  }

  console.log('');
  console.log('字体总体积: ' + (before / 1048576).toFixed(1) + ' MB  ==>  ' + (after / 1048576).toFixed(2) + ' MB');
  console.log('原始字体已备份到 assets/fonts/_original/（确认没问题后可以删）');
})();
