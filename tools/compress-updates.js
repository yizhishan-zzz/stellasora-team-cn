/**
 * compress-updates.js —— 把图片压缩成 PNG，存到 过往资源/更新压缩图片/
 *
 * 用法：
 *   把图片直接拖到 tools/压缩更新图片.bat 上（推荐）
 *   或命令行：node tools/compress-updates.js 图片1.png 图片2.jpg
 *
 * 命名：xtlr_update_YYYY_MM_DD.png（同一天多张会自动加 _2、_3 …）
 * 质量：保留约 95%（调色板量化 + 最高压缩率）
 *
 * 输出目录：项目【外面】的同名文件夹
 *   D:\deepseek_harness\stella_sora_network过往资源\更新压缩图片\
 *   （即 <项目目录名>过往资源\更新压缩图片；也可用环境变量 SS_UPDATE_IMG_DIR 覆盖）
 *
 * 说明：这个目录不参与发布，只放本机存档；
 *       要在站内使用，请在「更新日志」编辑器里点「上传图片」（单张 ≤ 512KB）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// 输出到「项目外面」的同名文件夹：<项目目录名>过往资源\更新压缩图片
// 例如项目在 D:\deepseek_harness\stella_sora_network，就输出到
//   D:\deepseek_harness\stella_sora_network过往资源\更新压缩图片
const OUT = process.env.SS_UPDATE_IMG_DIR
  || path.join(ROOT, '..', path.basename(ROOT) + '过往资源', '更新压缩图片');

let sharp;
try { sharp = require('sharp'); }
catch (e) {
  try { sharp = require(path.join(__dirname, 'node_modules', 'sharp')); }
  catch (e2) {
    console.error('[缺少依赖] 请先在 tools 目录执行：npm install sharp --no-audit --no-fund');
    process.exit(1);
  }
}

const inputs = process.argv.slice(2).filter(Boolean);
if (!inputs.length) {
  console.error('用法：把图片拖到 压缩更新图片.bat 上，或 node tools/compress-updates.js <图片...>');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

// 北京时区的 YYYY_MM_DD
function dateStamp() {
  try {
    const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date());
    return s.replace(/-/g, '_');
  } catch (e) {
    const d = new Date();
    const p = n => (String(n).length < 2 ? '0' + n : String(n));
    return d.getFullYear() + '_' + p(d.getMonth() + 1) + '_' + p(d.getDate());
  }
}

// 同名时自动加 _2、_3 …
function uniqueName(stamp) {
  let name = 'xtlr_update_' + stamp + '.png';
  let n = 2;
  while (fs.existsSync(path.join(OUT, name))) {
    name = 'xtlr_update_' + stamp + '_' + n + '.png';
    n++;
  }
  return name;
}

(async () => {
  const stamp = dateStamp();
  let ok = 0, fail = 0;
  for (const f of inputs) {
    if (!fs.existsSync(f)) { console.error('  [跳过] 找不到文件 ' + f); fail++; continue; }
    const dest = path.join(OUT, uniqueName(stamp));
    try {
      const before = fs.statSync(f).size;
      await sharp(f).png({ compressionLevel: 9, quality: 95, palette: true }).toFile(dest);
      const after = fs.statSync(dest).size;
      const kb = n => (n / 1024).toFixed(0) + ' KB';
      console.log('  [OK] ' + path.basename(f) + '  ' + kb(before) + ' -> ' + kb(after));
      console.log('       => ' + path.relative(ROOT, dest).replace(/\\/g, '/'));
      ok++;
    } catch (e) {
      console.error('  [失败] ' + path.basename(f) + '  ' + e.message);
      fail++;
    }
  }
  console.log('');
  console.log('完成：成功 ' + ok + '，失败 ' + fail);
  console.log('输出目录：' + OUT);
})();