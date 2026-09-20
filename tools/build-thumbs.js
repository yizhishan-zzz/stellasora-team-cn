/**
 * build-thumbs.js —— 生成列表用的缩略图
 *
 * 为什么需要：详情用的大图（立绘平均 100 KB）在列表里被缩小显示，
 * 白白消耗流量。这个脚本把小尺寸版本生成到 assets/img/thumb/。
 *
 * 产出：
 *   assets/img/thumb/outfit/<原名>.webp   256×256   （立绘，列表卡片用）
 *   assets/img/thumb/head/<原名>.webp     160 宽    （头像，配队卡片用）
 *   assets/img/thumb/potential/<原名>.webp 96×96    （潜能小图）
 *
 * 已存在的缩略图会跳过；源图更新后（体积变化）会重新生成。
 * 用法：node tools/build-thumbs.js
 */
const fs = require('fs');
const path = require('path');

let sharp;
try { sharp = require('sharp'); } catch (e) {
  console.error('[缺少依赖] 请先在 tools/ 目录执行 npm install sharp');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const SRC = {
  outfit: path.join(ROOT, 'assets/img/hd/outfit'),
  head: path.join(ROOT, 'assets/img/hd/head'),
  potential: path.join(ROOT, 'assets/img/hd/potential')
};
const OUT = {
  outfit: path.join(ROOT, 'assets/img/thumb/outfit'),
  head: path.join(ROOT, 'assets/img/thumb/head'),
  potential: path.join(ROOT, 'assets/img/thumb/potential')
};
const SIZE = {
  outfit: { width: 256, height: 256 },   // 卡片显示约 160px，2x 留余量
  head: { width: 160, height: 160 },
  potential: { width: 96, height: 96 }
};
const SKIP_BELOW = 8 * 1024;   // 原图本来就 < 8 KB 的跳过（缩了也没意义）

const jobs = [];
for (const type of Object.keys(SRC)) {
  if (!fs.existsSync(SRC[type])) continue;
  fs.mkdirSync(OUT[type], { recursive: true });
  for (const f of fs.readdirSync(SRC[type])) {
    if (!/\.(webp|png|jpg|jpeg)$/i.test(f)) continue;
    const from = path.join(SRC[type], f);
    const st = fs.statSync(from);
    if (st.size < SKIP_BELOW) continue;
    const to = path.join(OUT[type], f.replace(/\.(png|jpg|jpeg)$/i, '.webp'));
    // 跳过没变过的
    if (fs.existsSync(to)) {
      const meta = path.join(OUT[type], '..', '.' + type + '-meta.json');
      // 简化：只要目标存在且源文件不比目标新就跳过
      if (fs.statSync(to).mtimeMs >= st.mtimeMs && fs.statSync(to).size > 0) continue;
    }
    jobs.push({ type, from, to, size: SIZE[type], name: f });
  }
}

(async () => {
  if (!jobs.length) { console.log('缩略图都是最新的，无需生成。'); return; }
  console.log('待生成缩略图: ' + jobs.length + ' 张');
  let done = 0, saved = 0, failed = 0;
  const CONC = 8;
  let idx = 0;
  async function worker() {
    while (idx < jobs.length) {
      const j = jobs[idx++];
      try {
        await sharp(j.from)
          .resize(j.size.width, j.size.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 82, effort: 5 })
          .toFile(j.to);
        const before = fs.statSync(j.from).size;
        const after = fs.statSync(j.to).size;
        saved += Math.max(0, before - after);
        done++;
        if (done % 50 === 0) console.log('  ...已生成 ' + done + '/' + jobs.length);
      } catch (e) {
        failed++;
        if (failed <= 5) console.error('  [失败] ' + j.name + ': ' + e.message);
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  console.log('');
  console.log('完成: 生成 ' + done + ' 张，失败 ' + failed + ' 张');
  console.log('预计列表页省下流量: ' + (saved / 1048576).toFixed(1) + ' MB');
})();
