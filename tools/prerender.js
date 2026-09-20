/**
 * prerender.js —— 预渲染：把 JS 生成的内容提前写进 HTML
 *
 * 为什么需要：站点是纯前端渲染，搜索引擎抓到的 HTML 里几乎没有文字
 * （旅人名、秘纹名、配队内容都要等 JS 跑完才出现）。
 * 这个脚本在 Node 里跑一遍渲染函数，把生成的 HTML 写回页面文件，
 * 爬虫就能直接读到内容；访客打开时 JS 会立刻移除这块静态副本并渲染实时版本。
 *
 * 用法：node tools/prerender.js
 *
 * 什么时候跑：更新数据、改配队之后（更新数据.bat 和 一键更新并发布.bat 里已带上）。
 * 可以重复运行，不会堆叠内容。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = ['auth.js', 'data.js', 'github-store.js', 'teams-store.js', 'components.js', 'main.js'];

// 要预渲染的页面 -> 抓取哪些容器
const PAGES = [
  { file: 'index.html',      page: 'home',       fn: 'renderHome()',       ids: ['stats', 'elBlocks', 'hotTeams', 'hotChars'] },
  { file: 'characters.html', page: 'characters', fn: 'renderCharacters()', ids: ['grid', 'filters'] },
  { file: 'patterns.html',   page: 'patterns',   fn: 'renderPatterns()',   ids: ['grid', 'filters'] },
  { file: 'teams.html',      page: 'teams',      fn: 'renderTeams()',      ids: ['grid', 'filters'] }
];

function makeDom(page) {
  const REG = {};
  const mk = id => ({
    id, innerHTML: '', textContent: '', hidden: false, style: {}, value: '', dataset: {}, checked: false, children: [], title: '',
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(){}, appendChild(c){ this.children.push(c); }, remove(){}, focus(){}, select(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; }, closest(){ return null; }
  });
  const document = {
    body: Object.assign(mk('body'), { dataset: { page } }),
    title: '',
    createElement: t => mk(t),
    getElementById: id => (REG[id] = REG[id] || mk(id)),
    querySelector: () => null, querySelectorAll: () => [], addEventListener(){}
  };
  return { document, REG };
}

function makeCtx(document) {
  const store = {};
  const ctx = {
    console, document, window: { location: { search: '' } }, navigator: {},
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    location: { search: '', href: '' }, URLSearchParams, setTimeout, clearTimeout,
    crypto: require('crypto').webcrypto, TextEncoder, TextDecoder,
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    alert(){}, confirm: () => true,
    URL: { createObjectURL: () => 'x', revokeObjectURL(){} },
    Blob: class {}, Event: class {}
  };
  ctx.window.document = document;
  ctx.fetch = async (u) => {
    const rel = String(u).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0];
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    return { ok: true, status: 200, headers: { get: k => k.toLowerCase() === 'content-type' ? 'application/json' : null }, text: async () => text, json: async () => JSON.parse(text) };
  };
  return ctx;
}

// 预渲染块的隐藏脚本：仅当 JS 可用时隐藏（爬虫不执行 JS，看到的是未隐藏的真实内容）
const HIDE_SCRIPT = "<script>(function(){var e=document.getElementById(\"prerender\");if(e)e.style.display=\"none\";})();</script>";
const PRE_START = "<!--prerender-start-->";
const PRE_END = "<!--prerender-end-->";

// 先彻底清除已有的预渲染块，再插入一份（重复运行绝不堆叠）
function inject(html, block) {
  let out = html;
  // 反复删除，直到没有残留
  let guard = 0;
  while (out.indexOf(PRE_START) >= 0 && guard++ < 50) {
    const a = out.indexOf(PRE_START);
    const b = out.indexOf(PRE_END, a);
    if (b < 0) { out = out.slice(0, a); break; }
    out = out.slice(0, a) + out.slice(b + PRE_END.length);
  }
  out = out.replace(/[ 	]+$/gm, "");
  const wrapped = PRE_START + block + HIDE_SCRIPT + PRE_END;
  const anchor = '<div id="navbar"></div>';
  const i = out.indexOf(anchor);
  if (i < 0) return null;
  const at = i + anchor.length;
  return out.slice(0, at) + String.fromCharCode(10) + "    " + wrapped + out.slice(at);
}

(async () => {
  const { document, REG } = makeDom('home');
  const ctx = makeCtx(document);
  vm.createContext(ctx);
  for (const f of SCRIPTS) vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', 'js', f), 'utf8'), ctx);
  await vm.runInContext('loadData()', ctx);
  await vm.runInContext('initTeamStore()', ctx);
  console.log('数据: 旅人 ' + vm.runInContext('DATA.characters.length', ctx) + ' / 秘纹 ' + vm.runInContext('DATA.patterns.length', ctx) + ' / 配队 ' + vm.runInContext('DATA.presetTeams.length', ctx));
  console.log('');

  let total = 0, ok = 0, fail = 0;
  for (const p of PAGES) {
    vm.runInContext('document.body.dataset.page = ' + JSON.stringify(p.page), ctx);
    // 清空容器，避免上一次渲染的内容混进来
    p.ids.forEach(id => { if (REG[id]) REG[id].innerHTML = ''; });
    try {
      await vm.runInContext(p.fn, ctx);
    } catch (e) {
      console.log('  [失败] ' + p.file + ' 渲染出错: ' + e.message);
      fail++; continue;
    }
    let inner = '';
    p.ids.forEach(id => { const el = REG[id]; if (el && el.innerHTML) inner += el.innerHTML; });
    if (!inner) { console.log('  [跳过] ' + p.file + ' 没抓到内容'); fail++; continue; }
    const text = inner.replace(/<[^>]*>/g, '').replace(/\s+/g, '');
    const block = '<div id="prerender">' + inner + '</div>';
    const file = path.join(ROOT, p.file);
    const out = inject(fs.readFileSync(file, 'utf8'), block);
    if (!out) { console.log('  [失败] ' + p.file + ' 找不到插入点'); fail++; continue; }
    fs.writeFileSync(file, out, 'utf8');
    total += text.length; ok++;
    console.log('  ' + p.file.padEnd(18) + String(Math.round(block.length / 1024)).padStart(4) + ' KB   可索引文字 ' + String(text.length).padStart(5) + ' 字');
  }
  console.log('');
  console.log('完成: ' + ok + ' 个页面已预渲染' + (fail ? '，' + fail + ' 个失败' : '') + '，共 ' + total + ' 字可被搜索引擎索引。');
})().catch(e => { console.error('FATAL ' + e.message); process.exit(1); });
