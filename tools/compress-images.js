/**
 * compress-images.js —— 压缩站点图片（WebP）
 *
 * 背景：assets/img/hd 里的立绘和头像是「无损 WebP」，512x512 却要 300 KB。
 *      转成高质量有损（默认 Q92）后体积降到约 1/4，图标类资源肉眼无差别。
 *
 * 用法：
 *   node --use-system-ca tools/compress-images.js           # 默认 Q92
 *   node --use-system-ca tools/compress-images.js --quality=95
 *   node --use-system-ca tools/compress-images.js --min=20  # 只压大于 20KB 的图
 *   node --use-system-ca tools/compress-images.js --lossless  # 真无损（省得很少）
 *
 * 特性：
 *   - 只保留更小的结果：压完更大就保留原图
 *   - 跳过已压过的图（记录在 _compressed.json，加新图时会自动重跑）
 *   - 可重复运行，不会越压越差
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HD = path.join(ROOT, 'assets', 'img', 'hd');
const MARK = path.join(__dirname, '_compressed.json');

const args = process.argv.slice(2);
function argNum(name, def) {
  const a = args.find(x => x.startsWith('--' + name + '='));
  return a ? Number(a.split('=')[1]) : def;
}
const LOSSLESS = args.indexOf('--lossless') >= 0;
const QUALITY = argNum('quality', 92);
const MIN_KB = argNum('min', 20);          // 小于这个体积的图不动（图标类）

let sharp;
try { sharp = require('sharp'); }
catch (e) {
  try { sharp = require(path.join(__dirname, 'node_modules', 'sharp')); }
  catch (e2) {
    console.error('[缺少依赖] 请先在 tools 目录执行：npm install sharp --no-audit --no-fund');
    process.exit(1);
  }
}

function loadMark() {
  try { return JSON.parse(fs.readFileSync(MARK, 'utf8')); } catch (e) { return {}; }
}
function saveMark(o) { fs.writeFileSync(MARK, JSON.stringify(o, null, 0), 'utf8'); }

function listImages() {
  const out = [];
  if (!fs.existsSync(HD)) return out;
  for (const dir of fs.readdirSync(HD)) {
    const p = path.join(HD, dir);
    if (!fs.statSync(p).isDirectory()) continue;
    for (const f of fs.readdirSync(p)) {
      if (f.toLowerCase().endsWith('.webp')) out.push(path.join(p, f));
    }
  }
  return out;
}

(async () => {
  const files = listImages();
  const mark = loadMark();
  console.log('图片总数: ' + files.length);
  console.log('压缩方式: ' + (LOSSLESS ? '真无损' : '有损 Q' + QUALITY) + '，只处理大于 ' + MIN_KB + ' KB 的图');
  console.log('');

  let done = 0, skipped = 0, kept = 0, savedBefore = 0, savedAfter = 0;
  for (const f of files) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const st = fs.statSync(f);
    if (st.size < MIN_KB * 1024) { skipped++; continue; }
    if (mark[rel] && mark[rel].size === st.size) { skipped++; continue; }
    try {
      const buf = fs.readFileSync(f);
      const out = LOSSLESS
        ? await sharp(buf).webp({ lossless: true, effort: 6 }).toBuffer()
        : await sharp(buf).webp({ quality: QUALITY, effort: 6 }).toBuffer();
      savedBefore += buf.length;
      if (out.length < buf.length) {
        fs.writeFileSync(f, out);
        savedAfter += out.length;
        mark[rel] = { size: out.length, q: LOSSLESS ? 'lossless' : QUALITY, at: Date.now() };
        done++;
        if (done % 25 === 0) console.log('  ...已处理 ' + done + ' 张');
      } else {
        savedAfter += buf.length;
        mark[rel] = { size: st.size, q: 'kept', at: Date.now() };
        kept++;
      }
    } catch (e) {
      console.log('  [失败] ' + rel + '  ' + e.message.slice(0, 60));
    }
  }
  saveMark(mark);

  console.log('');
  console.log('压缩完成: ' + done + ' 张已压缩, ' + kept + ' 张保持原样, ' + skipped + ' 张跳过');
  if (savedBefore) console.log('  体积: ' + (savedBefore/1048576).toFixed(1) + ' MB -> ' + (savedAfter/1048576).toFixed(1) + ' MB  (省 ' + Math.round((1 - savedAfter/savedBefore)*100) + '%)');
  const total = files.reduce((s, f) => s + fs.statSync(f).size, 0);
  console.log('  assets/img/hd 现在总计: ' + (total/1048576).toFixed(1) + ' MB');
})();
