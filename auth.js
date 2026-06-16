// ═══════════════════════════════════════════════════
// auth.js — Autenticação (Firebase online + senha local offline)
// ═══════════════════════════════════════════════════
'use strict';

window.App = window.App || {};

// ── Login Admin ──
window.loginAdmin = async () => {
  const email = (document.getElementById('admin-email')?.value || '').trim();
  const senha = (document.getElementById('admin-pass')?.value || '').trim();
  if (!senha) return alert('Digite a senha.');

  window.showLoad('Entrando...');

  // MODO OFFLINE (SPCK / localhost)
  if (window.App.isOfflineMode()) {
    if (window.App.verificarSenhaOffline(senha)) {
      window._role = 'admin';
      localStorage.setItem('cremefc_mc', JSON.stringify({ role: 'admin', ts: Date.now(), offline: true }));
      window.hideLoad();
      showModuleSelectScreen('Admin', 'admin');
    } else {
      window.hideLoad();
      alert('Senha incorreta.');
    }
    return;
  }

  // MODO ONLINE (Firebase)
  if (!email) return window.hideLoad(), alert('Preencha e-mail e senha.');
  try {
    if (!window._auth) await window.App.initFirebase();
    const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js');
    await signInWithEmailAndPassword(window._auth, email, senha);
    window._role = 'admin';
    localStorage.setItem('cremefc_mc', JSON.stringify({ role: 'admin', ts: Date.now() }));
    await window.App.onAuthSuccess('admin', null);
  } catch(e) {
    if (e.code === 'auth/unauthorized-domain') {
      alert('Domínio não autorizado.\nUse o Netlify ou ative o modo offline.');
    } else if (['auth/wrong-password','auth/user-not-found','auth/invalid-credential'].includes(e.code)) {
      alert('E-mail ou senha incorretos.');
    } else {
      alert('Erro: ' + (e.message || e.code || 'tente novamente'));
    }
  } finally {
    window.hideLoad();
  }
};

// ── Login Mensalista ──
window.loginMember = async () => {
  const codigo = (document.getElementById('member-code')?.value || '').trim().toUpperCase();
  if (!codigo) return alert('Digite seu código de acesso.');

  if (!window.App.isOfflineMode() && !window._auth) {
    await window.App.initFirebase();
  }

  const m = (window.db.mensalistas || []).find(x => (x.code || '').toUpperCase() === codigo);
  if (!m) return alert('Código não encontrado. Verifique com o administrador.');

  window._role     = 'member';
  window._memberId = m.id;
  localStorage.setItem('cremefc_mc', JSON.stringify({ role: 'member', mid: m.id, ts: Date.now() }));
  await window.App.onAuthSuccess('member', m);
};

// ── Callback pós-autenticação ──
window.App.onAuthSuccess = async (role, membro) => {
  if (role === 'admin') {
    showModuleSelectScreen('Admin', 'admin');
  } else {
    showModuleSelectScreen(membro.nome, 'member');
  }
};

// ── Logout ──
window.logout = () => {
  window.customConfirm('Tem certeza que deseja sair?', () => {
    localStorage.removeItem('cremefc_mc');
    localStorage.removeItem('cremefc_modulo');
    window._role     = null;
    window._memberId = null;
    if (window._auth?.signOut) window._auth.signOut().catch(() => {});
    showLoginUI();
  }, { icon: '👋', title: 'Sair do app', okLabel: 'Sair', danger: false });
};

// ── Tela de seleção de módulo ──
function showModuleSelectScreen(nomeUsuario, roleAtual) {
  const ls = document.getElementById('login-screen');
  ls.classList.add('hide');
  ls.style.display = 'none';
  document.getElementById('admin-nav').style.display  = 'none';
  document.getElementById('header-user').style.display = 'none';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('mens-nav').style.display = 'none';

  const ms = document.getElementById('module-select-screen');
  ms.classList.add('show');

  const infoEl = document.getElementById('module-user-info');
  if (infoEl) {
    const badge = window.App.isOfflineMode() ? '📴 ' : (roleAtual === 'admin' ? '🔑 ' : '👤 ');
    infoEl.textContent = badge + (nomeUsuario || '');
  }
}

window.irParaModulo = function(modulo) {
  document.getElementById('module-select-screen').classList.remove('show');
  localStorage.setItem('cremefc_modulo', modulo);
  if (modulo === 'bar') {
    window._role === 'admin' ? _irParaBarAdmin() : _irParaBarMember();
  } else if (modulo === 'mensalidade') {
    _irParaMensalidade();
  }
};

function _voltarSelecao() {
  const nome = window._role === 'admin'
    ? 'Admin'
    : ((window.db.mensalistas || []).find(x => x.id === window._memberId) || {}).nome || '';
  document.getElementById('mens-nav').style.display = 'none';
  showModuleSelectScreen(nome, window._role);
}


// Esconder TODOS os navbars antes de exibir o do módulo correto
function _esconderTodosNavs() {
  document.getElementById('admin-nav').style.display = 'none';
  document.getElementById('mens-nav').style.display  = 'none';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
}

function _irParaBarAdmin() {
  _esconderTodosNavs();
  const nav = document.getElementById('admin-nav');
  nav.style.display = 'flex'; nav.style.visibility = 'visible'; nav.style.opacity = '1';
  const hu = document.getElementById('header-user');
  hu.style.display = 'block'; hu.textContent = '☰'; hu.onclick = () => _voltarSelecao();
  window.updateHeader();
  setTimeout(() => window.renderScreen('home'), 50);
}

function _irParaBarMember() {
  _esconderTodosNavs();
  const m = (window.db.mensalistas || []).find(x => x.id === window._memberId);
  if (!m) return;
  const hu = document.getElementById('header-user');
  hu.style.display = 'block'; hu.textContent = '☰'; hu.onclick = () => _voltarSelecao();
  document.getElementById('hdr-title').textContent = m.nome;
  document.getElementById('hdr-sub').innerHTML = 'CremeFC · Bar' +
    '<button onclick="irParaModulo(\'mensalidade\')" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;margin-left:6px">💰 Mensalidade</button>' +
    '<span class="sync-dot" id="sync-dot"></span>';
  document.getElementById('btn-back').classList.remove('show');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('sc-member-home').classList.add('active');
  window.renderMemberView();
}

function _irParaMensalidade() {
  _esconderTodosNavs();
  document.getElementById('mens-nav').style.display = 'flex';
  const hu = document.getElementById('header-user');
  hu.style.display = 'block'; hu.textContent = '☰'; hu.onclick = () => _voltarSelecao();
  document.getElementById('hdr-title').textContent = 'Mensalidade';
  document.getElementById('hdr-sub').innerHTML = 'CremeFC · Financeiro' +
    '<button onclick="irParaModulo(\'bar\')" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;margin-left:6px">🍺 Bar</button>';
  document.getElementById('btn-back').classList.remove('show');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  if (window._role !== 'admin') {
    window.mensAbrirDetalhe(window._memberId);
    document.getElementById('mens-nav').style.display = 'none';
  } else {
    window.mensNavTo('dashboard', document.getElementById('mnav-dashboard'));
  }
}

function showAdminApp()  { showModuleSelectScreen('Admin', 'admin'); }
function showMemberApp(m){ showModuleSelectScreen(m.nome, 'member'); }

function showLoginUI() {
  const ms = document.getElementById('module-select-screen');
  if (ms) ms.classList.remove('show');
  document.getElementById('mens-nav').style.display   = 'none';
  const ls = document.getElementById('login-screen');
  ls.classList.remove('hide'); ls.style.display = 'flex';
  document.getElementById('admin-nav').style.display   = 'none';
  document.getElementById('header-user').style.display = 'none';

  // Modo offline: adaptar UI do login
  if (window.App.isOfflineMode()) {
    // Esconder campo de email e seu label
    const emailGroup = document.getElementById('admin-email-group');
    if (emailGroup) emailGroup.style.display = 'none';
    const emailField = document.getElementById('admin-email');
    if (emailField) emailField.value = 'offline@cremefc.local';

    // Badge offline
    let badge = document.getElementById('offline-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'offline-badge';
      badge.style.cssText = 'background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:8px 12px;font-size:12px;color:#92400e;margin-bottom:12px;text-align:center';
      badge.innerHTML = '📴 <strong>Modo offline (SPCK)</strong><br>Digite a senha para entrar como Admin';
      const passGroup = document.getElementById('admin-pass-group');
      if (passGroup) passGroup.parentElement.insertBefore(badge, passGroup);
    }
    badge.style.display = 'block';
  }
}

// ── Tab Login ──
window.switchLoginTab = (tab, btn) => {
  document.querySelectorAll('.login-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  ['admin','member'].forEach(t => {
    const p = document.getElementById('login-panel-' + t);
    if (p) p.style.display = t === tab ? 'block' : 'none';
  });
};

// ── Verificar sessão salva ao carregar ──
window.App.checkSession = async function() {
  if (!window.App.isOfflineMode()) {
    await window.App.initFirebase();
  }

  const mc = localStorage.getItem('cremefc_mc');
  if (!mc) { showLoginUI(); window.hideLoad(); window._authDone = true; window.hideSplashIfReady(); return; }

  try {
    const sess = JSON.parse(mc);
    const age  = Date.now() - (sess.ts || 0);
    if (age > 30 * 24 * 3600 * 1000) throw new Error('Sessão expirada');

    if (sess.role === 'admin') {
      window._role = 'admin';
      showModuleSelectScreen('Admin', 'admin');
    } else if (sess.role === 'member' && sess.mid) {
      const m = (window.db.mensalistas || []).find(x => x.id === sess.mid);
      if (!m) throw new Error('Membro não encontrado');
      window._role     = 'member';
      window._memberId = sess.mid;
      showModuleSelectScreen(m.nome, 'member');
    } else {
      throw new Error('Sessão inválida');
    }
  } catch(e) {
    localStorage.removeItem('cremefc_mc');
    showLoginUI();
  } finally {
    window.hideLoad();
    window._authDone = true;
    window.hideSplashIfReady();
  }
};
