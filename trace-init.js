// 用线上真实代码复刻浏览器加载顺序，找出 init() 在哪里断掉
const vm = require('vm');
const S = 'https://stellasora-team-cn.pages.dev';
const get = async p => { const r = await fetch(S + p + '?t=' + Date.now()); return { ok: r.ok, status: r.status, text: await r.text(), ct: r.headers.get('content-type') }; };

function makeDom(page) {
  const ALL = {};   // 按选择器记录元素
  const mk = (tag) => {
    const el = {
      tagName: (tag || 'div').toUpperCase(), id: '', className: '', innerHTML: '', textContent: '',
      children: [], style: {}, dataset: {}, value: '', hidden: false, title: '',
      classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, toggle(){}, contains(){ return false; } },
      addEventListener(){}, appendChild(c){ this.children.push(c); if (c.id) ALL['#' + c.id] = c; if (c.className) ALL['.' + String(c.className).split(' ')[0]] = c; },
      removeChild(){}, remove(){}, focus(){}, select(){}, getAttribute(){ return null; }, setAttribute(){},
      querySelector(){ return null; }, querySelectorAll(){ return []; }, closest(){ return null; }
    };
    return el;
  };
  const body = mk('body');
  body.dataset = { page };
  const document = {
    body, title: '', readyState: 'complete',
    createElement: t => mk(t),
    getElementById: id => { if (!ALL['#' + id]) { const e = mk('div'); e.id = id; ALL['#' + id] = e; } return ALL['#' + id]; },
    querySelector: sel => ALL[sel] || null,
    querySelectorAll: sel => ALL[sel] ? [ALL[sel]] : [],
    addEventListener(){}
  };
  return { document, ALL };
}

(async () => {
  const page = 'teams';
  const { document, ALL } = makeDom(page);
  const scripts = [];
  const html = (await get('/teams.html')).text;
  for (const m of html.matchAll(/src="([^"]+\.js)"/g)) scripts.push(m[1]);
  console.error('页面脚本: ' + scripts.join(', '));
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){} }, document, window: { location: { search: '' } }, navigator: {},
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    sessionStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    location: { search: '', href: '' }, URLSearchParams, setTimeout, clearTimeout,
    crypto: require('crypto').webcrypto, TextEncoder, TextDecoder,
    atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64'),
    alert(){}, confirm: () => true, URL: { createObjectURL: () => 'x', revokeObjectURL(){} }, Blob: class {}, Event: class {} };
  ctx.window.document = document;
  ctx.fetch = async (u) => {
    const url = String(u);
    if (url.indexOf('/api/teams') >= 0) return { ok: false, status: 404, headers: { get: () => 'text/html' }, text: async () => '', json: async () => { throw new Error('x'); } };
    const rel = url.replace(S, '').replace(/^\//, '').split('?')[0];
    const r = await get('/' + rel);
    return { ok: r.ok, status: r.status, headers: { get: k => k.toLowerCase() === 'content-type' ? r.ct : null }, text: async () => r.text, json: async () => JSON.parse(r.text) };
  };
  vm.createContext(ctx);
  for (const s of scripts) {
    const js = (await get('/' + s)).text;
    try { vm.runInContext(js, ctx); console.error('  加载 OK   ' + s); }
    catch (e) { console.error('  加载失败 ' + s + ' -> ' + e.message); }
  }
  console.error('');
  console.error('=== 逐步调用 init 的每一环 ===');
  const steps = [
    ['loadData()', 'loadData()'],
    ['loadAuth()', 'loadAuth()'],
    ['initNavbar', 'initNavbar("teams")'],
    ['initFooter', 'initFooter()'],
    ['initAdminButton', 'initAdminButton()'],
    ['initTeamStore', 'initTeamStore()']
  ];
  for (const [label, code] of steps) {
    try {
      const r = vm.runInContext(code, ctx);
      if (r && typeof r.then === 'function') await r;
      console.error('  OK   ' + label);
    } catch (e) {
      console.error('  FAIL ' + label + '  ->  ' + e.message);
      console.error('       ' + (e.stack || '').split(String.fromCharCode(10))[1]);
    }
  }
  console.error('');
  console.error('=== 页脚有没有被创建 ===');
  console.error('  .site-footer 存在: ' + (ALL['.site-footer'] ? '是' : '否'));
  console.error('  .site-disclaimer 存在: ' + (ALL['.site-disclaimer'] ? '是' : '否'));
  console.error('  body.children 数量: ' + document.body.children.length);
  console.error('  body 子元素: ' + document.body.children.map(c => c.tagName + (c.className ? '.' + String(c.className).split(' ')[0] : '')).join(', '));
})().catch(e => console.error('FATAL ' + e.message));
