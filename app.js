// ═══════════════════════════════════════════════════
// app.js — Ponto de entrada: inicializa o app após
//          todos os scripts JS estarem carregados
// ═══════════════════════════════════════════════════
'use strict';

window.App = window.App || {};

window.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar Firebase + dados
  await window.App.initFirebase();

  // 2. Verificar sessão salva
  await window.App.checkSession();

  // 3. Inicializar UI do bar (renderHome etc.)
  // window.ini() é utilitário de iniciais — não precisa ser chamado aqui
});
