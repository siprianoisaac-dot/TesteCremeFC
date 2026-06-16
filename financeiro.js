
// ═══════════════════════════════════════════════════
// financeiro.js — Módulo de Mensalidade (débitos, caixa, relatórios)
// ═══════════════════════════════════════════════════
'use strict';


// ═══════════════════════════════════════════════════════
// MÓDULO MENSALIDADE — JavaScript Completo
// ═══════════════════════════════════════════════════════

// ── Estado do módulo ──
window._mensState = {
  telaAtual: 'dashboard',
  caixaPeriodo: 'mes',
  relPeriodo: 'mes',
  listaStatus: '',
  detalheId: null,
  pagDebitoId: null,
  pagMetodo: 'PIX',
};

// ── Dados (namespace dentro de cremefc_v2) ──
function mensDb() {
  // Usar window.db diretamente — é a fonte única de verdade (sincronizado com Firestore)
  const db = window.db;
  if (!db.mens_movs)  db.mens_movs  = [];
  if (!db.mens_caixa) db.mens_caixa = [];
  return db;
}
function mensSave(db) {
  // db já é window.db — salvar via save() unificado (localStorage + Firestore)
  window.save ? window.save() : localStorage.setItem('cremefc_v2', JSON.stringify(db));
}
function mensNextId(db) {
  db.nextId = (db.nextId || 100) + 1;
  return 'M' + Date.now();
}

// ── Status de um membro ──
function mensStatusMembro(membroId) {
  const db = mensDb();
  const membro = (db.mensalistas||[]).find(m=>m.id===membroId);

  // Status manual tem prioridade absoluta
  if (membro?.statusManual === 'suspenso')   return 'suspenso';
  if (membro?.statusManual === 'desistente') return 'desistente';
  if (membro?.statusManual === 'dm')         return 'dm';

  // Suspensão automática: 2+ débitos vencidos de MESES DIFERENTES
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const debitos = db.mens_movs.filter(m => m.membroId == membroId && m.tipo === 'debito');
  const vencidos = debitos.filter(d => {
    if (d.pago === 'total') return false;
    if (!d.venc) return false;
    if (new Date(d.venc+'T12:00:00') >= hoje) return false;
    // Verificar se tem restante real (pagamentos avulsos podem ter quitado)
    const pagoVinc = (db.mens_movs||[]).filter(m=>m.tipo==='pagamento'&&m.debitoRef==d.id).reduce((s,m)=>s+(m.valor||0),0);
    const pagoAvul = (db.mens_movs||[]).filter(m=>m.membroId==d.membroId&&m.tipo==='pagamento'&&!m.debitoRef).reduce((s,m)=>s+(m.valor||0),0);
    const totalPagoMembro = (db.mens_movs||[]).filter(m=>m.membroId==d.membroId&&m.tipo==='pagamento').reduce((s,m)=>s+(m.valor||0),0);
    const totalDebitosMembro = (db.mens_movs||[]).filter(m=>m.membroId==d.membroId&&m.tipo==='debito').reduce((s,m)=>s+(m.valor||0),0);
    // Se total pago >= total cobrado, membro está quite — não é vencido
    if (totalPagoMembro >= totalDebitosMembro) return false;
    return true;
  });
  // Agrupar por mês — só suspende se vencidos em meses diferentes
  const mesesVencidos = new Set(vencidos.map(d => (d.mes || d.venc?.slice(0,7) || '')));
  if (mesesVencidos.size >= 2) return 'suspenso';
  if (vencidos.length >= 1)    return 'vencido';
  const avencer = debitos.filter(d => d.pago !== 'total' && d.venc && new Date(d.venc+'T12:00:00') >= hoje);
  if (avencer.length > 0) return 'avencer';
  return 'pago';
}

function mensStatusLabel(s) {
  return {pago:'Em dia', avencer:'A vencer', vencido:'Vencido', suspenso:'Suspenso', dm:'DM', desistente:'Desistente'}[s] || s;
}
function mensStatusClass(s) {
  return {pago:'status-pago', avencer:'status-avencer', vencido:'status-vencido', suspenso:'status-suspenso', dm:'status-avencer', desistente:'status-desativado'}[s] || '';
}

// ── Saldo de um membro (positivo = crédito, negativo = deve) ──
function mensSaldo(membroId) {
  const db = mensDb();
  const movs = db.mens_movs.filter(m => m.membroId == membroId);
  let saldo = 0;
  movs.forEach(m => {
    if (m.tipo === 'debito') saldo -= (m.valor || 0);
    if (m.tipo === 'pagamento') saldo += (m.valor || 0);
  });
  return saldo;
}

// ── Formatar moeda ──
function fmtR(v) { return 'R$ ' + Math.abs(v).toFixed(2).replace('.',','); }
function fmtData(s) {
  if (!s) return '';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}
function fmtDataHora(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}

// ── Navegação ──
window.mensNavTo = function(tela, btn) {
  // Garantir que nav do Bar está escondido
  document.getElementById('admin-nav').style.display = 'none';
  document.getElementById('mens-nav').style.display  = 'flex';
  document.querySelectorAll('#mens-nav .nav-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const sc = document.getElementById('sc-mens-' + tela);
  if (sc) sc.classList.add('active');
  window._mensState.telaAtual = tela;
  document.getElementById('hdr-title').textContent = {dashboard:'Mensalidade',lista:'Membros',caixa:'Caixa',relatorios:'Relatórios',detalhe:'Detalhe'}[tela]||'Mensalidade';
  if (tela === 'dashboard') {
    mensRenderDash();
    // Verificar se hoje é 2º sábado → sugerir fechamento
    if (window._role === 'admin') setTimeout(() => window.mensVerificarFechamentoAuto?.(), 800);
  }
  if (tela === 'lista') mensRenderLista();
  if (tela === 'caixa') mensRenderCaixa();
  if (tela === 'relatorios') mensRenderRel();
};

// ══════════════════════════════════════════
// 1. DASHBOARD
// ══════════════════════════════════════════
function mensRenderDash() {
  const db = mensDb();

  const membros = db.mensalistas || [];
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const mesAtual = hoje.toISOString().slice(0,7);

  let totalDevido = 0, totalRecebidoMes = 0, inadimplentes = 0, suspensos = 0, creditores = 0;
  membros.forEach(m => {
    const s = mensSaldo(m.id);
    const st = mensStatusMembro(m.id);
    if (s < 0) totalDevido += Math.abs(s);
    if (s > 0) creditores++;
    if (st === 'vencido' || st === 'suspenso') inadimplentes++;
    if (st === 'suspenso') suspensos++;
  });

  // Receitas do mês
  const pagsDoMes = db.mens_movs.filter(m => m.tipo==='pagamento' && m.criadoEm && m.criadoEm.startsWith(mesAtual));
  pagsDoMes.forEach(p => totalRecebidoMes += (p.valor||0));

  // Saldo do caixa
  let saldoCaixa = 0;
  (db.mens_caixa||[]).forEach(c => {
    if (c.tipo === 'receita') { saldoCaixa += (c.valor||0); }
    else { saldoCaixa -= (c.valor||0); }
  });
  // + pagamentos recebidos no caixa
  db.mens_movs.filter(m=>m.tipo==='pagamento').forEach(p => {
    saldoCaixa += (p.valor||0);
  });

  // Total pago em despesas
  const totalDespesas = (db.mens_caixa||[]).filter(c=>c.tipo==='despesa').reduce((s,c)=>s+(c.valor||0),0);

  const kpis = [
    { icon:'💰', label:'Saldo Caixa', valor: Math.abs(saldoCaixa), prefixo: saldoCaixa < 0 ? '-' : '', cls: saldoCaixa>=0?'ok':'deve' },
    { icon:'📥', label:'Recebido este mês', valor: totalRecebidoMes, cls:'ok' },
    { icon:'📤', label:'Total em aberto', valor: totalDevido, cls: totalDevido>0?'deve':'ok', onclick: "mensAbrirModalEmAberto()" },
    { icon:'💸', label:'Total em despesas', valor: totalDespesas, cls: totalDespesas>0?'deve':'ok' },
    { icon:'⚠️', label:'Inadimplentes', valor: inadimplentes, moeda:false, cls: inadimplentes>0?'deve':'ok', onclick: "mensListaStatus('vencido',null);mensNavTo('lista',document.getElementById('mnav-lista'))" },
    { icon:'🔒', label:'Suspensos', valor: suspensos, moeda:false, cls: suspensos>0?'deve':'ok', onclick: "mensListaStatus('suspenso',null);mensNavTo('lista',document.getElementById('mnav-lista'))" },
  ];

  let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">';
  kpis.forEach(k => {
    const val = k.moeda===false ? k.valor : ((k.prefixo||'') + fmtR(k.valor));
    const clickable = k.onclick ? `onclick="${k.onclick}" style="padding:12px;text-align:center;cursor:pointer;active:opacity:.8"` : 'style="padding:12px;text-align:center"';
    html += `<div class="card" ${clickable}>
      <div style="font-size:22px;margin-bottom:4px">${k.icon}</div>
      <div class="fin-saldo ${k.cls}" style="font-size:16px">${val}</div>
      <div style="font-size:11px;color:var(--text2);margin-top:3px">${k.label}${k.onclick?'<span style=\"font-size:9px;opacity:.6;margin-left:3px\">›</span>':''}</div>
    </div>`;
  });
  html += '</div>';

  // Atualizar botão de fechamento com status do mês
  setTimeout(() => {
    const btnFech = document.getElementById('btn-fechamento-mensal');
    if (btnFech) {
      const mesAtualFech = new Date().toISOString().slice(0,7);
      const jaFechouMes  = (db.mens_fechamentos||[]).some(f => f.mes === mesAtualFech);
      if (jaFechouMes) {
        btnFech.innerHTML  = '🔒 Mês fechado';
        btnFech.style.background = 'var(--bg3)';
        btnFech.style.borderColor = 'var(--border)';
        btnFech.style.color = 'var(--text2)';
      } else {
        btnFech.innerHTML = '📅 Fechamento Mensal';
        btnFech.style.background = 'var(--gold-light)';
        btnFech.style.borderColor = 'var(--gold)';
        btnFech.style.color = 'var(--gold)';
      }
    }
  }, 50);

  // Alertas de suspensos
  const suspList = membros.filter(m => mensStatusMembro(m.id) === 'suspenso');
  if (suspList.length > 0) {
    html += `<div class="alerta-suspenso">🔒 <strong>${suspList.length} membro(s) suspenso(s):</strong> ${suspList.map(m=>m.nome.split(' ')[0]).join(', ')}</div>`;
  }

  // Ação rápida
  if (window._role === 'admin') {
    html += `<div style="display:flex;gap:8px;margin-bottom:8px">
      <button class="btn btn-primary" style="flex:1;padding:10px" onclick="mensAbrirDebito()">+ Débito</button>
      <button class="btn btn-secondary" style="flex:1;padding:10px" onclick="mensNavTo('lista',document.getElementById('mnav-lista'))">Ver Membros</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <button class="btn btn-secondary" id="btn-fechamento-mensal" style="flex:1;padding:9px;font-size:12px;background:var(--gold-light);border-color:var(--gold);color:var(--gold)" onclick="mensAbrirFechamento()">📅 Fechamento Mensal</button>
      <button class="btn btn-secondary" style="flex:1;padding:9px;font-size:12px" onclick="mensAbrirConfigPen()">⚙️ Configurações</button>
    </div>
    <div style="margin-bottom:16px">
      <button class="btn btn-secondary" style="width:100%;padding:9px;font-size:12px;border-color:var(--red);color:var(--red)" onclick="mensLimparDados()">🗑️ Limpar todos os dados financeiros</button>
    </div>`;
  }

  // Últimos lançamentos
  const ultMovs = [...(db.mens_movs||[])].sort((a,b)=>b.criadoEm?.localeCompare(a.criadoEm||'')||0).slice(0,8);
  if (ultMovs.length > 0) {
    html += '<div class="s-title" style="margin-top:4px">Últimos lançamentos</div><div class="card" style="padding:8px 14px">';
    ultMovs.forEach(m => {
      const membro = (db.mensalistas||[]).find(x=>x.id===m.membroId);
      const nome = membro ? membro.nome.split(' ')[0] : '—';
      const icon = m.tipo==='debito'?'📤':m.tipo==='pagamento'?'📥':'💸';
      const cls = m.tipo==='debito'?'neg':'pos';
      const sinal = m.tipo==='debito'?'-':'+';
      html += `<div class="hist-row">
        <div class="hist-icon" style="background:${m.tipo==='pagamento'?'var(--green-light)':m.tipo==='debito'?'var(--red-light)':'var(--amber-light)'}">${icon}</div>
        <div class="hist-body"><div class="hist-desc">${nome} · ${m.desc||''}</div><div class="hist-data">${fmtDataHora(m.criadoEm)}</div></div>
        <div class="hist-valor ${cls}">${sinal}${fmtR(m.valor||0)}</div>
      </div>`;
    });
    html += '</div>';
  } else {
    html += '<div class="empty-state">Nenhum lançamento ainda.<br>Comece criando um débito para um membro.</div>';
  }

  document.getElementById('mens-dash-content').innerHTML = html;
}

// ══════════════════════════════════════════
// 2. LISTA DE MEMBROS
// ══════════════════════════════════════════
function mensRenderLista() {
  const db = mensDb();
  const membros = (db.mensalistas||[]).slice().sort((a,b)=>a.nome.localeCompare(b.nome));
  const filtroStatus = window._mensState.listaStatus;
  const filtroTexto = (document.getElementById('mens-lista-search')||{}).value||'';

  // Botão add (admin)
  const addBtn = document.getElementById('mens-lista-add-btn');
  if (addBtn) addBtn.innerHTML = window._role==='admin'
    ? `<div style="display:flex;gap:6px">
        <button class="btn btn-secondary" style="padding:7px 12px;font-size:12px" onclick="mensAbrirDebito()">+ Débito</button>
        <button class="btn btn-primary" style="padding:7px 12px;font-size:12px" onclick="mensAbrirMembro()">+ Membro</button>
       </div>` : '';

  let lista = membros;
  if (filtroTexto) lista = lista.filter(m => m.nome.toLowerCase().includes(filtroTexto.toLowerCase()));
  if (filtroStatus) lista = lista.filter(m => mensStatusMembro(m.id) === filtroStatus);

  if (lista.length === 0) {
    document.getElementById('mens-lista-content').innerHTML = '<div class="empty-state">Nenhum membro encontrado.</div>';
    return;
  }

  let html = '';
  lista.forEach(m => {
    const saldo = mensSaldo(m.id);
    const status = mensStatusMembro(m.id);
    const saldoLabel = saldo < 0 ? `Deve ${fmtR(saldo)}` : saldo > 0 ? `Crédito ${fmtR(saldo)}` : 'Em dia';
    const saldoCls = saldo < 0 ? 'deve' : saldo > 0 ? 'credit' : 'ok';
    html += `<div class="fin-card">
      <div class="fin-card-header" onclick="mensAbrirDetalhe('${m.id}')" style="cursor:pointer">
        <div class="fin-avatar">${m.iniciais||m.nome.slice(0,2).toUpperCase()}</div>
        <div style="flex:1">
          <div class="fin-nome">${m.nome}</div>
          <div class="fin-detalhe"><span class="tag ${mensStatusClass(status)}" style="padding:2px 7px;font-size:10px">${mensStatusLabel(status)}</span></div>
        </div>
        <div class="fin-saldo ${saldoCls}">${saldoLabel}</div>
      </div>
      ${window._role==='admin' ? `<div style="display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);flex-wrap:wrap">
        <button class="tag" style="flex:1;min-width:60px;padding:5px;font-size:11px;background:var(--gold-light);color:var(--gold)" onclick="mensAbrirPenalidades('${m.id}')">⚽ Penalidades</button>
        <button class="tag" style="flex:1;min-width:60px;padding:5px;font-size:11px;background:var(--blue-light);color:var(--blue)" onclick="mensEditarMembro('${m.id}')">✏️ Editar</button>
        <button class="tag" style="flex:1;min-width:60px;padding:5px;font-size:11px;background:var(--green-light);color:var(--green)" onclick="mensAbrirDebitoParaMembro('${m.id}')">+ Débito</button>
      </div>` : ''}
    </div>`;
  });

  document.getElementById('mens-lista-content').innerHTML = html;
}

window.mensListaFiltrar = function() { mensRenderLista(); };
window.mensListaStatus = function(status, btn) {
  window._mensState.listaStatus = status;
  // Sincronizar botão ativo (btn pode ser null quando chamado do dashboard)
  document.querySelectorAll('#mens-status-filter .periodo-btn').forEach(b => {
    const bStatus = b.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || '';
    b.classList.toggle('active', bStatus === status || (!status && bStatus === ''));
  });
  if(btn) btn.classList.add('active');
  mensRenderLista();
};

// ══════════════════════════════════════════
// 3. DETALHE DO MEMBRO
// ══════════════════════════════════════════
window.mensAbrirDetalhe = function(membroId) {
  window._mensState.detalheId = membroId;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('sc-mens-detalhe').classList.add('active');
  document.getElementById('hdr-title').textContent = 'Detalhe';
  mensRenderDetalhe();
};


// ── Calcular quanto realmente está em aberto em um débito ──
// Considera pagamentos vinculados (debitoRef) E pagamentos avulsos distribuídos
function _restanteDebito(db, debito, membroId) {
  // 1. Pagamentos diretamente vinculados a este débito
  const pagoVinculado = (db.mens_movs||[])
    .filter(m => m.tipo==='pagamento' && m.debitoRef==debito.id)
    .reduce((s,m) => s+(m.valor||0), 0);
  if (pagoVinculado >= (debito.valor||0)) return 0;

  // 2. Pagamentos avulsos (sem debitoRef) — distribuir pelos débitos na ordem cronológica
  const todosDebitos = (db.mens_movs||[])
    .filter(m => m.membroId==membroId && m.tipo==='debito')
    .sort((a,b) => (a.criadoEm||'').localeCompare(b.criadoEm||''));

  const pagosAvulsos = (db.mens_movs||[])
    .filter(m => m.membroId==membroId && m.tipo==='pagamento' && !m.debitoRef)
    .reduce((s,m) => s+(m.valor||0), 0);

  // Distribuir avulsos: abater do mais antigo ao mais recente
  let avulsosRestantes = pagosAvulsos;
  for (const d of todosDebitos) {
    if (avulsosRestantes <= 0) break;
    const pagoDir = (db.mens_movs||[])
      .filter(m => m.tipo==='pagamento' && m.debitoRef==d.id)
      .reduce((s,m) => s+(m.valor||0), 0);
    const aberto = Math.max(0, (d.valor||0) - pagoDir);
    if (d.id === debito.id) {
      // Este é o débito que estamos calculando
      const pagoAvulso = Math.min(avulsosRestantes, aberto);
      return Math.max(0, aberto - pagoAvulso);
    }
    avulsosRestantes -= Math.min(avulsosRestantes, aberto);
  }
  return Math.max(0, (debito.valor||0) - pagoVinculado);
}

function mensRenderDetalhe() {
  const membroId = window._mensState.detalheId;
  const db = mensDb();
  const membro = (db.mensalistas||[]).find(m=>m.id===membroId);
  if (!membro) return;

  const saldo = mensSaldo(membroId);
  const status = mensStatusMembro(membroId);
  const debitos = db.mens_movs.filter(m=>m.membroId==membroId && m.tipo==='debito');
  const pagamentos = db.mens_movs.filter(m=>m.membroId==membroId && m.tipo==='pagamento');
  const isAdmin = window._role === 'admin';

  // Totais: total cobrado, total pago, total em aberto
  const totalCobrado = debitos.reduce((s,d) => s+(d.valor||0), 0);
  const totalPago    = pagamentos.reduce((s,p) => s+(p.valor||0), 0);
  const totalAberto  = Math.max(0, totalCobrado - totalPago);
  const temAberto    = totalAberto > 0;

  const saldoLabel = saldo < 0 ? `Deve ${fmtR(Math.abs(saldo))}` : saldo > 0 ? `Crédito ${fmtR(saldo)}` : 'Em dia';
  const saldoCls = saldo < 0 ? 'deve' : saldo > 0 ? 'credit' : 'ok';

  let html = `<div class="card" style="padding:14px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div class="fin-avatar" style="width:48px;height:48px;font-size:16px">${membro.iniciais||membro.nome.slice(0,2).toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-size:16px;font-weight:800">${membro.nome}</div>
        <div style="margin-top:4px"><span class="tag ${mensStatusClass(status)}">${mensStatusLabel(status)}</span></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding-top:10px;border-top:1px solid var(--border)">
      <div style="text-align:center">
        <div style="font-size:10px;color:var(--text2);margin-bottom:2px">Total cobrado</div>
        <div style="font-size:13px;font-weight:700">${fmtR(totalCobrado)}</div>
      </div>
      <div style="text-align:center;border-left:1px solid var(--border);border-right:1px solid var(--border)">
        <div style="font-size:10px;color:var(--text2);margin-bottom:2px">Total pago</div>
        <div style="font-size:13px;font-weight:700;color:var(--green-mid)">${fmtR(totalPago)}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:10px;color:var(--text2);margin-bottom:2px">Em aberto</div>
        <div style="font-size:13px;font-weight:700;color:${temAberto?'var(--red)':'var(--green-mid)'}">${fmtR(totalAberto)}</div>
      </div>
    </div>
    ${temAberto && isAdmin ? `<button class="btn btn-primary" onclick="mensAbrirReceberPagamento('${membroId}')" style="margin-top:10px;padding:9px;font-size:13px">💵 Registrar recebimento</button>` : ''}
  </div>`;

  if (status === 'suspenso') {
    html += `<div class="alerta-suspenso">🔒 Este membro está <strong>suspenso</strong> por ter 2 ou mais débitos vencidos sem pagamento.</div>`;
  }

  // Penalidades do mês atual
  const _mesAtual = new Date().toISOString().slice(0,7);
  const _penTotal = window.mensTotalPenalidades ? window.mensTotalPenalidades(membroId, _mesAtual) : 0;
  const _evDoMes  = (db.mens_eventos||[]).filter(e=>e.membroId===membroId && e.mes===_mesAtual);
  const _pens     = db.mens_config?.penalidades || [];
  // Só mostrar penalidades se NÃO existe débito de fechamento para este mês
  const _temDebitoMes = (db.mens_movs||[]).some(d => d.tipo==='debito' && d.membroId===membroId && d.mes===_mesAtual);
  if (_evDoMes.length > 0 && !_temDebitoMes) {
    html += `<div style="background:var(--amber-light);border:1px solid var(--gold-light);border-radius:var(--radius);padding:10px 14px;margin-bottom:12px;font-size:12px">
      <div style="font-weight:700;color:var(--amber);margin-bottom:4px">⚽ Penalidades ${_mesAtual.replace('-','/')}</div>
      ${_evDoMes.map(e=>{const p=_pens.find(x=>x.id===e.penId);return p?`<div>${p.icon} ${p.nome} x${e.qtd} = ${window.fmtR(p.valor*e.qtd)}</div>`:''}).join('')}
      <div style="font-weight:700;margin-top:4px;color:var(--amber)">Total: ${window.fmtR(_penTotal)}</div>
    </div>`;
  }

  // Ações admin
  if (isAdmin) {
    html += `<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      <button class="btn btn-primary" style="flex:1;min-width:100px;padding:9px;font-size:12px" onclick="mensAbrirDebitoParaMembro('${membroId}')">+ Débito</button>
      <button class="btn btn-secondary" style="flex:1;min-width:100px;padding:9px;font-size:12px;background:var(--gold-light);border-color:var(--gold);color:var(--gold)" onclick="mensAbrirPenalidades('${membroId}')">⚽ Penalidades</button>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:16px">
      <button class="btn btn-secondary" style="flex:1;padding:9px;font-size:12px" onclick="mensEditarMembro('${membroId}')">✏️ Editar</button>
      <button class="btn btn-secondary" style="flex:1;padding:9px;font-size:12px" onclick="mensAlterarStatus('${membroId}')">🔄 Status</button>
      <button class="btn btn-secondary" style="flex:1;padding:9px;font-size:12px" onclick="mensAbrirWpp('${membroId}')">📱 WhatsApp</button>
    </div>`;
  }

  // Débitos em aberto
  // Filtrar débitos com restante REAL > 0 (considera pagamentos avulsos)
  const debitosAbertos = debitos.filter(d => {
    if (d.pago === 'total') return false;
    const restReal = _restanteDebito(db, d, membroId);
    return restReal > 0;
  });
  if (debitosAbertos.length > 0) {
    html += `<div class="s-title">Débitos em aberto</div><div class="card" style="padding:8px 14px;margin-bottom:12px">`;
    debitosAbertos.forEach(d => {
      const vencLabel  = d.venc ? `Venc. ${fmtData(d.venc)}` : '';
      const isVenc     = d.venc && new Date(d.venc+'T12:00:00') < new Date();
      const pagParcial = pagamentos.filter(p=>p.debitoRef==d.id).reduce((s,p)=>s+(p.valor||0),0);
      const restante   = _restanteDebito(db, d, membroId);

      // Montar detalhamento linha a linha
      let detalhamentoHtml = '';
      if (d.detalhes) {
        // detalhes vem como string: "Mensalidade: R$40 | 🟡Cartão Amarelo x2: R$10 | ❌Falta x1: R$20"
        const itens = d.detalhes.split(' | ');
        detalhamentoHtml = `<div style="margin-top:6px;padding:6px 10px;background:var(--bg2);border-radius:6px;border-left:3px solid var(--blue-mid)">` +
          itens.map(item => `<div style="font-size:11px;color:var(--text2);line-height:1.7">${item}</div>`).join('') +
        `</div>`;
      }

      html += `<div class="debito-row" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div style="flex:1">
            <div class="debito-desc">${d.desc||'Débito'}</div>
            <div class="debito-info">${vencLabel}${d.obs?' · '+d.obs:''}</div>
            ${pagParcial>0?`<div class="debito-info" style="color:var(--amber)">Pago parcial: ${fmtR(pagParcial)}</div>`:''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div class="debito-valor ${isVenc?'deve':''}">${fmtR(restante)}</div>
            ${isAdmin?`<button class="tag" style="font-size:10px;margin-top:4px;background:var(--green-light);color:var(--green)" onclick="mensAbrirPag('${d.id}','${membroId}')">Pagar</button>`:''}
          </div>
        </div>
        ${detalhamentoHtml}
      </div>`;
    });
    html += '</div>';
  }

  // Histórico completo
  const historico = [...db.mens_movs.filter(m=>m.membroId==membroId)].sort((a,b)=>b.criadoEm?.localeCompare(a.criadoEm||'')||0);
  if (historico.length > 0) {
    html += `<div class="s-title">Histórico completo</div><div class="card" style="padding:8px 14px">`;
    historico.forEach(m => {
      const icon = m.tipo==='debito'?'📤':m.tipo==='pagamento'?'📥':'💸';
      const cls = m.tipo==='pagamento'?'pos':'neg';
      const sinal = m.tipo==='pagamento'?'+':'-';
      const bgColor = m.tipo==='pagamento'?'var(--green-light)':'var(--red-light)';
      // Detalhamento do histórico (para débitos de fechamento)
      const _detHtml = m.detalhes
        ? `<div style="font-size:10px;color:var(--text2);margin-top:3px;line-height:1.6">${m.detalhes.split(' | ').join('<br>')}</div>`
        : '';
      html += `<div class="hist-row" style="align-items:flex-start">
        <div class="hist-icon" style="background:${bgColor};margin-top:2px">${icon}</div>
        <div class="hist-body">
          <div class="hist-desc">${m.desc||m.tipo}</div>
          <div class="hist-data">${fmtDataHora(m.criadoEm)}${m.metodoPag?' · '+m.metodoPag:''}${m.obs?' · '+m.obs:''}</div>
          ${_detHtml}
        </div>
        <div class="hist-valor ${cls}" style="margin-top:2px;flex-shrink:0">${sinal}${fmtR(m.valor||0)}</div>
      </div>`;
    });
    html += '</div>';
  } else {
    html += '<div class="empty-state">Sem movimentações ainda.</div>';
  }

  document.getElementById('mens-detalhe-content').innerHTML = html;
}

// ══════════════════════════════════════════
// 4. CAIXA
// ══════════════════════════════════════════
window.mensCaixaPeriodo = function(p, btn) {
  window._mensState.caixaPeriodo = p;
  document.querySelectorAll('#sc-mens-caixa .periodo-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  mensRenderCaixa();
};

function mensPeriodoFiltro(p) {
  const ate = new Date(); ate.setHours(23,59,59,999);
  let desde = new Date(0); // 'tudo' = desde o início dos tempos
  if (p==='hoje') {
    desde = new Date(); desde.setHours(0,0,0,0);
  } else if (p==='semana') {
    desde = new Date(); desde.setDate(desde.getDate()-7); desde.setHours(0,0,0,0);
  } else if (p==='mes') {
    desde = new Date(); desde.setDate(1); desde.setHours(0,0,0,0);
  } else if (p==='ano') {
    desde = new Date(); desde.setMonth(0,1); desde.setHours(0,0,0,0);
  }
  // 'tudo' → desde = new Date(0), sem filtro de data
  return { desde, ate };
}

function mensRenderCaixa() {
  const db = mensDb();
  const p = window._mensState.caixaPeriodo;
  const { desde, ate } = mensPeriodoFiltro(p);
  const isAdmin = window._role === 'admin';

  // Sincronizar botão ativo
  document.querySelectorAll('#sc-mens-caixa .periodo-btn').forEach(btn => {
    const btnP = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    btn.classList.toggle('active', btnP === p);
  });

  // Botões de ação
  const addBtn = document.getElementById('mens-caixa-add-btn');
  if (addBtn) addBtn.innerHTML = isAdmin
    ? `<div style="display:flex;gap:6px">
        <button class="btn btn-secondary" style="padding:7px 12px;font-size:12px" onclick="mensAbrirDespesa()">- Despesa</button>
        <button class="btn btn-primary" style="padding:7px 12px;font-size:12px" onclick="mensAbrirReceita()">+ Crédito</button>
       </div>` : '';

  // ── Dados do período ──

  // 1. Pagamentos de membros (mens_movs tipo=pagamento)
  const pagsMembros = (db.mens_movs||[]).filter(m => {
    if (m.tipo !== 'pagamento') return false;
    const d = new Date(m.criadoEm);
    return d >= desde && d <= ate;
  });
  const totalPagsMembros = pagsMembros.reduce((s,m)=>s+(m.valor||0),0);

  // 2. Receitas manuais do caixa (mens_caixa tipo=receita)
  const receitasManuais = (db.mens_caixa||[]).filter(c => {
    if (c.tipo !== 'receita') return false;
    const d = new Date(c.data+'T12:00:00');
    return d >= desde && d <= ate;
  });
  const totalReceitasManuais = receitasManuais.reduce((s,c)=>s+(c.valor||0),0);

  // 3. Despesas (mens_caixa tipo=despesa)
  const despesas = (db.mens_caixa||[]).filter(c => {
    if (c.tipo !== 'despesa') return false;
    const d = new Date(c.data+'T12:00:00');
    return d >= desde && d <= ate;
  });
  const totalDespesas = despesas.reduce((s,c)=>s+(c.valor||0),0);

  // 4. Total a receber no período (débitos com venc no período, ainda não pagos)
  const debitosNoPeriodo = (db.mens_movs||[]).filter(d => {
    if (d.tipo !== 'debito') return false;
    if (d.pago === 'total') return false;
    if (!d.venc) return false;
    const dv = new Date(d.venc+'T12:00:00');
    return dv >= desde && dv <= ate;
  });
  const totalAReceber = debitosNoPeriodo.reduce((s,d)=>{
    const pagoParcial = (db.mens_movs||[]).filter(m=>m.tipo==='pagamento'&&m.debitoRef===d.id).reduce((a,m)=>a+(m.valor||0),0);
    return s + Math.max(0,(d.valor||0)-pagoParcial);
  },0);

  // Penalidades lançadas com vencimento no período (ainda não viraram débito via fechamento)
  const pens = db.mens_config?.penalidades || [];
  const eventosPeriodo = (db.mens_eventos||[]).filter(e => {
    if (!e.venc) return false;
    // Só incluir se NÃO existe débito de fechamento para esse membro/mês
    const temDebito = (db.mens_movs||[]).some(d => d.tipo==='debito' && d.membroId===e.membroId && d.mes===e.mes);
    if (temDebito) return false; // já virou débito no fechamento
    const dv = new Date(e.venc+'T12:00:00');
    return dv >= desde && dv <= ate;
  });
  // Agrupar por membro/mês para não duplicar
  const eventosPorMembroMes = {};
  eventosPeriodo.forEach(e => {
    const key = e.membroId + '_' + e.mes;
    if (!eventosPorMembroMes[key]) eventosPorMembroMes[key] = { membroId:e.membroId, mes:e.mes, venc:e.venc, total:0 };
    eventosPorMembroMes[key].total += (pens.find(p=>p.id===e.penId)?.valor||0) * (e.qtd||0);
  });
  const totalPensPeriodo = Object.values(eventosPorMembroMes).reduce((s,g)=>s+g.total,0);

  const totalEntradas = totalPagsMembros + totalReceitasManuais;
  const saldo = totalEntradas - totalDespesas;

  // ── Cards de resumo ──
  let html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div class="card" style="padding:10px;text-align:center">
      <div style="font-size:10px;color:var(--text2);margin-bottom:2px">Total recebido</div>
      <div class="fin-saldo ok" style="font-size:16px;font-weight:800">+${fmtR(totalEntradas)}</div>
    </div>
    <div class="card" style="padding:10px;text-align:center">
      <div style="font-size:10px;color:var(--text2);margin-bottom:2px">Total em despesas</div>
      <div class="fin-saldo deve" style="font-size:16px;font-weight:800">-${fmtR(totalDespesas)}</div>
    </div>
    <div class="card" style="padding:10px;text-align:center">
      <div style="font-size:10px;color:var(--text2);margin-bottom:2px">Total a receber</div>
      <div class="fin-saldo ${(totalAReceber+totalPensPeriodo)>0?'deve':'ok'}" style="font-size:16px;font-weight:800">${fmtR(totalAReceber+totalPensPeriodo)}</div>
    </div>
    <div class="card" style="padding:10px;text-align:center">
      <div style="font-size:10px;color:var(--text2);margin-bottom:2px">Saldo do período</div>
      <div class="fin-saldo ${saldo>=0?'ok':'deve'}" style="font-size:16px;font-weight:800">${saldo<0?'-':''}${fmtR(Math.abs(saldo))}</div>
    </div>
  </div>`;

  // ── Seção: Pagamentos de membros ──
  if (pagsMembros.length > 0) {
    html += `<div class="s-title">💰 Pagamentos recebidos (${pagsMembros.length})</div><div class="card" style="padding:8px 14px;margin-bottom:10px">`;
    pagsMembros.forEach(e => {
      const membro = (db.mensalistas||[]).find(m=>m.id===e.membroId);
      const nome   = membro ? membro.nome.split(' ').slice(0,2).join(' ') : 'Membro';
      html += `<div class="caixa-row" style="padding:9px 0">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px">${nome}</div>
          <div class="caixa-cat">${e.desc||'Pagamento'}${e.metodoPag?' · '+e.metodoPag:''} · ${fmtData(e.criadoEm)}</div>
        </div>
        <div class="caixa-val receita">+${fmtR(e.valor||0)}</div>
      </div>`;
    });
    html += '</div>';
  }

  // ── Seção: Receitas manuais ──
  if (receitasManuais.length > 0) {
    html += `<div class="s-title">📥 Créditos manuais (${receitasManuais.length})</div><div class="card" style="padding:8px 14px;margin-bottom:10px">`;
    receitasManuais.forEach(r => {
      html += `<div class="caixa-row" style="align-items:flex-start;padding:9px 0">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px">${r.desc||'Crédito'}</div>
          <div class="caixa-cat">${r.cat||''} · ${fmtData(r.data)}${r.obs?' · '+r.obs:''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <div class="caixa-val receita">+${fmtR(r.valor||0)}</div>
          ${isAdmin?`<button class="tag" style="font-size:11px;padding:4px 8px;background:var(--green-light);color:var(--green-mid)" onclick="mensAbrirReceita('${r.id}')">✏️</button>`:''}
        </div>
      </div>`;
    });
    html += '</div>';
  }

  // ── Seção: Despesas ──
  if (despesas.length > 0) {
    html += `<div class="s-title">💸 Despesas (${despesas.length})</div><div class="card" style="padding:8px 14px;margin-bottom:10px">`;
    despesas.forEach(s => {
      html += `<div class="caixa-row" style="align-items:flex-start;padding:9px 0">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px">${s.desc||'Despesa'}</div>
          <div class="caixa-cat">${s.cat||''} · ${fmtData(s.data)}${s.obs?' · '+s.obs:''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <div class="caixa-val despesa">-${fmtR(s.valor||0)}</div>
          ${isAdmin?`<button class="tag" style="font-size:11px;padding:4px 8px;background:var(--blue-light);color:var(--blue)" onclick="mensAbrirDespesa('${s.id}')">✏️</button>`:''}
        </div>
      </div>`;
    });
    html += '</div>';
  }

  // ── Seção: A receber no período ──
  const totalItensReceber = debitosNoPeriodo.length + Object.keys(eventosPorMembroMes).length;
  if (totalItensReceber > 0) {
    html += `<div class="s-title">📋 A receber no período (${totalItensReceber})</div><div class="card" style="padding:8px 14px;margin-bottom:10px">`;

    // Débitos formais
    debitosNoPeriodo.forEach(d => {
      const membro = (db.mensalistas||[]).find(m=>m.id===d.membroId);
      const nome   = membro ? membro.nome.split(' ').slice(0,2).join(' ') : 'Membro';
      const pagoParcial = (db.mens_movs||[]).filter(m=>m.tipo==='pagamento'&&m.debitoRef===d.id).reduce((a,m)=>a+(m.valor||0),0);
      const restante = Math.max(0,(d.valor||0)-pagoParcial);
      html += `<div class="caixa-row" style="padding:9px 0;cursor:pointer" onclick="mensAbrirDetalhe('${d.membroId}')">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px">${nome}</div>
          <div class="caixa-cat">${d.desc||'Débito'} · venc. ${fmtData(d.venc)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:700;color:var(--red)">-${fmtR(restante)}</div>
          ${pagoParcial>0?`<div style="font-size:10px;color:var(--amber)">pago ${fmtR(pagoParcial)}</div>`:''}
        </div>
      </div>`;
    });

    // Penalidades pendentes (sem fechamento)
    Object.values(eventosPorMembroMes).forEach(g => {
      const membro = (db.mensalistas||[]).find(m=>m.id===g.membroId);
      const nome   = membro ? membro.nome.split(' ').slice(0,2).join(' ') : 'Membro';
      html += `<div class="caixa-row" style="padding:9px 0;cursor:pointer" onclick="mensAbrirDetalhe('${g.membroId}')">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px">${nome}</div>
          <div class="caixa-cat">⚽ Penalidades ${g.mes.replace('-','/')} · venc. ${fmtData(g.venc)}</div>
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--red)">-${fmtR(g.total)}</div>
      </div>`;
    });

    html += '</div>';
  }

  if (pagsMembros.length===0 && despesas.length===0 && receitasManuais.length===0 && debitosNoPeriodo.length===0) {
    html += '<div class="empty-state">Nenhuma movimentação no período.</div>';
  }

  document.getElementById('mens-caixa-content').innerHTML = html;
}

// ══════════════════════════════════════════
// 5. RELATÓRIOS
// ══════════════════════════════════════════
window.mensRelPeriodo = function(p, btn) {
  window._mensState.relPeriodo = p;
  document.querySelectorAll('#sc-mens-relatorios .periodo-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  mensRenderRel();
};

function mensRenderRel() {
  const db = mensDb();
  const p = window._mensState.relPeriodo;
  const { desde, ate } = p==='tudo' ? {desde:new Date(0),ate:new Date()} : p==='ano' ? mensPeriodoFiltro('ano') : mensPeriodoFiltro('mes');
  const membros = (db.mensalistas||[]).slice().sort((a,b)=>a.nome.localeCompare(b.nome));

  // Ranking de devedores
  const ranking = membros.map(m => {
    const saldo = mensSaldo(m.id);
    const status = mensStatusMembro(m.id);
    return { m, saldo, status };
  }).filter(x => x.saldo < 0).sort((a,b) => a.saldo - b.saldo);

  // Totais do período
  const movsPeriodo = (db.mens_movs||[]).filter(mv => {
    const d = new Date(mv.criadoEm);
    return d >= desde && d <= ate;
  });
  const totalCobrando = movsPeriodo.filter(m=>m.tipo==='debito').reduce((s,m)=>s+(m.valor||0),0);
  const totalRecebido = movsPeriodo.filter(m=>m.tipo==='pagamento').reduce((s,m)=>s+(m.valor||0),0);
  const despesas = (db.mens_caixa||[]).filter(c => {
    if(c.tipo!=='despesa') return false;
    const d = new Date(c.data+'T12:00:00');
    return d >= desde && d <= ate;
  }).reduce((s,c)=>s+(c.valor||0),0);

  const totalEmAberto = membros.reduce((s,m) => { const sl=mensSaldo(m.id); return s+(sl<0?Math.abs(sl):0); },0);
  const inadimplentes = membros.filter(m=>['vencido','suspenso'].includes(mensStatusMembro(m.id))).length;

  let html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
    <div class="card" style="padding:12px;text-align:center"><div style="font-size:11px;color:var(--text2)">Cobrado</div><div class="fin-saldo" style="font-size:15px">${fmtR(totalCobrando)}</div></div>
    <div class="card" style="padding:12px;text-align:center"><div style="font-size:11px;color:var(--text2)">Recebido</div><div class="fin-saldo ok" style="font-size:15px">${fmtR(totalRecebido)}</div></div>
    <div class="card" style="padding:12px;text-align:center"><div style="font-size:11px;color:var(--text2)">Em aberto (total)</div><div class="fin-saldo deve" style="font-size:15px">${fmtR(totalEmAberto)}</div></div>
    <div class="card" style="padding:12px;text-align:center"><div style="font-size:11px;color:var(--text2)">Inadimplentes</div><div class="fin-saldo ${inadimplentes>0?'deve':'ok'}" style="font-size:15px">${inadimplentes}</div></div>
  </div>`;

  // Adimplência %
  const pct = membros.length > 0 ? Math.round(((membros.length - inadimplentes) / membros.length) * 100) : 100;
  html += `<div class="card" style="padding:12px;margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:13px;font-weight:600">Taxa de adimplência</span>
      <span style="font-size:18px;font-weight:800;color:${pct>=80?'var(--green-mid)':'var(--red)'}">${pct}%</span>
    </div>
    <div style="height:8px;background:var(--bg3);border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${pct>=80?'var(--green-mid)':'var(--red)'};border-radius:4px;transition:width .5s"></div>
    </div>
  </div>`;

  // Ranking devedores
  if (ranking.length > 0) {
    html += '<div class="s-title">Ranking de devedores</div><div class="card" style="padding:8px 14px;margin-bottom:14px">';
    ranking.forEach((r,i) => {
      const st = mensStatusMembro(r.m.id);
      html += `<div class="debito-row" onclick="mensAbrirDetalhe('${r.m.id}')">
        <div style="width:24px;font-size:13px;font-weight:700;color:var(--text3)">${i+1}°</div>
        <div style="flex:1"><div class="debito-desc">${r.m.nome}</div></div>
        <div style="text-align:right">
          <div class="debito-valor deve">${fmtR(r.saldo)}</div>
          <span class="tag ${mensStatusClass(st)}" style="font-size:10px">${mensStatusLabel(st)}</span>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  // Status geral
  html += '<div class="s-title">Status de todos os membros</div><div class="card" style="padding:8px 14px">';
  membros.forEach(m => {
    const saldo = mensSaldo(m.id);
    const st = mensStatusMembro(m.id);
    const saldoLabel = saldo<0?`Deve ${fmtR(saldo)}`:saldo>0?`Crédito ${fmtR(saldo)}`:'Em dia';
    html += `<div class="debito-row" onclick="mensAbrirDetalhe('${m.id}')">
      <div style="flex:1"><div class="debito-desc">${m.nome}</div></div>
      <div style="text-align:right">
        <div class="fin-saldo ${saldo<0?'deve':saldo>0?'credit':'ok'}" style="font-size:12px">${saldoLabel}</div>
        <span class="tag ${mensStatusClass(st)}" style="font-size:10px">${mensStatusLabel(st)}</span>
      </div>
    </div>`;
  });
  html += '</div>';

  document.getElementById('mens-rel-content').innerHTML = html;
}

// ══════════════════════════════════════════

// ── Modal: membros com valores em aberto ──
window.mensAbrirModalEmAberto = function() {
  const db = mensDb();
  const membros = (db.mensalistas||[]).filter(m => mensSaldo(m.id) < 0)
    .sort((a,b) => mensSaldo(a.id) - mensSaldo(b.id));

  if (membros.length === 0) { alert('Nenhum membro com valores em aberto! ✅'); return; }

  const totalGeral = membros.reduce((s,m) => s + Math.abs(mensSaldo(m.id)), 0);
  let html = `<div style="padding:16px">
    <div style="font-size:18px;font-weight:800;margin-bottom:4px">📤 Total em Aberto</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:16px">${membros.length} membro(s) · Total: <strong style="color:var(--red)">${fmtR(totalGeral)}</strong></div>`;
  membros.forEach(m => {
    const saldo  = mensSaldo(m.id);
    const status = mensStatusMembro(m.id);
    // Contar débitos com restante real > 0
    const nDebitos = (db.mens_movs||[]).filter(mv=>mv.membroId===m.id&&mv.tipo==='debito'&&mv.pago!=='total'&&_restanteDebito(db,mv,m.id)>0).length;
    html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer"
      onclick="document.getElementById('emaberto-overlay').remove();mensAbrirDetalhe('${m.id}')">
      <div class="fin-avatar" style="width:36px;height:36px;font-size:12px">${m.iniciais||m.nome.slice(0,2).toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:13px">${m.nome}</div>
        <div style="font-size:11px;color:var(--text2)">${nDebitos} débito(s) em aberto</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:14px;font-weight:800;color:var(--red)">-${fmtR(Math.abs(saldo))}</div>
        <span class="tag ${mensStatusClass(status)}" style="padding:1px 6px;font-size:10px">${mensStatusLabel(status)}</span>
      </div>
    </div>`;
  });
  html += `<button class="btn btn-secondary" onclick="document.getElementById('emaberto-overlay').remove()" style="margin-top:16px">Fechar</button></div>`;

  const overlay = document.createElement('div');
  overlay.id = 'emaberto-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:20px 20px 0 0;width:100%;max-height:80vh;overflow-y:auto';
  box.innerHTML = html;
  overlay.appendChild(box);
  overlay.onclick = (e) => { if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
};

// MODAIS — Débito
// ══════════════════════════════════════════
window.mensAbrirDebito = function(membroIdPresel) {
  const db = mensDb();
  const sel = document.getElementById('md-membro');
  sel.innerHTML = '<option value="">Selecionar...</option>';
  (db.mensalistas||[]).sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id; opt.textContent = m.nome;
    if (m.id == membroIdPresel) opt.selected = true;
    sel.appendChild(opt);
  });
  document.getElementById('md-desc').value = '';
  document.getElementById('md-valor').value = '';
  document.getElementById('md-obs').value = '';
  // Default vencimento = fim do mês atual
  const _hoje = new Date();
  const _fimMes = new Date(_hoje.getFullYear(), _hoje.getMonth()+1, 0);
  document.getElementById('md-venc').value = `${_fimMes.getFullYear()}-${String(_fimMes.getMonth()+1).padStart(2,'0')}-${String(_fimMes.getDate()).padStart(2,'0')}`;
  document.getElementById('m-mens-debito-title').textContent = 'Novo Débito';
  showModal('m-mens-debito');
};

window.mensAbrirDebitoParaMembro = function(membroId) {
  mensAbrirDebito(membroId);
};

window.mensConfirmarDebito = function() {
  const membroId = document.getElementById('md-membro').value;
  const desc = document.getElementById('md-desc').value.trim();
  const valor = window.parseMoeda(document.getElementById('md-valor'));
  const venc = document.getElementById('md-venc').value;
  const obs = document.getElementById('md-obs').value.trim();

  if (!membroId) return alert('Selecione um membro.');
  if (!desc) return alert('Informe a descrição.');
  if (!valor || valor <= 0) return alert('Informe um valor válido.');

  const db = mensDb();
  const mov = {
    id: mensNextId(db),
    membroId, tipo: 'debito',
    desc, valor, venc: venc||null, obs,
    pago: 'nao',
    criadoEm: new Date().toISOString(),
    criadoPor: 'admin',
  };
  db.mens_movs.push(mov);
  mensSave(db);
  closeModal('m-mens-debito');
  // Rerender tela atual imediatamente
  const t = window._mensState.telaAtual;
  if (t==='dashboard') mensRenderDash();
  else if (t==='lista') mensRenderLista();
  else if (t==='detalhe') mensRenderDetalhe();
  else mensRenderDetalhe(); // fallback: sempre atualiza detalhe se aberto
  // Toast
  const _td = document.createElement('div');
  _td.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#065f46;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.3)';
  _td.textContent = '✅ Débito lançado!';
  document.body.appendChild(_td);
  setTimeout(() => _td.remove(), 2000);
};

// ══════════════════════════════════════════
// MODAIS — Pagamento
// ══════════════════════════════════════════
window.mensAbrirPag = function(debitoId, membroId) {
  window._mensState.pagDebitoId = debitoId;
  window._mensState.pagMembroId = membroId;
  window._mensState.pagMetodo = 'PIX';

  const db = mensDb();
  const debito = db.mens_movs.find(m=>m.id===debitoId);
  const pago = db.mens_movs.filter(m=>m.tipo==='pagamento'&&m.debitoRef===debitoId).reduce((s,m)=>s+(m.valor||0),0);
  const restante = debito ? (debito.valor||0) - pago : 0;

  document.getElementById('mp-debito-info').innerHTML = `
    <div style="font-weight:700">${debito?.desc||'Débito'}</div>
    <div style="color:var(--text2);margin-top:4px">Total: ${fmtR(debito?.valor||0)} · Já pago: ${fmtR(pago)} · <strong>Restante: ${fmtR(restante)}</strong></div>`;
  document.getElementById('mp-valor').value = Number(restante).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  document.getElementById('mp-obs').value = '';
  document.querySelectorAll('#mp-metodos .tag').forEach(b=>b.classList.remove('active'));
  document.querySelector('#mp-metodos .tag')?.classList.add('active');
  showModal('m-mens-pag');
};

window.mpSelMetodo = function(metodo, btn) {
  window._mensState.pagMetodo = metodo;
  document.querySelectorAll('#mp-metodos .tag').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
};

window.mensConfirmarPag = function() {
  const valor = window.parseMoeda(document.getElementById('mp-valor'));
  const obs = document.getElementById('mp-obs').value.trim();
  if (!valor || valor <= 0) return alert('Informe um valor válido.');

  const db = mensDb();
  const debitoId = window._mensState.pagDebitoId;
  const membroId = window._mensState.pagMembroId;
  const debito = db.mens_movs.find(m=>m.id===debitoId);
  const pagoAntes = db.mens_movs.filter(m=>m.tipo==='pagamento'&&m.debitoRef===debitoId).reduce((s,m)=>s+(m.valor||0),0);
  const restante = debito ? (debito.valor||0) - pagoAntes : valor;

  // Registrar pagamento
  const mov = {
    id: mensNextId(db),
    membroId, tipo: 'pagamento',
    desc: `Pagamento: ${debito?.desc||'Débito'}`,
    valor, debitoRef: debitoId,
    metodoPag: window._mensState.pagMetodo,
    obs, criadoEm: new Date().toISOString(),
    criadoPor: 'admin',
  };
  db.mens_movs.push(mov);

  // Atualizar status do débito
  const totalPago = pagoAntes + valor;
  if (debito) {
    debito.pago = totalPago >= (debito.valor||0) ? 'total' : 'parcial';
  }

  // Lançar no caixa
  db.mens_caixa = db.mens_caixa || [];
  db.mens_caixa.push({
    id: mensNextId(db),
    tipo: 'receita', cat: 'Mensalidade',
    desc: `${(db.mensalistas||[]).find(m=>m.id===membroId)?.nome||'Membro'} · ${debito?.desc||''}`,
    valor, data: window.dataLocal(),
    obs: window._mensState.pagMetodo,
    criadoEm: new Date().toISOString(),
  });

  mensSave(db);
  closeModal('m-mens-pag');
  mensRenderDetalhe();
};

// ══════════════════════════════════════════
// MODAIS — Despesa
// ══════════════════════════════════════════
window.mensAbrirDespesa = function(despesaId) {
  const db = mensDb();
  const desp = despesaId ? (db.mens_caixa||[]).find(c=>c.id===despesaId) : null;

  // Preencher campos
  document.getElementById('mde-id').value    = desp ? desp.id : '';
  document.getElementById('mde-desc').value  = desp ? desp.desc : '';
  // Preencher valor com máscara
  const _mdeValEl = document.getElementById('mde-valor');
  if (_mdeValEl) {
    if (desp?.valor) {
      _mdeValEl.value = Number(desp.valor).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
    } else {
      _mdeValEl.value = '';
    }
  }
  document.getElementById('mde-obs').value   = desp ? (desp.obs||'') : '';

  // Categoria
  const catSel = document.getElementById('mde-cat');
  if (desp && catSel) catSel.value = desp.cat || 'Bebidas';

  // Data
  if (desp) {
    document.getElementById('mde-data').value = desp.data;
  } else {
    const _d = new Date();
    document.getElementById('mde-data').value = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
  }

  // Título e botão excluir
  document.getElementById('m-mens-despesa-title').textContent = desp ? 'Editar Despesa' : 'Nova Despesa';
  const delBtn = document.getElementById('mde-del-btn');
  if (delBtn) delBtn.style.display = desp ? 'block' : 'none';

  showModal('m-mens-despesa');
};

window.mensConfirmarDespesa = function() {
  const id    = document.getElementById('mde-id').value;
  const cat   = document.getElementById('mde-cat').value;
  const desc  = document.getElementById('mde-desc').value.trim();
  const valor = window.parseMoeda(document.getElementById('mde-valor'));
  const data  = document.getElementById('mde-data').value;
  const obs   = document.getElementById('mde-obs').value.trim();

  if (!desc) return alert('Informe a descrição.');
  if (!valor || valor <= 0) return alert('Informe um valor válido.');
  if (!data) return alert('Informe a data.');

  const db = mensDb();
  db.mens_caixa = db.mens_caixa || [];

  if (id) {
    // Editar existente
    const item = db.mens_caixa.find(c => c.id === id);
    if (item) { item.cat = cat; item.desc = desc; item.valor = valor; item.data = data; item.obs = obs; item.atualizadoEm = new Date().toISOString(); }
  } else {
    // Nova despesa
    db.mens_caixa.push({
      id: mensNextId(db),
      tipo: 'despesa', cat, desc, valor, data, obs,
      criadoEm: new Date().toISOString(),
      criadoPor: 'admin',
    });
  }

  mensSave(db);

  closeModal('m-mens-despesa');
  window._mensState.caixaPeriodo = 'tudo';
  mensRenderCaixa();
  // Toast de sucesso
  const _toast = document.createElement('div');
  _toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#065f46;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.3)';
  _toast.textContent = '✅ Despesa salva!';
  document.body.appendChild(_toast);
  setTimeout(() => _toast.remove(), 2500);
};

// ══════════════════════════════════════════
// WhatsApp — cobrança individual
// ══════════════════════════════════════════
window.mensAbrirWpp = function(membroId) {
  const db = mensDb();
  const membro = (db.mensalistas||[]).find(m=>m.id===membroId);
  if (!membro) return;
  const saldo = mensSaldo(membroId);
  if (saldo >= 0) return alert('Este membro não possui débitos em aberto.');

  const debitos = db.mens_movs.filter(m=>m.membroId==membroId&&m.tipo==='debito'&&m.pago!=='total');
  let linhas = `🏟️ *CremeFC — Mensalidade*\n\nOlá, *${membro.nome.split(' ')[0]}*!\n\nSegue seu extrato:\n`;
  debitos.forEach(d => {
    const pagos = db.mens_movs.filter(m=>m.tipo==='pagamento'&&m.debitoRef===d.id).reduce((s,m)=>s+(m.valor||0),0);
    const rest = (d.valor||0)-pagos;
    linhas += `\n• ${d.desc||'Débito'}: *${fmtR(rest)}*${d.venc?' (venc. '+fmtData(d.venc)+')':''}`;
    if (d.detalhes) linhas += `\n  _${d.detalhes}_`;
  });
  linhas += `\n\n💰 *Total a pagar: ${fmtR(Math.abs(saldo))}*`;
  linhas += `\n\n📱 PIX: ${db.config?.pix||'(configure o PIX nas configurações)'}`;
  linhas += `\n\n✅ Após o pagamento, avise pelo WhatsApp!`;

  const tel = (membro.tel||'').replace(/\D/g,'');
  const url = `https://wa.me/55${tel}?text=${encodeURIComponent(linhas)}`;
  window.open(url, '_blank');
};


// ══════════════════════════════════════════
// GESTÃO DE MEMBROS — Adicionar / Editar / Status
// ══════════════════════════════════════════

window.mensAbrirMembro = function(membroId) {
  const db = mensDb();
  const m = membroId ? (db.mensalistas||[]).find(x=>x.id===membroId) : null;
  document.getElementById('mm-id').value    = m ? m.id : '';
  document.getElementById('mm-nome').value  = m ? m.nome : '';
  document.getElementById('mm-tel').value   = m ? (m.tel||'') : '';
  document.getElementById('mm-code').value  = m ? (m.code||'') : '';
  document.getElementById('m-mens-membro-title').textContent = m ? 'Editar Membro' : 'Novo Membro';
  // Mostrar/esconder botão excluir
  const delBtn = document.getElementById('mm-del-btn');
  if (delBtn) delBtn.style.display = m ? 'block' : 'none';
  showModal('m-mens-membro');
};

window.mensEditarMembro = function(membroId) {
  window.mensAbrirMembro(membroId);
};

window.mensConfirmarMembro = function() {
  const id    = document.getElementById('mm-id').value;
  const nome  = document.getElementById('mm-nome').value.trim();
  const tel   = document.getElementById('mm-tel').value.trim();
  let   code  = document.getElementById('mm-code').value.trim().toUpperCase();

  if (!nome) return alert('Informe o nome do membro.');

  // Gerar código automático se vazio
  if (!code) {
    const parts = nome.split(' ');
    code = (parts[0].slice(0,4) + (parts[parts.length-1]||'').slice(0,4)).toUpperCase();
  }

  const db = mensDb();
  db.mensalistas = db.mensalistas || [];

  // Verificar código duplicado
  const dup = db.mensalistas.find(x => x.code === code && x.id !== id);
  if (dup) return alert(`Código "${code}" já está em uso por ${dup.nome}.`);

  if (id) {
    // Editar existente
    const m = db.mensalistas.find(x => x.id == id);
    if (m) {
      m.nome = nome;
      m.tel  = tel;
      m.code = code;
      m.iniciais = (nome.split(' ')[0]?.[0]||'') + (nome.split(' ').pop()?.[0]||'');
      m.iniciais = m.iniciais.toUpperCase();
    }
  } else {
    // Novo membro
    const novoId = 'm' + Date.now();
    const partes = nome.split(' ');
    const iniciais = ((partes[0]?.[0]||'') + (partes[partes.length-1]?.[0]||'')).toUpperCase();
    db.mensalistas.push({ id: novoId, nome, tel, code, iniciais, status: 'ativo', ativo: true });
  }

  mensSave(db);
  closeModal('m-mens-membro');
  mensRenderLista();
};

window.mensExcluirMembro = function() {
  const id = document.getElementById('mm-id').value;
  if (!id) return;
  const db = mensDb();
  const m  = (db.mensalistas||[]).find(x=>x.id===id);
  if (!m) return;
  window.customConfirm(
    `Excluir ${m.nome}? Todo o histórico financeiro será mantido mas o membro será removido.`,
    () => {
      db.mensalistas = db.mensalistas.filter(x=>x.id!==id);
      mensSave(db);
      closeModal('m-mens-membro');
      mensNavTo('lista', document.getElementById('mnav-lista'));
    },
    { icon:'🗑️', title:'Excluir Membro', okLabel:'Excluir', danger:true }
  );
};

// ── Alterar status manualmente ──
window.mensAlterarStatus = function(membroId) {
  const db = mensDb();
  const m  = (db.mensalistas||[]).find(x=>x.id===membroId);
  if (!m) return;

  const statusAtual = m.statusManual || mensStatusMembro(membroId);
  const opcoes = [
    { val:'ativo',      label:'✅ Ativo (automático)' },
    { val:'dm',         label:'🔵 DM (Diretoria — mensalidade R$25)' },
    { val:'suspenso',   label:'🔒 Suspenso' },
    { val:'desistente', label:'🚪 Desistente' },
  ];

  // Criar modal inline de status
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end;padding:16px';
  let html = `<div style="background:#fff;border-radius:16px;padding:20px;width:100%;max-width:400px">
    <div style="font-size:16px;font-weight:800;margin-bottom:4px">Alterar Status</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:16px">${m.nome}</div>`;
  opcoes.forEach(op => {
    const ativo = (m.statusManual||'ativo') === op.val;
    html += `<button onclick="mensSetStatus('${membroId}','${op.val}')" style="display:block;width:100%;text-align:left;padding:12px 16px;border:2px solid ${ativo?'var(--blue)':'var(--border)'};background:${ativo?'var(--blue-bg)':'#fff'};border-radius:10px;margin-bottom:8px;font-family:inherit;font-size:14px;font-weight:${ativo?'700':'400'};cursor:pointer">${op.label}</button>`;
  });
  html += `<button onclick="this.closest('[style*=fixed]').remove()" style="width:100%;padding:11px;border:1.5px solid var(--border);background:#fff;border-radius:10px;font-family:inherit;font-size:13px;cursor:pointer;margin-top:4px">Cancelar</button></div>`;
  overlay.innerHTML = html;
  overlay.onclick = (e) => { if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
};

window.mensSetStatus = function(membroId, novoStatus) {
  const db = mensDb();
  const m  = (db.mensalistas||[]).find(x=>x.id===membroId);
  if (!m) return;
  m.statusManual = novoStatus === 'ativo' ? null : novoStatus;  // null = automático
  mensSave(db);
  // Fechar overlay
  document.querySelector('[style*="position:fixed"][style*="z-index:9999"]')?.remove();
  // Rerender
  if (window._mensState.telaAtual === 'lista') mensRenderLista();
  else mensRenderDetalhe();
};


// ══════════════════════════════════════════
// LIMPEZA DE DADOS FINANCEIROS (teste)
// ══════════════════════════════════════════
window.mensLimparDados = function() {
  window.customConfirm(
    'Isso vai apagar TODOS os dados financeiros (débitos, pagamentos, despesas e caixa). Os membros e sábados do Bar NÃO serão afetados.',
    () => {
      window.db.mens_movs  = [];
      window.db.mens_caixa = [];
      window.save();
      // Resetar status manual dos membros
      (window.db.mensalistas||[]).forEach(m => { delete m.statusManual; });
      window.save();
      alert('✅ Dados financeiros apagados!');
      mensNavTo('dashboard', document.getElementById('mnav-dashboard'));
    },
    { icon:'🗑️', title:'Limpar dados financeiros', okLabel:'Apagar tudo', danger: true }
  );
};


window.mensExcluirDespesa = function() {
  const id = document.getElementById('mde-id').value;
  if (!id) return;
  const db = mensDb();
  const d  = (db.mens_caixa||[]).find(c=>c.id===id);
  if (!d) return;
  window.customConfirm(
    `Excluir "${d.desc}" (${fmtR(d.valor)})?`,
    () => {
      db.mens_caixa = db.mens_caixa.filter(c=>c.id!==id);
      mensSave(db);
      closeModal('m-mens-despesa');
      window._mensState.caixaPeriodo = 'tudo';
      mensRenderCaixa();
      const _t = document.createElement('div');
      _t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#991b1b;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.3)';
      _t.textContent = '🗑️ Despesa excluída!';
      document.body.appendChild(_t);
      setTimeout(() => _t.remove(), 2000);
    },
    { icon:'🗑️', title:'Excluir Despesa', okLabel:'Excluir', danger:true }
  );
};


// ── Recebimento avulso (abate do saldo total em aberto) ──
window.mensAbrirReceberPagamento = function(membroId) {
  const db     = mensDb();
  const membro = (db.mensalistas||[]).find(m=>m.id===membroId);
  if (!membro) return;

  const totalAberto = Math.abs(mensSaldo(membroId));

  const overlay = document.createElement('div');
  overlay.id = 'receber-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end';
  overlay.innerHTML = `<div style="background:#fff;border-radius:20px 20px 0 0;width:100%;padding:20px">
    <div style="font-size:16px;font-weight:800;margin-bottom:4px">💵 Registrar Recebimento</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:16px">${membro.nome} · Em aberto: <strong style="color:var(--red)">${fmtR(totalAberto)}</strong></div>
    <div class="form-group"><label class="form-label">Valor recebido (R$)</label>
      <input class="form-input" type="tel" id="receber-valor" inputmode="numeric" oninput="maskMoeda(this)"
        value="${Number(totalAberto).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}">
    </div>
    <div class="form-group"><label class="form-label">Método</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap" id="receber-metodos">
        <button class="tag active" onclick="this.parentNode.querySelectorAll('.tag').forEach(b=>b.classList.remove('active'));this.classList.add('active')">PIX</button>
        <button class="tag" onclick="this.parentNode.querySelectorAll('.tag').forEach(b=>b.classList.remove('active'));this.classList.add('active')">Dinheiro</button>
        <button class="tag" onclick="this.parentNode.querySelectorAll('.tag').forEach(b=>b.classList.remove('active'));this.classList.add('active')">Débito</button>
        <button class="tag" onclick="this.parentNode.querySelectorAll('.tag').forEach(b=>b.classList.remove('active'));this.classList.add('active')">Crédito</button>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Observação (opcional)</label>
      <input class="form-input" type="text" id="receber-obs" placeholder="Referência, mês pago...">
    </div>
    <button class="btn btn-primary" onclick="mensConfirmarReceber('${membroId}')">✅ Confirmar recebimento</button>
    <button class="btn btn-secondary" onclick="document.getElementById('receber-overlay').remove()" style="margin-top:8px">Cancelar</button>
  </div>`;
  overlay.onclick = (e) => { if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
};

window.mensConfirmarReceber = function(membroId) {
  const valor   = window.parseMoeda(document.getElementById('receber-valor'));
  const metodo  = document.querySelector('#receber-metodos .tag.active')?.textContent || 'PIX';
  const obs     = document.getElementById('receber-obs')?.value?.trim() || '';

  if (!valor || valor <= 0) return alert('Informe o valor recebido.');

  const db = mensDb();
  db.mens_movs = db.mens_movs || [];

  // ── Abater nos débitos em aberto (do mais antigo para o mais recente) ──
  const debitosAbertos = db.mens_movs
    .filter(m => m.membroId == membroId && m.tipo === 'debito' && m.pago !== 'total')
    .sort((a,b) => (a.criadoEm||'').localeCompare(b.criadoEm||''));

  let restante = valor;

  debitosAbertos.forEach(debito => {
    if (restante <= 0) return;

    // Quanto já foi pago neste débito
    const jagoPago = db.mens_movs
      .filter(m => m.tipo === 'pagamento' && m.debitoRef == debito.id)
      .reduce((s,m) => s + (m.valor||0), 0);

    const emAberto = Math.max(0, (debito.valor||0) - jagoPago);
    if (emAberto <= 0) return;

    const pagando = Math.min(restante, emAberto);
    restante -= pagando;

    // Registrar pagamento vinculado a este débito
    db.mens_movs.push({
      id: 'pag' + Date.now() + Math.random().toString(36).slice(2),
      membroId, tipo: 'pagamento',
      desc: `Pagamento: ${debito.desc||'Débito'}`,
      valor: pagando,
      debitoRef: debito.id,
      metodoPag: metodo, obs,
      criadoEm: new Date().toISOString(),
      criadoPor: 'admin',
    });

    // Atualizar status do débito
    const totalPagoAgora = jagoPago + pagando;
    debito.pago = totalPagoAgora >= (debito.valor||0) ? 'total' : 'parcial';
  });

  // Se sobrou valor (crédito a favor), registra como pagamento avulso sem debitoRef
  if (restante > 0) {
    db.mens_movs.push({
      id: 'pag' + Date.now() + Math.random().toString(36).slice(2),
      membroId, tipo: 'pagamento',
      desc: `Crédito${obs?' — '+obs:''}`,
      valor: restante,
      metodoPag: metodo, obs,
      criadoEm: new Date().toISOString(),
      criadoPor: 'admin',
    });
  }

  // Lançar total recebido no caixa como receita
  db.mens_caixa = db.mens_caixa || [];
  const nomeMembro = (db.mensalistas||[]).find(m=>m.id===membroId)?.nome||'Membro';
  db.mens_caixa.push({
    id: 'cx' + Date.now(),
    tipo: 'receita', cat: 'Mensalidade',
    desc: `${nomeMembro.split(' ').slice(0,2).join(' ')} · ${obs||'Recebimento'}`,
    valor, data: window.dataLocal(),
    obs: metodo, criadoEm: new Date().toISOString(),
  });

  mensSave(db);
  document.getElementById('receber-overlay')?.remove();

  // Toast
  const _t = document.createElement('div');
  _t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#065f46;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;z-index:9999;white-space:nowrap';
  _t.textContent = `✅ ${fmtR(valor)} recebido e abatido!`;
  document.body.appendChild(_t);
  setTimeout(() => _t.remove(), 2500);

  mensRenderDetalhe();
};


// ══════════════════════════════════════════
// CAIXA — Crédito manual
// ══════════════════════════════════════════
window.mensAbrirReceita = function(receitaId) {
  const db   = mensDb();
  const rec  = receitaId ? (db.mens_caixa||[]).find(c=>c.id===receitaId&&c.tipo==='receita') : null;

  document.getElementById('mrc-id').value    = rec ? rec.id : '';
  document.getElementById('mrc-desc').value  = rec ? rec.desc : '';
  document.getElementById('mrc-obs').value   = rec ? (rec.obs||'') : '';

  const catSel = document.getElementById('mrc-cat');
  if (catSel && rec) catSel.value = rec.cat || 'Outros';

  const valEl = document.getElementById('mrc-valor');
  if (valEl) valEl.value = rec?.valor
    ? Number(rec.valor).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
    : '';

  const dataEl = document.getElementById('mrc-data');
  if (dataEl) {
    if (rec) { dataEl.value = rec.data; }
    else { const _d=new Date(); dataEl.value=`${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`; }
  }

  document.getElementById('m-mens-receita-title').textContent = rec ? 'Editar Crédito' : 'Novo Crédito';
  const delBtn = document.getElementById('mrc-del-btn');
  if (delBtn) delBtn.style.display = rec ? 'block' : 'none';

  showModal('m-mens-receita');
};

window.mensConfirmarReceita = function() {
  const id    = document.getElementById('mrc-id').value;
  const cat   = document.getElementById('mrc-cat').value;
  const desc  = document.getElementById('mrc-desc').value.trim();
  const valor = window.parseMoeda(document.getElementById('mrc-valor'));
  const data  = document.getElementById('mrc-data').value;
  const obs   = document.getElementById('mrc-obs').value.trim();

  if (!desc)  return alert('Informe a descrição.');
  if (!valor || valor <= 0) return alert('Informe um valor válido.');
  if (!data)  return alert('Informe a data.');

  const db = mensDb();
  db.mens_caixa = db.mens_caixa || [];

  if (id) {
    const item = db.mens_caixa.find(c=>c.id===id);
    if (item) { item.cat=cat; item.desc=desc; item.valor=valor; item.data=data; item.obs=obs; item.atualizadoEm=new Date().toISOString(); }
  } else {
    db.mens_caixa.push({
      id: 'rc'+Date.now(), tipo:'receita', cat, desc, valor, data, obs,
      criadoEm: new Date().toISOString(), criadoPor:'admin',
    });
  }

  mensSave(db);
  closeModal('m-mens-receita');
  window._mensState.caixaPeriodo = 'tudo';
  mensRenderCaixa();

  const _t = document.createElement('div');
  _t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#065f46;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;white-space:nowrap';
  _t.textContent = '✅ Crédito salvo!';
  document.body.appendChild(_t);
  setTimeout(()=>_t.remove(), 2000);
};

window.mensExcluirReceita = function() {
  const id = document.getElementById('mrc-id').value;
  if (!id) return;
  const db = mensDb();
  const r  = (db.mens_caixa||[]).find(c=>c.id===id);
  if (!r) return;
  window.customConfirm(`Excluir "${r.desc}" (${fmtR(r.valor)})?`, () => {
    db.mens_caixa = db.mens_caixa.filter(c=>c.id!==id);
    mensSave(db);
    closeModal('m-mens-receita');
    window._mensState.caixaPeriodo = 'tudo';
    mensRenderCaixa();
  }, { icon:'🗑️', title:'Excluir Crédito', okLabel:'Excluir', danger:true });
};

// Registrar funções globais para onclick
['mensNavTo','mensListaFiltrar','mensListaStatus','mensAbrirDetalhe',
 'mensCaixaPeriodo','mensRelPeriodo','mensAbrirDebito','mensAbrirDebitoParaMembro',
 'mensConfirmarDebito','mensAbrirPag','mpSelMetodo','mensConfirmarPag',
 'mensAbrirDespesa','mensConfirmarDespesa','mensExcluirDespesa','mensAbrirWpp',
 'mensAbrirMembro','mensEditarMembro','mensConfirmarMembro','mensExcluirMembro',
 'mensAlterarStatus','mensSetStatus','mensLimparDados','mensAbrirModalEmAberto','mensAbrirReceberPagamento','mensConfirmarReceber','mensAbrirReceita','mensConfirmarReceita','mensExcluirReceita'].forEach(name => {
  if (window[name]) {
    const fn = window[name];
    window[name] = function(...args) { return fn(...args); };
  }
});

