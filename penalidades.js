// ═══════════════════════════════════════════════════
// penalidades.js — Penalidades, eventos mensais e fechamento
// ═══════════════════════════════════════════════════
'use strict';

window.App = window.App || {};

// ── Helpers ──
function penDb() {
  const db = window.db;
  if (!db.mens_eventos)     db.mens_eventos     = [];
  if (!db.mens_fechamentos) db.mens_fechamentos = [];
  if (!db.mens_config)      db.mens_config      = { mensalidade_normal:40, mensalidade_dm:25, penalidades:[] };
  return db;
}

function getMesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function getSegundoSabadoDoMes(ano, mes) {
  // Encontra o 2º sábado (dia 7) do mês
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(ano, mes - 1, d);
    if (dt.getMonth() !== mes - 1) break;
    if (dt.getDay() === 6) { // sábado
      count++;
      if (count === 2) return dt;
    }
  }
  return null;
}

function isSegundoSabadoHoje() {
  const hoje = new Date();
  const seg  = getSegundoSabadoDoMes(hoje.getFullYear(), hoje.getMonth() + 1);
  if (!seg) return false;
  return seg.toDateString() === hoje.toDateString();
}

// ── Verificar fechamento automático ao entrar no módulo ──
window.mensVerificarFechamentoAuto = function() {
  if (!isSegundoSabadoHoje()) return;
  const db   = penDb();
  const mesAtual = getMesAtual();
  // Já fechou esse mês?
  const jaFechou = (db.mens_fechamentos||[]).some(f => f.mes === mesAtual);
  if (jaFechou) return;

  // Contar membros ativos com eventos
  const membrosAtivos = (db.mensalistas||[]).filter(m => m.ativo !== false);
  
  window.customConfirm(
    `Hoje é o 2º sábado do mês! Deseja gerar as cobranças de ${mesAtual.replace('-','/')} para ${membrosAtivos.length} membros?`,
    () => window.mensAbrirFechamento(mesAtual),
    {
      icon: '📅',
      title: 'Fechamento Mensal',
      okLabel: 'Revisar e Fechar',
      danger: false,
    }
  );
};

// ── Tela de lançamento de penalidades ──
window.mensAbrirPenalidades = function(membroId) {
  const db      = penDb();
  const membro  = (db.mensalistas||[]).find(m => m.id === membroId);
  if (!membro) return;
  const mesAtual = getMesAtual();

  // Eventos existentes deste membro neste mês
  const eventosDoMes = (db.mens_eventos||[]).filter(e => e.membroId === membroId && e.mes === mesAtual);
  const qtdPorTipo   = {};
  eventosDoMes.forEach(e => { qtdPorTipo[e.penId] = (qtdPorTipo[e.penId]||0) + e.qtd; });

  const pens = db.mens_config.penalidades || [];

  let html = `<div style="padding:16px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div class="fin-avatar" style="width:44px;height:44px">${membro.iniciais||membro.nome.slice(0,2).toUpperCase()}</div>
      <div>
        <div style="font-size:16px;font-weight:800">${membro.nome}</div>
        <div style="font-size:12px;color:var(--text2)">Penalidades de ${mesAtual.replace('-','/')}</div>
      </div>
    </div>`;

  pens.forEach(p => {
    const qtd = qtdPorTipo[p.id] || 0;
    const total = qtd * p.valor;
    html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:14px;font-weight:600">${p.icon} ${p.nome}</div>
        <div style="font-size:11px;color:var(--text2)">${window.fmtR(p.valor)} cada${qtd>0?' · Total: '+window.fmtR(total):''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <button onclick="penChg('${membroId}','${p.id}',-1)" style="width:32px;height:32px;border-radius:50%;border:2px solid var(--border);background:var(--bg);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">−</button>
        <span style="font-size:18px;font-weight:800;min-width:24px;text-align:center" id="pen-qtd-${p.id}">${qtd}</span>
        <button onclick="penChg('${membroId}','${p.id}',1)" style="width:32px;height:32px;border-radius:50%;border:2px solid var(--blue);background:var(--blue-light);color:var(--blue);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">+</button>
      </div>
    </div>`;
  });

  // Data de vencimento padrão: último dia do mês atual
  const _hoje = new Date();
  const _ultDia = new Date(_hoje.getFullYear(), _hoje.getMonth()+1, 0);
  const _vencPad = `${_ultDia.getFullYear()}-${String(_ultDia.getMonth()+1).padStart(2,'0')}-${String(_ultDia.getDate()).padStart(2,'0')}`;
  // Vencimento existente (se já salvou antes)
  const _evExist = (db.mens_eventos||[]).find(e => e.membroId===membroId && e.mes===mesAtual);
  const _vencVal = _evExist?.venc || _vencPad;

  html += `<div style="margin-top:16px;padding:12px;background:var(--blue-bg);border-radius:var(--radius)">
    <div style="font-size:12px;color:var(--text2)">Total penalidades este mês</div>
    <div id="pen-total-label" style="font-size:20px;font-weight:800;color:var(--blue)">${window.fmtR(Object.entries(qtdPorTipo).reduce((s,[pid,q])=>s+(pens.find(p=>p.id===pid)?.valor||0)*q, 0))}</div>
  </div>
  <div style="margin-top:12px">
    <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px">Data de vencimento</label>
    <input class="form-input" type="date" id="pen-venc" value="${_vencVal}" style="font-size:13px">
  </div>
  <button class="btn btn-primary" onclick="penSalvar('${membroId}')" style="margin-top:12px">💾 Salvar</button>
  </div>`;

  // Mostrar em overlay
  const overlay = document.createElement('div');
  overlay.id = 'pen-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:20px 20px 0 0;width:100%;max-height:85vh;overflow-y:auto';
  box.innerHTML = html;
  overlay.appendChild(box);
  overlay.onclick = (e) => { if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);

  // Guardar estado temporário
  window._penTemp = JSON.parse(JSON.stringify(qtdPorTipo));
};

window.penChg = function(membroId, penId, delta) {
  const db   = penDb();
  const pens = db.mens_config.penalidades || [];
  window._penTemp = window._penTemp || {};
  const atual = window._penTemp[penId] || 0;
  const novo  = Math.max(0, atual + delta);
  window._penTemp[penId] = novo;

  // Atualizar display
  const el = document.getElementById('pen-qtd-' + penId);
  if (el) el.textContent = novo;

  // Recalcular total
  const total = Object.entries(window._penTemp).reduce((s,[pid,q])=>s+(pens.find(p=>p.id===pid)?.valor||0)*q, 0);
  const totalEl = document.getElementById('pen-total-label');
  if (totalEl) totalEl.textContent = window.fmtR(total);
};

window.penSalvar = function(membroId) {
  const db       = penDb();
  const mesAtual = getMesAtual();
  const temp     = window._penTemp || {};

  // Ler data de vencimento do campo
  const venc = document.getElementById('pen-venc')?.value || _vencimentoMes(mesAtual);

  // Remover eventos anteriores desse membro/mês
  db.mens_eventos = (db.mens_eventos||[]).filter(e => !(e.membroId===membroId && e.mes===mesAtual));

  // Adicionar novos com vencimento
  Object.entries(temp).forEach(([penId, qtd]) => {
    if (qtd > 0) {
      db.mens_eventos.push({
        id: 'ev' + Date.now() + Math.random(),
        membroId, penId, qtd, mes: mesAtual, venc,
        criadoEm: new Date().toISOString(),
      });
    }
  });

  window.save();
  document.getElementById('pen-overlay')?.remove();

  // Toast
  const _t = document.createElement('div');
  _t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#065f46;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;white-space:nowrap';
  _t.textContent = '✅ Penalidades salvas!';
  document.body.appendChild(_t);
  setTimeout(() => _t.remove(), 2000);

  // Rerender tela atual
  if (window._mensState?.telaAtual === 'lista') window.mensRenderLista?.();
  else if (window._mensState?.telaAtual === 'detalhe') window.mensRenderDetalhe?.();
};

// ── Calcular total de penalidades de um membro no mês ──
window.mensTotalPenalidades = function(membroId, mes) {
  const db   = penDb();
  const pens = db.mens_config.penalidades || [];
  const evs  = (db.mens_eventos||[]).filter(e => e.membroId===membroId && e.mes===mes);
  return evs.reduce((s,e) => s + (pens.find(p=>p.id===e.penId)?.valor||0)*e.qtd, 0);
};

// ── Tela de fechamento mensal ──
window.mensAbrirFechamento = function(mes) {
  mes = mes || getMesAtual();
  const db = penDb();

  // ── Verificar se já fechou este mês ──
  const jaFechou = (db.mens_fechamentos||[]).some(f => f.mes === mes);
  if (jaFechou) {
    const fech = db.mens_fechamentos.find(f => f.mes === mes);
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML = `<div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:380px;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">🔒</div>
      <div style="font-size:17px;font-weight:800;margin-bottom:8px">Fechamento já realizado</div>
      <div style="font-size:14px;color:var(--text2);margin-bottom:20px">
        O mês <strong>${mes.replace('-','/')}</strong> já foi fechado em ${window.fmtDataHora(fech?.criadoEm||'')}.<br><br>
        Para ajustes individuais, acesse o cadastro de cada mensalista.
      </div>
      <button class="btn btn-secondary" onclick="this.closest('[style*=fixed]').remove()">Fechar</button>
    </div>`;
    overlay.onclick = (e) => { if(e.target===overlay) overlay.remove(); };
    document.body.appendChild(overlay);
    return;
  }

  const membros = (db.mensalistas||[])
    .filter(m => m.ativo !== false && m.statusManual !== 'desistente')
    .sort((a,b) => a.nome.localeCompare(b.nome));

  // Guardar estado do fechamento
  window._fechTemp = {};
  membros.forEach(m => {
    const penTotal = window.mensTotalPenalidades(m.id, mes);
    const isDM = m.statusManual === 'dm';
    window._fechTemp[m.id] = { dm: isDM, extraDesc: '', extraValor: 0, penTotal };
  });

  let html = `<div style="padding:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <div style="font-size:18px;font-weight:800">📅 Fechamento ${mes.replace('-','/')}</div>
      <button onclick="document.getElementById('fech-overlay').remove()" style="background:var(--bg2);border:none;border-radius:50%;width:32px;height:32px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text2)">×</button>
    </div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:16px">${membros.length} membros ativos</div>`;

  membros.forEach(m => {
    const penTotal = window.mensTotalPenalidades(m.id, mes);
    const mensNormal = db.mens_config.mensalidade_normal || 40;
    const mensDM     = db.mens_config.mensalidade_dm || 25;
    html += `<div style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div class="fin-avatar" style="width:36px;height:36px;font-size:12px">${m.iniciais||m.nome.slice(0,2).toUpperCase()}</div>
        <div style="flex:1;font-weight:700">${m.nome}</div>
        <div style="font-size:12px;color:var(--text2)">Pen: ${window.fmtR(penTotal)}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
          <input type="checkbox" id="fech-dm-${m.id}" onchange="fechDmChange('${m.id}')" ${window._fechTemp[m.id]?.dm ? 'checked' : ''}>
          DM (${window.fmtR(mensDM)} em vez de ${window.fmtR(mensNormal)})
        </label>
      </div>
      <div style="display:flex;gap:8px">
        <input class="form-input" type="text" id="fech-edesc-${m.id}" placeholder="Item extra (opcional)" style="flex:1;font-size:12px;padding:7px 10px">
        <input class="form-input" type="tel" id="fech-eval-${m.id}" placeholder="R$" oninput="maskMoeda(this)" style="width:90px;font-size:12px;padding:7px 10px">
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--blue);font-weight:700" id="fech-total-${m.id}">
        Total: ${window.fmtR(mensNormal + penTotal)}
      </div>
    </div>`;
  });

  html += `<div style="display:flex;gap:8px;margin-top:8px">
    <button class="btn btn-secondary" onclick="document.getElementById('fech-overlay').remove()" style="flex:1">Cancelar</button>
    <button class="btn btn-primary" onclick="mensConfirmarFechamentoMensal('${mes}')" style="flex:2">✅ Gerar cobranças para todos</button>
  </div>
  </div>`;

  const overlay = document.createElement('div');
  overlay.id = 'fech-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:20px 20px 0 0;width:100%;max-height:90vh;overflow-y:auto';
  box.innerHTML = html;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
};

window.fechDmChange = function(membroId) {
  const db      = penDb();
  const cb      = document.getElementById('fech-dm-' + membroId);
  if (!cb || !window._fechTemp?.[membroId]) return;
  window._fechTemp[membroId].dm = cb.checked;
  _fechRecalcTotal(membroId, db);
};

function _fechRecalcTotal(membroId, db) {
  const t     = window._fechTemp?.[membroId];
  if (!t) return;
  const mens  = t.dm ? (db.mens_config.mensalidade_dm||25) : (db.mens_config.mensalidade_normal||40);
  const extra = window.parseMoeda(document.getElementById('fech-eval-' + membroId)) || 0;
  const total = mens + t.penTotal + extra;
  const el    = document.getElementById('fech-total-' + membroId);
  if (el) el.textContent = 'Total: ' + window.fmtR(total);
}

window.mensConfirmarFechamentoMensal = function(mes) {
  const db      = penDb();
  const membros = (db.mensalistas||[]).filter(m => m.ativo !== false);
  let gerados   = 0;

  membros.forEach(m => {
    const t       = window._fechTemp?.[m.id] || {};
    const mens    = t.dm ? (db.mens_config.mensalidade_dm||25) : (db.mens_config.mensalidade_normal||40);
    const penTotal= window.mensTotalPenalidades(m.id, mes);
    const extra   = window.parseMoeda(document.getElementById('fech-eval-' + m.id)) || 0;
    const extraDesc = (document.getElementById('fech-edesc-' + m.id)?.value||''). trim();
    const total   = mens + penTotal + extra;

    // Detalhar penalidades
    const pens    = db.mens_config.penalidades || [];
    const evs     = (db.mens_eventos||[]).filter(e => e.membroId===m.id && e.mes===mes);
    let detalhes  = `Mensalidade${t.dm?' (DM)':''}: ${window.fmtR(mens)}`;
    evs.forEach(e => {
      const p = pens.find(x=>x.id===e.penId);
      if (p) detalhes += ` | ${p.icon}${p.nome} x${e.qtd}: ${window.fmtR(p.valor*e.qtd)}`;
    });
    if (extra > 0) detalhes += ` | ${extraDesc||'Extra'}: ${window.fmtR(extra)}`;

    // Gerar débito
    db.mens_movs = db.mens_movs || [];
    db.mens_movs.push({
      id: 'mov' + Date.now() + Math.random(),
      membroId: m.id,
      tipo: 'debito',
      desc: `Cobrança ${mes.replace('-','/')}`,
      detalhes,
      valor: total,
      // Usar vencimento dos eventos se disponível, senão último dia do mês
      venc: (db.mens_eventos||[]).find(e=>e.membroId===m.id&&e.mes===mes)?.venc || _vencimentoMes(mes),
      pago: 'nao',
      mes,
      criadoEm: new Date().toISOString(),
      criadoPor: 'admin',
    });
    gerados++;
  });

  // Registrar fechamento
  db.mens_fechamentos.push({ mes, criadoEm: new Date().toISOString(), total: gerados });

  window.save();
  document.getElementById('fech-overlay')?.remove();

  // Toast
  const _t = document.createElement('div');
  _t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#065f46;color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700;z-index:9999';
  _t.textContent = `✅ ${gerados} cobranças geradas para ${mes.replace('-','/')}!`;
  document.body.appendChild(_t);
  setTimeout(() => _t.remove(), 3000);

  // Ir para lista de membros
  window.mensNavTo?.('lista', document.getElementById('mnav-lista'));
};

function _vencimentoMes(mes) {
  // Vencimento = último dia do mês atual
  const [ano, m] = mes.split('-').map(Number);
  const ultimo = new Date(ano, m, 0); // último dia do mês
  // Usar data local para evitar bug de timezone
  return `${ultimo.getFullYear()}-${String(ultimo.getMonth()+1).padStart(2,'0')}-${String(ultimo.getDate()).padStart(2,'0')}`;
}

// ── Config de penalidades ──
window.mensAbrirConfigPen = function() {
  const db   = penDb();
  const cfg  = db.mens_config;
  const pens = cfg.penalidades || [];

  let html = `<div style="padding:16px">
    <div style="font-size:18px;font-weight:800;margin-bottom:16px">⚙️ Config Financeiro</div>
    <div class="s-title">Mensalidade</div>
    <div style="display:flex;gap:10px;margin-bottom:16px">
      <div style="flex:1"><label class="form-label">Normal</label>
        <input class="form-input" type="tel" id="cfg-mens-normal" oninput="maskMoeda(this)"
          value="${Number(cfg.mensalidade_normal||40).toLocaleString('pt-BR',{minimumFractionDigits:2})}">
      </div>
      <div style="flex:1"><label class="form-label">DM</label>
        <input class="form-input" type="tel" id="cfg-mens-dm" oninput="maskMoeda(this)"
          value="${Number(cfg.mensalidade_dm||25).toLocaleString('pt-BR',{minimumFractionDigits:2})}">
      </div>
    </div>
    <div class="s-title">Penalidades</div>`;

  pens.forEach(p => {
    html += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="font-size:20px;width:28px">${p.icon}</span>
      <span style="flex:1;font-size:13px;font-weight:600">${p.nome}</span>
      <input class="form-input" type="tel" id="cfg-pen-${p.id}" oninput="maskMoeda(this)"
        value="${Number(p.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}"
        style="width:100px;text-align:right;font-size:13px">
    </div>`;
  });

  html += `<button class="btn btn-primary" onclick="mensSalvarConfigPen()" style="margin-top:12px">💾 Salvar configurações</button>
  </div>`;

  const overlay = document.createElement('div');
  overlay.id = 'cfg-pen-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:20px 20px 0 0;width:100%;max-height:85vh;overflow-y:auto';
  box.innerHTML = html;
  overlay.appendChild(box);
  overlay.onclick = (e) => { if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
};

window.mensSalvarConfigPen = function() {
  const db   = penDb();
  const cfg  = db.mens_config;
  cfg.mensalidade_normal = window.parseMoeda(document.getElementById('cfg-mens-normal'));
  cfg.mensalidade_dm     = window.parseMoeda(document.getElementById('cfg-mens-dm'));
  (cfg.penalidades||[]).forEach(p => {
    const el = document.getElementById('cfg-pen-' + p.id);
    if (el) p.valor = window.parseMoeda(el);
  });
  window.save();
  document.getElementById('cfg-pen-overlay')?.remove();
  const _t = document.createElement('div');
  _t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#065f46;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999';
  _t.textContent = '✅ Configurações salvas!';
  document.body.appendChild(_t);
  setTimeout(() => _t.remove(), 2000);
};

// Registrar funções globais
['mensAbrirPenalidades','penChg','penSalvar',
 'mensAbrirFechamento','fechDmChange','mensConfirmarFechamentoMensal',
 'mensVerificarFechamentoAuto','mensAbrirConfigPen','mensSalvarConfigPen',
 'mensTotalPenalidades'].forEach(name => {
  if (window[name]) { const fn = window[name]; window[name] = (...args) => fn(...args); }
});
