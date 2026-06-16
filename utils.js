// ═══════════════════════════════════════════════════
// utils.js — Funções auxiliares puras
// Sem dependência de Firebase, DOM ou outros módulos
// ═══════════════════════════════════════════════════
'use strict';

window.App = window.App || {};

// ── Formatação ──
App.fmt = {
  moeda: (v) => {
    const n = Number(v) || 0;
    return (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toFixed(2).replace('.', ',');
  },
  data:  (s) => { if (!s) return ''; const d = new Date(s + 'T12:00:00'); return d.toLocaleDateString('pt-BR'); },
  dataHora: (s) => { if (!s) return ''; const d = new Date(s); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); },
  mes:   (s) => { if (!s) return ''; const str = s.length <= 7 ? s + '-01T12:00:00' : s.slice(0,10) + 'T12:00:00'; const d = new Date(str); return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); },
  mesAbrev: (s) => { if (!s) return ''; const str = s.length <= 7 ? s + '-01T12:00:00' : s.slice(0,10) + 'T12:00:00'; const d = new Date(str); return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }); },
};

// Compat: aliases globais usados no código legado
window.fmt  = (v) => App.fmt.moeda(v);
window.fmtD = (s) => App.fmt.data(s);
window.fmtM = (s) => App.fmt.mes(s);
window.fmtR = (v) => App.fmt.moeda(v);
window.fmtData = (s) => App.fmt.data(s);
window.fmtDataHora = (s) => App.fmt.dataHora(s);

// ── Produto / Sábado helpers ──
window.gProd = (id) => (window.db?.produtos || []).find(p => p.id === id);
window.gSab  = (id) => (window.db?.sabados || []).find(s => s.id === id);
window.mk    = (s)  => s ? s.slice(0, 7) : '';

// ── Cálculos de consumo ──
window.calcC = (partOrConsumos, prodsArg) => {
  // Aceita tanto (part, prods) quanto (consumos) com prods de window.db
  const consumos = (partOrConsumos && typeof partOrConsumos === 'object' && !Array.isArray(partOrConsumos) && !partOrConsumos.consumos)
    ? partOrConsumos  // já é o objeto de consumos diretamente
    : (partOrConsumos?.consumos || {});
  const prods = prodsArg || window.db?.produtos || [];
  let total = 0;
  prods.forEach(p => {
    const qtd = consumos[p.id] || 0;
    if (!qtd) return;
    if (p.promo && p.promo.tipo === '3por') {
      total += Math.floor(qtd / 3) * p.promo.valor + (qtd % 3) * p.preco;
    } else {
      total += qtd * p.preco;
    }
  });
  return total;
};

window.calcCusto = (part, prods) => {
  let total = 0;
  prods.forEach(p => {
    const qtd = (part.consumos || {})[p.id] || 0;
    total += qtd * (p.custo || 0);
  });
  return total;
};

window.saldoAnt = (mid, mesAtual) => {
  let s = 0;
  (window.db?.sabados || []).forEach(sab => {
    if (sab.data.slice(0, 7) >= mesAtual) return;
    const p = (sab.participantes || []).find(x => x.mensalistaId === mid);
    if (!p) return;
    s += window.calcC(p, window.db.produtos || []);
    s -= (p.pagamentos || []).reduce((a, b) => a + (b.valor || 0), 0);
  });
  return s;
};

window.totPago = (part) => (part.pagamentos || []).reduce((a, b) => a + (b.valor || 0), 0);
window.saldoP  = (part) => window.calcC(part, window.db?.produtos || []) - window.totPago(part);

// ── Modal ──
window.App.modal = {
  show: (id) => {
    const el = document.getElementById(id);
    if (!el) { console.warn('Modal não encontrado:', id); return; }
    el.style.display = 'flex';
    // Registrar listener de clique fora (se ainda não registrado)
    if (!el._modalListenerAdded) {
      el.addEventListener('click', (e) => { if (e.target === el) window.closeModal(id); });
      el._modalListenerAdded = true;
    }
  },
  close: (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'none';
  },
};

window.showModal  = (id) => App.modal.show(id);
window.closeModal = (id) => App.modal.close(id);

// Registrar listener em todos os modais ao carregar
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(el => {
    if (!el._modalListenerAdded && el.id) {
      el.addEventListener('click', (e) => { if (e.target === el) window.closeModal(el.id); });
      el._modalListenerAdded = true;
    }
  });
});

// ── Confirm customizado ──
window.customConfirm = (msg, onOk, opts = {}) => {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:16px';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:16px;padding:20px;width:100%;max-width:400px;text-align:center';
  const title = opts.title ? `<div style="font-size:16px;font-weight:800;margin-bottom:8px">${opts.icon || '⚠️'} ${opts.title}</div>` : '';
  box.innerHTML = `${title}<div style="font-size:14px;color:#374151;margin-bottom:20px">${msg}</div>
    <div style="display:flex;gap:10px">
      <button id="_cc_cancel" style="flex:1;padding:12px;border:1.5px solid #e5e7eb;background:#fff;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Cancelar</button>
      <button id="_cc_ok" style="flex:1;padding:12px;background:${opts.danger ? '#ef4444' : '#1c64f2'};color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">${opts.okLabel || 'Confirmar'}</button>
    </div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  const close = () => document.body.removeChild(overlay);
  box.querySelector('#_cc_cancel').onclick = close;
  box.querySelector('#_cc_ok').onclick = () => { close(); onOk(); };
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
};

// ── Export / Install ──
window.exportar = () => {
  const data = localStorage.getItem('cremefc_v2') || '{}';
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cremefc-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
};

window.installApp = () => {
  if (window._deferredPrompt) {
    window._deferredPrompt.prompt();
    window._deferredPrompt.userChoice.then(() => { window._deferredPrompt = null; });
  } else {
    alert('Para instalar: use "Adicionar à tela inicial" no menu do navegador.');
  }
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window._deferredPrompt = e;
});

// ── Status de pagamento de um participante ──
window.stPart = (part) => {
  const t  = window.calcC(part.consumos || {}, window.db?.produtos || []);
  const pg = window.totPago(part);
  if (t === 0 && pg === 0) return 'zero';
  if (pg >= t && t > 0)    return 'pago';
  if (pg > 0)              return 'parcial';
  return 'aberto';
};

// ── Iniciais de um nome ──
window.ini = (nome) => {
  const p = (nome || '').trim().split(' ');
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : (nome || '').slice(0, 2).toUpperCase();
};

// ── Máscara monetária para campos de input ──
window.maskMoeda = function(input) {
  // Pega só os dígitos
  let digits = input.value.replace(/\D/g, '');
  if (!digits) { input.value = ''; return; }

  // Limitar a 10 dígitos (R$ 99.999.999,99)
  if (digits.length > 10) digits = digits.slice(0, 10);

  // Converter para centavos → reais
  const centavos = parseInt(digits, 10);
  const reais = centavos / 100;

  // Formatar: 1234567 → "12.345,67"
  const formatted = reais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  input.value = formatted;
};

// Ler valor numérico de um campo com máscara (retorna float)
window.parseMoeda = function(input) {
  const val = (input?.value || '').replace(/\./g, '').replace(',', '.');
  return parseFloat(val) || 0;
};

// ── Data local (evita bug de timezone UTC) ──
window.dataLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
