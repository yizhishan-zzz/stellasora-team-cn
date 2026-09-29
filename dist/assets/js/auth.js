/**
 * auth.js — 管理员鉴权（PBKDF2-SHA256，前端只保存哈希）
 * 密码原文不写入网页，登录状态存 sessionStorage（关闭标签页即失效）
 */
const AUTH_KEY = 'ss_admin_session';
const AUTH = { isAdmin: false, cfg: null, ready: false };

async function loadAuth() {
  try {
    const resp = await fetch('assets/data/auth.json');
    if (resp.ok) AUTH.cfg = await resp.json();
  } catch (e) { AUTH.cfg = null; }
  AUTH.isAdmin = sessionStorage.getItem(AUTH_KEY) === '1';
  AUTH.ready = true;
}
function isAdmin() { return AUTH.isAdmin === true; }

async function verifyPassword(pw) {
  if (!AUTH.cfg || !pw) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const raw = atob(AUTH.cfg.salt);
    const salt = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) salt[i] = raw.charCodeAt(i);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt, iterations: AUTH.cfg.iterations, hash: 'SHA-256' },
      key, 256
    );
    const arr = new Uint8Array(bits);
    let bin = '';
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin) === AUTH.cfg.hash;
  } catch (e) { return false; }
}
function setAdmin(v) {
  AUTH.isAdmin = !!v;
  if (v) sessionStorage.setItem(AUTH_KEY, '1');
  else sessionStorage.removeItem(AUTH_KEY);
}

// 页头登录入口
function initAdminButton() {
  const host = document.getElementById('adminSlot');
  if (!host) return;
  const render = () => {
    host.innerHTML = AUTH.isAdmin
      ? '<span class="admin-badge">管理员</span><button class="admin-btn" id="adminLogout">退出</button>'
      : '<button class="admin-btn" id="adminLogin">管理员登录</button>';
    const login = document.getElementById('adminLogin');
    if (login) login.addEventListener('click', openAdminLogin);
    const logout = document.getElementById('adminLogout');
    if (logout) logout.addEventListener('click', () => {
      setAdmin(false);
      render();
      if (typeof render === 'function' && document.body.dataset.page) location.reload();
    });
  };
  render();
}

function openAdminLogin() {
  const old = document.getElementById('adminModal');
  if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'adminModal';
  modal.className = 'picker-modal';
  modal.innerHTML = '<div class="admin-panel">' +
    '<div class="admin-title">管理员登录</div>' +
    '<input type="password" id="adminPw" class="admin-input" placeholder="请输入管理员密码" autocomplete="off">' +
    '<div class="admin-err" id="adminErr"></div>' +
    '<div class="admin-actions"><button class="btn-secondary" id="adminCancel">取消</button><button class="btn" id="adminOk">登录</button></div>' +
    '</div>';
  document.body.appendChild(modal);
  const pwEl = document.getElementById('adminPw');
  pwEl.focus();
  const close = () => modal.remove();
  document.getElementById('adminCancel').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  const submit = async () => {
    const ok = await verifyPassword(pwEl.value);
    if (ok) { setAdmin(true); close(); location.reload(); }
    else { document.getElementById('adminErr').textContent = '密码错误'; pwEl.value = ''; pwEl.focus(); }
  };
  document.getElementById('adminOk').addEventListener('click', submit);
  pwEl.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}
