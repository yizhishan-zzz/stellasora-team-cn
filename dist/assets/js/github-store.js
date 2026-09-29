/**
 * github-store.js —— 通过 GitHub 接口把配队 JSON 写回仓库（线上编辑用）
 *
 * 为什么这样做：
 *   本项目是纯前端站，浏览器不能写服务器文件。线上部署（GitHub Pages 之类）时，
 *   仓库里的 assets/data/preset-teams.json 就是线上那份文件，
 *   所以用 GitHub 的 Contents 接口提交这个文件，Pages 会自动重新发布。
 *
 * 需要一个 GitHub 令牌（只给这一个仓库的 Contents 读写权限即可），
 * 存在本浏览器的 localStorage，不会上传到任何第三方。
 */
const GH_KEY = 'ss_github_cfg';

function ghGetCfg() {
  try { return JSON.parse(localStorage.getItem(GH_KEY) || 'null'); } catch (e) { return null; }
}
function ghSetCfg(cfg) {
  try { localStorage.setItem(GH_KEY, JSON.stringify(cfg)); return true; } catch (e) { return false; }
}
function ghClearCfg() {
  try { localStorage.removeItem(GH_KEY); } catch (e) {}
}
function ghConfigured() {
  const c = ghGetCfg();
  return !!(c && c.owner && c.repo && c.token);
}
// UTF-8 安全的两套 base64 工具（配队名可能含中文，不能用朴素的 atob/btoa 转）
function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToUtf8(b64) {
  const bin = atob(String(b64).replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const GH_API = 'https://api.github.com';
function ghHeaders(cfg) {
  return {
    'Authorization': 'token ' + cfg.token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}
// 读取文件（返回 null 表示文件不存在）
async function ghReadFile(cfg, filePath) {
  const url = GH_API + '/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + filePath + '?ref=' + encodeURIComponent(cfg.branch || 'main') + '&t=' + Date.now();
  const resp = await fetch(url, { headers: ghHeaders(cfg) });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error('GitHub 读取失败：HTTP ' + resp.status + ' ' + (await resp.text()).slice(0, 200));
  return await resp.json();
}
// 写入文件（自动带 sha 实现覆盖提交；遇到版本冲突自动重取 sha 重试）
async function ghWriteFile(cfg, filePath, text, message) {
  const content = utf8ToB64(text);
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    // 每次尝试都重新读一次当前文件的 sha，避免「文件已被别处改动」的 409 冲突
    let sha = null;
    try {
      const cur = await ghReadFile(cfg, filePath);
      if (cur && cur.sha) sha = cur.sha;
    } catch (e) { /* 读不到就当新增文件 */ }
    const body = {
      message: message || '更新配队数据（站内编辑）',
      content: content,
      branch: cfg.branch || 'main'
    };
    if (sha) body.sha = sha;
    const resp = await fetch(GH_API + '/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + filePath, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders(cfg)),
      body: JSON.stringify(body)
    });
    if (resp.ok) return await resp.json();
    const detail = (await resp.text()).slice(0, 300);
    lastErr = new Error('GitHub 写入失败：HTTP ' + resp.status + ' ' + detail);
    // 409 / 422 = sha 过期，重取后重试；429 = 触发限流，等一会儿再试
    if (resp.status === 409 || resp.status === 422) { await new Promise(r => setTimeout(r, 250 * (attempt + 1))); continue; }
    if (resp.status === 429) { await new Promise(r => setTimeout(r, 1200 * (attempt + 1))); continue; }
    throw lastErr;
  }
  throw lastErr || new Error('GitHub 写入失败');
}
// 校验配置是否可用（读一次仓库信息）
async function ghCheck(cfg) {
  const url = GH_API + '/repos/' + cfg.owner + '/' + cfg.repo;
  const resp = await fetch(url, { headers: ghHeaders(cfg) });
  if (resp.status === 401) throw new Error('令牌无效或已过期');
  if (resp.status === 404) throw new Error('找不到仓库 ' + cfg.owner + '/' + cfg.repo + '（或者令牌没有这个仓库的权限）');
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const j = await resp.json();
  return { full: j.full_name, branch: cfg.branch || j.default_branch };
}
