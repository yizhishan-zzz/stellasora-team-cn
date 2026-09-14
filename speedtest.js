(async () => {
  const S = 'https://stellasora-team-cn.pages.dev';
  const t = Date.now();
  console.log('=== 首屏必需资源（不含图片）===');
  const need = ['/assets/css/style.css','/assets/js/auth.js','/assets/js/data.js','/assets/js/github-store.js','/assets/js/teams-store.js','/assets/js/components.js','/assets/js/main.js',
    '/assets/data/characters.json','/assets/data/patterns.json','/assets/data/potential-cfg.json','/assets/data/preset-teams.json',
    '/assets/fonts/MiSans-Regular.woff2','/assets/fonts/MiSans-Medium.woff2','/assets/fonts/MiSans-Semibold.woff2','/assets/fonts/MiSans-Bold.woff2'];
  let total = 0;
  for (const p of need) {
    const t0 = Date.now();
    const r = await fetch(S + p + '?t=' + Date.now());
    const b = await r.arrayBuffer();
    total += b.byteLength;
    console.log('  ' + String(r.status) + '  ' + String(Math.round(b.byteLength/1024)).padStart(5) + ' KB  ' + String(Date.now()-t0).padStart(5) + ' ms  ' + p.replace('/assets/',''));
  }
  console.log('  合计 ' + Math.round(total/1024) + ' KB');
  console.log('');
  console.log('=== 图片资源（抽查）===');
  const imgs = ['/assets/img/hd/outfit/outfit_4041.webp','/assets/img/hd/head/head_15702_XL.webp','/assets/img/hd/potential/16001_Potential_03_A.webp'];
  for (const p of imgs) {
    const t0 = Date.now();
    const r = await fetch(S + p + '?t=' + Date.now());
    const b = await r.arrayBuffer();
    console.log('  ' + String(r.status) + '  ' + String(Math.round(b.byteLength/1024)).padStart(6) + ' KB  ' + String(Date.now()-t0).padStart(5) + ' ms  ' + p.replace('/assets/img/hd/',''));
  }
  console.log('');
  console.log('=== 图片总量 ===');
  const list = await (await fetch('https://api.github.com/repos/yizhishan-zzz/stellasora-team-cn/git/trees/main?recursive=1&t=' + Date.now(), { headers: { 'User-Agent': 'x' } })).json();
  const blobs = (list.tree || []).filter(x => x.type === 'blob');
  const byDir = {};
  blobs.forEach(b => {
    const m = /^assets\/img\/hd\/([^/]+)\//.exec(b.path);
    const k = m ? m[1] : (b.path.indexOf('assets/') === 0 ? '其它资源' : '代码/数据');
    byDir[k] = (byDir[k] || 0) + (b.size || 0);
  });
  Object.keys(byDir).sort((a,b) => byDir[b]-byDir[a]).forEach(k => {
    console.log('  ' + String((byDir[k]/1048576).toFixed(1)).padStart(6) + ' MB  ' + k);
  });
  console.log('');
  console.log('  仓库总大小: ' + (blobs.reduce((s,b)=>s+(b.size||0),0)/1048576).toFixed(1) + ' MB');
})().catch(e => console.log('ERR', e.message));
