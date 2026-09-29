/**
 * compress-images.js —— 压缩站点图片（WebP），多线程并行
 *
 * 背景：assets/img/hd 里的立绘和头像是「无损 WebP」，512x512 却要 300 KB。
 *      转成高质量有损（默认 Q92）后体积降到约 1/4，肉眼无差别。
 *
 * 用法：
 *   node --use-system-ca tools/compress-images.js              # 默认 Q92、4 线程并行
 *   node --use-system-ca tools/compress-images.js --jobs=8     # 8 线程（机器好可加快）
 *   node --use-system-ca tools/compress-images.js --min=20     # 只压大于 20KB 的图
 *   node --use-system-ca tools/compress-images.js --rebuild-mark   # 重建跳过记录，不重压
 *
 * 特性：
 *   - 只保留更小的结果：压完更大就保留原图
 *   - 跳过已压过的图（记录在 _compressed.json，加新图时只压新图）
 *   - 可重复运行，不会越压越差
 *   - effort=4（默认档）比原来的 6 快 2~4 倍，Q92 下视觉无差别
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
const REBUILD = args.indexOf('--rebuild-mark') >= 0;
const QUALITY = argNum('quality', 92);
const MIN_KB = argNum('min', 20);          // 小于这个体积的图不动（图标类）
const JOBS = Math.max(1, Math.min(argNum('jobs', 4), 8));

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

// 简单并行池：size 个 worker 一起跑，任务按序取
async function pool(items, size, fn) {
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i], i);
    }
  }
  const ws = [];
  const n = Math.max(1, Math.min(size, items.length));
  for (let w = 0; w < n; w++) ws.push(worker());
  await Promise.all(ws);
}

(async () => {
  const files = listImages();
  const mark = loadMark();

  // 恢复模式：_compressed.json 丢了但图其实已压过时，直接登记，不重压
  if (REBUILD) {
    let n = 0;
    for (const f of files) {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      const st = fs.statSync(f);
      if (!mark[rel]) { mark[rel] = { size: st.size, q: 'as-is', at: Date.now() }; n++; }
    }
    saveMark(mark);
    console.log('跳过记录已重建: 新登记 ' + n + ' 张（共 ' + files.length + ' 张），没有重压任何图');
    return;
  }

  console.log('图片总数: ' + files.length);
  console.log('压缩方式: ' + (LOSSLESS ? '真无损' : '有损 Q' + QUALITY) + '，并行 ' + JOBS + ' 线程，只处理大于 ' + MIN_KB + ' KB 的图');
  console.log('');

  let done = 0, kept = 0, skipped = 0, savedBefore = 0, savedAfter = 0;
  const t0 = Date.now();

  const targets = files.filter(f => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const st = fs.statSync(f);
    if (st.size < MIN_KB * 1024) { skipped++; return false; }
    if (mark[rel] && mark[rel].size === st.size) { skipped++; return false; }
    return true;
  });
  console.log('需要压缩: ' + targets.length + ' 张（其余 ' + skipped + ' 张跳过）');
  console.log('');

  await pool(targets, JOBS, async (f) => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const st = fs.statSync(f);
    try {
      const buf = fs.readFileSync(f);
      const out = LOSSLESS
        ? await sharp(buf).webp({ lossless: true, effort: 4 }).toBuffer()
        : await sharp(buf).webp({ quality: QUALITY, effort: 4 }).toBuffer();
      savedBefore += buf.length;
      if (out.length < buf.length) {
        fs.writeFileSync(f, out);
        savedAfter += out.length;
        mark[rel] = { size: out.length, q: LOSSLESS ? 'lossless' : QUALITY, at: Date.now() };
        done++;
        if (done % 50 === 0) console.log('  ...已压缩 ' + done + ' 张');
      } else {
        savedAfter += buf.length;
        mark[rel] = { size: st.size, q: 'kept', at: Date.now() };
        kept++;
      }
    } catch (e) {
      console.log('  [失败] ' + rel + '  ' + e.message.slice(0, 60));
    }
  });
  saveMark(mark);

  console.log('');
  console.log('压缩完成: ' + done + ' 张已压缩, ' + kept + ' 张保持原样, ' + skipped + ' 张跳过');
  console.log('  用时: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒');
  if (savedBefore) console.log('  体积: ' + (savedBefore/1048576).toFixed(1) + ' MB -> ' + (savedAfter/1048576).toFixed(1) + ' MB  (省 ' + Math.round((1 - savedAfter/savedBefore)*100) + '%)');
  const total = files.reduce((s, f) => s + fs.statSync(f).size, 0);
  console.log('  assets/img/hd 现在总计: ' + (total/1048576).toFixed(1) + ' MB');
})();