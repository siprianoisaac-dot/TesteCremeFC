// ═══════════════════════════════════════════════════
// navegacao.js — Roteamento de telas, header, histórico
// ═══════════════════════════════════════════════════
'use strict';

window.App = window.App || {};

// ── Stack de telas ──
window._screen = null;
const _history  = [];

window.navTo = function(tela, btn) {
  if (btn) {
    document.querySelectorAll('#admin-nav .nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  _history.length = 0;
  window.renderScreen(tela);
};

window.goBack = function() {
  if (_history.length > 1) {
    _history.pop();
    window.renderScreen(_history[_history.length - 1], true);
  } else {
    window.renderScreen('home');
  }
};

window.renderScreen = function(tela, fromBack = false) {
  if (!fromBack) _history.push(tela);
  window._screen = tela;

  // Garantir que nav da Mensalidade está escondido quando no Bar
  document.getElementById('mens-nav').style.display = 'none';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const sc = document.getElementById('sc-' + tela);
  if (sc) sc.classList.add('active');

  window.updateHeader();

  // Renderizar conteúdo de acordo com a tela
  const renders = {
    home:     window.renderHome,
    sabados:  window.renderSabados,
    consumo:  window.renderTodosMensalistas,
    relatorio:() => window.showRelTab('geral', document.querySelector('#sc-relatorio .tab-btn')),
    config:   window.renderConfig,
    historico:null,
  };
  if (renders[tela]) renders[tela]();
};

window.updateHeader = function() {
  const tela    = window._screen;
  const backBtn = document.getElementById('btn-back');
  const title   = document.getElementById('hdr-title');
  const sub     = document.getElementById('hdr-sub');
  const dot     = document.getElementById('sync-dot');

  const labels = {
    home:     'CremeFC',
    sabados:  'Sábados',
    consumo:  'Mensalistas',
    relatorio:'Relatório',
    config:   'Configurações',
    historico:'Histórico',
  };

  if (title) title.textContent = labels[tela] || 'CremeFC';
  if (sub) {
    const btnMens = ' <button onclick="irParaModulo(\'mensalidade\')" style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;margin-left:6px">💰 Mensalidade</button>';
    sub.innerHTML = 'Bar do Clube<span class="sync-dot" id="sync-dot"></span>' + btnMens;
  }

  const root = ['home','sabados','consumo','relatorio','config'];
  if (backBtn) backBtn.classList.toggle('show', !root.includes(tela));
};

// ── Abrir sábado / histórico ──
window.openSabado = function(id) {
  window._sabId = id;
  _history.push('sabado-detalhe');
  window._screen = 'sabado-detalhe';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('sc-sabado-detalhe')?.classList.add('active');
  document.getElementById('btn-back').classList.add('show');
  document.getElementById('hdr-title').textContent = 'Sábado';
  window.renderSabDet(id);
};

window.openHistorico = function(mid) {
  window._histMid = mid;
  _history.push('historico');
  window._screen = 'historico';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('sc-historico')?.classList.add('active');
  document.getElementById('btn-back').classList.add('show');
  document.getElementById('hdr-title').textContent = 'Histórico';
  window.renderHist(mid);
};
