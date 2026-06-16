// ═══════════════════════════════════════════════════
// firebase.js — Persistência de dados + Firebase (opcional)
// Modo offline automático quando rodando em localhost/SPCK
// ═══════════════════════════════════════════════════
'use strict';

window.App = window.App || {};

const LOCAL_KEY = 'cremefc_v2';

// ── Detectar modo offline (localhost, SPCK, file://) ──
window.App.isOfflineMode = () => {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '' ||
         window.location.protocol === 'file:' || host.startsWith('192.168.');
};

// ── Config Firebase ──
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBpqHSgzKCFfEi01MiQSPFPXBGMMdsPJFk",
  authDomain: "cremefc-bar.firebaseapp.com",
  projectId: "cremefc-bar",
  storageBucket: "cremefc-bar.appspot.com",
  messagingSenderId: "1072001350758",
  appId: "1:1072001350758:web:98c58fb9b2462cbf7c8d1a"
};

// ── Senha admin para modo offline ──
const OFFLINE_ADMIN_PASS = 'cremefc2024';

// ── Dados padrão ──
function defaultDB() {
  return {
    config: { nome: 'CremeFC', pix: '', adminPass: OFFLINE_ADMIN_PASS },
    produtos: [
      { id:'p1', nome:'Cerveja',      icon:'🍺', preco:4,  custo:2.5, promo:{tipo:'3por',valor:10} },
      { id:'p2', nome:'Coca-Cola',    icon:'🥤', preco:6,  custo:3.5 },
      { id:'p3', nome:'Powerade',     icon:'⚡', preco:7,  custo:4   },
      { id:'p4', nome:'Gatorade',     icon:'🏃', preco:7,  custo:4   },
      { id:'p5', nome:'Cerveja Zero', icon:'🍻', preco:5,  custo:3   },
      { id:'p6', nome:'Água com gás', icon:'💧', preco:4,  custo:2   },
      { id:'p7', nome:'Refri Lata',   icon:'🥫', preco:5,  custo:2.5 },
    ],
    mensalistas: [],
    sabados: [],
    vencimentos: {},
    mesesFechados: [],
    mens_movs: [],
    mens_caixa: [],
    mens_eventos: [],   // penalidades acumuladas por membro/mês
    mens_fechamentos: [], // registro de fechamentos mensais
    mens_config: {
      mensalidade_normal: 40,
      mensalidade_dm: 25,
      penalidades: [
        { id:'amarelo',     nome:'Cartão Amarelo',    icon:'🟡', valor: 5  },
        { id:'azul',        nome:'Cartão Azul',       icon:'🔵', valor: 10 },
        { id:'vermelho',    nome:'Cartão Vermelho',   icon:'🔴', valor: 15 },
        { id:'atraso',      nome:'Multa Atraso lista',icon:'⏰', valor: 5  },
        { id:'falta',       nome:'Multa Falta',       icon:'❌', valor: 20 },
        { id:'retirada',    nome:'Multa Retirada nome',icon:'📋', valor: 5 },
      ],
    },
    nextId: 100,
  };
}

// ── Carregar dados do localStorage ──
window.db = (() => {
  try {
    const r = localStorage.getItem(LOCAL_KEY);
    if (!r) return defaultDB();
    const parsed = JSON.parse(r);
    if (!parsed.mens_movs)      parsed.mens_movs      = [];
    if (!parsed.mens_caixa)     parsed.mens_caixa     = [];
    if (!parsed.mens_eventos)   parsed.mens_eventos   = [];
    if (!parsed.mens_fechamentos) parsed.mens_fechamentos = [];
    if (!parsed.mens_config)    parsed.mens_config    = defaultDB().mens_config;
    if (!parsed.mens_config.penalidades) parsed.mens_config.penalidades = defaultDB().mens_config.penalidades;
    if (!parsed.config)     parsed.config     = {};
    if (!parsed.config.adminPass) parsed.config.adminPass = OFFLINE_ADMIN_PASS;
    return parsed;
  } catch(e) { return defaultDB(); }
})();

window.saveLocal = () => localStorage.setItem(LOCAL_KEY, JSON.stringify(window.db));
window.save = () => {
  window.saveLocal();
  if (!window.App.isOfflineMode() && window._pushToFirestore) {
    window._pushToFirestore();
  }
};

// ── Firebase — só carrega se NÃO for offline ──
window._fdb  = null;
window._auth = null;

window.App.initFirebase = async function() {
  if (window.App.isOfflineMode()) {
    console.info('[CremeFC] Modo offline (localhost/SPCK) — Firebase desabilitado');
    setSyncDot('off');
    return null;
  }

  try {
    const { initializeApp }    = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js');
    const { getFirestore, doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');
    const { getAuth }          = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js');

    const app    = initializeApp(FIREBASE_CONFIG);
    window._fdb  = getFirestore(app);
    window._auth = getAuth(app);

    window._pushToFirestore = async () => {
      try {
        await setDoc(doc(window._fdb, 'club', 'data'), window.db);
        setSyncDot('ok');
      } catch(e) { setSyncDot('err'); }
    };

    window.save = () => { window.saveLocal(); window._pushToFirestore(); };

    // Pull inicial do Firestore
    try {
      setSyncDot('sync');
      const snap = await getDoc(doc(window._fdb, 'club', 'data'));
      if (snap.exists()) {
        const remote = snap.data();
        if (!remote.mens_movs)      remote.mens_movs      = [];
        if (!remote.mens_caixa)     remote.mens_caixa     = [];
        if (!remote.mens_eventos)   remote.mens_eventos   = [];
        if (!remote.mens_fechamentos) remote.mens_fechamentos = [];
        if (!remote.mens_config)    remote.mens_config    = defaultDB().mens_config;
        window.db = remote;
        window.saveLocal();
      }
      setSyncDot('ok');
    } catch(e) {
      console.warn('[Firebase] Pull falhou, usando localStorage:', e.code || e.message);
      setSyncDot('err');
    }

    return { getFirestore, doc, getDoc, setDoc, getAuth };
  } catch(e) {
    console.warn('Firebase indisponível — modo offline', e);
    setSyncDot('err');
    return null;
  }
};

// ── Sync dot ──
function setSyncDot(s) {
  const d = document.getElementById('sync-dot');
  if (!d) return;
  const map = { ok:'ok', err:'err', sync:'sync', off:'off' };
  d.className = 'sync-dot ' + (map[s] || '');
  if (s === 'off') d.title = 'Modo offline';
}

window.setSyncDot = setSyncDot;
window.showLoad = (t) => {
  const el = document.getElementById('loading');
  if (el) {
    el.classList.add('show');
    const txt = document.getElementById('loading-text');
    if (txt) txt.textContent = t || 'Carregando...';
  }
};
window.hideLoad = () => {
  const el = document.getElementById('loading');
  if (el) el.classList.remove('show');
};

// ── Verificar senha admin (modo offline) ──
window.App.verificarSenhaOffline = (senha) => {
  const salva = window.db?.config?.adminPass || OFFLINE_ADMIN_PASS;
  return senha === salva;
};
