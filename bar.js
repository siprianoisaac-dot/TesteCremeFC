// ═══════════════════════════════════════════════════
// bar.js — Sábados, consumo, participantes, pagamentos, WhatsApp, Histórico
// ═══════════════════════════════════════════════════
'use strict';

// Variáveis de estado do Bar
let _sabTab = 'consumos';  // tab ativa no detalhe do sábado
let _sabId  = null;        // ID do sábado atual
let _consMid = null;       // mensalista em edição de consumo
let _cTemp   = {};         // consumos temporários

function renderHome(){
  let tr=0,tp=0,tl=0;
  (window.db.sabados||[]).forEach(sab=>(sab.participantes||[]).forEach(p=>{const tc=window.calcC(p.consumos),pg=window.totPago(p);tr+=Math.max(0,tc-pg);tp+=pg;tl+=tc-window.calcCusto(p.consumos);}));
  // Lucro REAL = baseado no que foi recebido
  let custoTotal=0;
  (window.db.sabados||[]).forEach(sab=>(sab.participantes||[]).forEach(p=>{custoTotal+=window.calcCusto(p.consumos);}));
  const totalConsumido=(window.db.sabados||[]).reduce((s,sab)=>s+(sab.participantes||[]).reduce((s2,p)=>s2+window.calcC(p.consumos),0),0);
  const lucroReal=tp-custoTotal*(tp/Math.max(totalConsumido,1));
  document.getElementById('h-receber').textContent=window.fmt(tr);
  document.getElementById('h-recebido').textContent=window.fmt(tp);
  document.getElementById('h-lucro').textContent=window.fmt(tl);
  document.getElementById('h-lucro-real').textContent=window.fmt(Math.max(0,lucroReal));
  document.getElementById('h-sabados').textContent=(window.db.sabados||[]).length;

  // Alerta inadimplentes > 1 mês
  const mesAtualH=new Date().toISOString().slice(0,7);
  const inadimplentes=[];
  (window.db.mensalistas||[]).forEach(m=>{
    const meses=[...new Set((window.db.sabados||[]).map(s=>window.mk(s.data)))].filter(mk=>mk<mesAtualH).sort();
    let saldoAcc=0;
    meses.forEach(mk=>{
      let tc=0,pg=0;
      (window.db.sabados||[]).filter(s=>window.mk(s.data)===mk).forEach(s=>{
        const p=s.participantes?.find(x=>x.mensalistaId==m.id);
        if(p){tc+=window.calcC(p.consumos);pg+=window.totPago(p);}
      });
      saldoAcc+=tc-pg;
    });
    if(saldoAcc>0) inadimplentes.push({m,saldo:saldoAcc});
  });
  inadimplentes.sort((a,b)=>b.saldo-a.saldo);
  const alertEl=document.getElementById('h-alert-inadimplentes');
  if(inadimplentes.length>0){
    alertEl.innerHTML=`<div style="background:var(--red-light);border:1px solid #fca5a5;border-radius:var(--radius);padding:12px 14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:13px;font-weight:700;color:var(--red)">⚠️ ${inadimplentes.length} inadimplente(s) de meses anteriores</div>
        <span style="font-size:12px;font-weight:700;color:var(--red)">${window.fmt(inadimplentes.reduce((s,x)=>s+x.saldo,0))}</span>
      </div>
      ${inadimplentes.slice(0,3).map(({m,saldo})=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:var(--red)"><span>${m.nome}</span><span style="font-weight:700">${window.fmt(saldo)}</span></div>`).join('')}
      ${inadimplentes.length>3?`<div style="font-size:11px;color:var(--red);margin-top:4px">+ ${inadimplentes.length-3} outros</div>`:''}
    </div>`;
  } else {
    alertEl.innerHTML='';
  }
  const mes=new Date().toISOString().slice(0,7);
  const sabsMes=(window.db.sabados||[]).filter(s=>s.data.slice(0,7)===mes);
  const mesNome=window.fmtM(mes+'-01');
  document.getElementById('h-mes-title').textContent='📅 '+mesNome;
  const tmMes=sabsMes.reduce((s,sab)=>s+(sab.participantes||[]).reduce((s2,p)=>s2+window.calcC(p.consumos),0),0);
  const ativoMes=sabsMes.find(s=>s.ativo);
  document.getElementById('h-mes-card').innerHTML=sabsMes.length?
    `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:600;font-size:14px">${mesNome}</div><div style="font-size:12px;color:var(--text2)">${sabsMes.length} sábado(s) · ${window.fmt(tmMes)}</div></div><span class="badge ${ativoMes?'badge-ativo':'badge-fechado'}">${ativoMes?'Em aberto':'Fechado'}</span></div></div>`:
    '<div class="card-flat" style="text-align:center;font-size:13px;color:var(--text2);padding:14px">Nenhum sábado este mês</div>';
  const ativo=(window.db.sabados||[]).find(s=>s.ativo);
  document.getElementById('h-sabado-ativo').innerHTML=ativo?
    `<div class="sabado-card ativo-card" onclick="openSabado(${ativo.id})"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:14px;font-weight:700">📅 ${window.fmtD(ativo.data)}</div><div style="font-size:12px;color:var(--text2)">${(ativo.participantes||[]).length} participantes</div></div><span class="badge badge-ativo">ATIVO →</span></div></div>`:
    '<div class="card-flat" style="text-align:center;font-size:13px;color:var(--text2);padding:14px">Nenhum sábado ativo</div>';
}

// ═══════════════════════════════════════════
// SÁBADOS LIST
// ═══════════════════════════════════════════
function renderSabados(){
  const meses={};
  (window.db.sabados||[]).forEach(sab=>{const m=window.mk(sab.data);if(!meses[m])meses[m]=[];meses[m].push(sab);});
  const keys=Object.keys(meses).sort((a,b)=>b.localeCompare(a));
  const el=document.getElementById('list-meses');
  const empty=document.getElementById('sab-empty');
  if(!keys.length){el.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  el.innerHTML=keys.map(mk=>{
    const sabs=meses[mk].sort((a,b)=>b.data.localeCompare(a.data));
    const total=sabs.reduce((s,sab)=>s+(sab.participantes||[]).reduce((s2,p)=>s2+window.calcC(p.consumos),0),0);
    const ativo=sabs.find(s=>s.ativo);
    const rows=sabs.map(sab=>{
      const tc=(sab.participantes||[]).reduce((s,p)=>s+window.calcC(p.consumos),0);
      const pg=(sab.participantes||[]).reduce((s,p)=>s+window.totPago(p),0);
      return `<div class="sabado-card ${sab.ativo?'ativo-card':''}"><div style="display:flex;justify-content:space-between;align-items:center" onclick="openSabado(${sab.id})"><div><div style="font-size:14px;font-weight:600">${window.fmtD(sab.data)}</div><div style="font-size:12px;color:var(--text2)">${(sab.participantes||[]).length} part. · ${window.fmt(tc)}</div></div><div style="text-align:right">${sab.ativo?'<span class="badge badge-ativo">ATIVO</span>':'<span class="badge badge-fechado">Fechado</span>'}<div style="font-size:12px;color:var(--green-mid);font-weight:600;margin-top:3px">${window.fmt(pg)} pago</div></div></div><div style="display:flex;justify-content:flex-end;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)"><button class="btn btn-danger btn-xs" onclick="event.stopPropagation();excluirSabado(${sab.id})">🗑️ Excluir sábado</button></div></div>`;
    }).join('');
    const mesAtual=new Date().toISOString().slice(0,7);
    const isOpen=(mk===mesAtual||!!ativo);
    const mesFechado=(window.db.mesesFechados||[]).includes(mk);
    const btnFechar=!ativo&&!mesFechado?`<button onclick="event.stopPropagation();fecharMes('${mk}')" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer">🔒 Fechar mês</button>`:
      mesFechado?`<span style="background:rgba(255,255,255,.15);padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600">✅ Fechado</span>`:'';
    return `<div class="month-block"><div class="month-block-header" onclick="this.nextElementSibling.classList.toggle('open')"><div><div style="font-size:14px;font-weight:700">${window.fmtM(mk+'-01')} ${mesFechado?'✅':''}</div><div style="font-size:11px;opacity:.75">${sabs.length} sábado(s) · ${window.fmt(total)}</div></div><div style="display:flex;align-items:center;gap:6px">${ativo?'<span style="background:rgba(255,255,255,.25);padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600">EM ABERTO</span>':btnFechar}<span style="font-size:18px">${isOpen?'▴':'▾'}</span></div></div><div class="month-block-body ${isOpen?'open':''}">${rows}</div></div>`;
  }).join('');
}

// ═══════════════════════════════════════════
// SÁBADO DETALHE
// ═══════════════════════════════════════════
function gSab(){return (window.db.sabados||[]).find(s=>s.id===(window._sabId||_sabId));}

window.showSabTab=(tab,btn)=>{
  _sabTab=tab;
  document.querySelectorAll('#sab-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ['consumos','pagamentos','estoque','resumo'].forEach(t=>document.getElementById('tab-'+t).style.display=t===tab?'block':'none');
  renderSabDet();
};

window.renderSabDet = function renderSabDet(){
  const sab=gSab();if(!sab)return;
  const tc=(sab.participantes||[]).reduce((s,p)=>s+window.calcC(p.consumos),0);
  const pg=(sab.participantes||[]).reduce((s,p)=>s+window.totPago(p),0);
  document.getElementById('sab-metricas').innerHTML=`<div class="metric-grid" style="margin-bottom:0"><div class="metric-card"><div class="m-label">Participantes</div><div class="m-val blue">${(sab.participantes||[]).length}</div></div><div class="metric-card"><div class="m-label">Consumido</div><div class="m-val green">${window.fmt(tc)}</div></div><div class="metric-card"><div class="m-label">A receber</div><div class="m-val amber">${window.fmt(tc-pg)}</div></div></div>`;
  document.getElementById('fab-add-pessoa').style.display=_sabTab==='consumos'?'flex':'none';
  if(_sabTab==='consumos')renderTabC(sab);
  if(_sabTab==='pagamentos')renderTabP(sab);
  if(_sabTab==='estoque')renderTabE(sab);
  if(_sabTab==='resumo')renderTabR(sab);
}

window.renderTabC = function renderTabC(sab){
  const el=document.getElementById('tab-consumos');
  if(!(sab.participantes||[]).length){el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text2)"><div style="font-size:36px;margin-bottom:8px">👥</div><div>Toque no + para adicionar</div></div>';return;}
  const sorted=[...(sab.participantes||[])].sort((a,b)=>{const na=(window.db.mensalistas||[]).find(m=>m.id===a.mensalistaId)?.nome||'';const nb=(window.db.mensalistas||[]).find(m=>m.id===b.mensalistaId)?.nome||'';return na.localeCompare(nb,'pt-BR');});
  el.innerHTML=sorted.map(part=>{
    const m=(window.db.mensalistas||[]).find(x=>x.id===part.mensalistaId)||{nome:'?',iniciais:'?'};
    const tc=window.calcC(part.consumos);
    const tags=Object.entries(part.consumos||{}).filter(([,q])=>q>0).map(([id,q])=>{const p=window.gProd(id);return `<span class="cp-tag">${p.icon} ${p.nome} x${q}${p.promo&&q>=p.promo.qtd?' 🏷️':''}</span>`;}).join('');
    const midN2 = isNaN(part.mensalistaId) ? part.mensalistaId : Number(part.mensalistaId);
    const jaValidou=(sab.validadoPor||[]).some(v=>v==part.mensalistaId||v==midN2);
    const validBadge=jaValidou
      ?`<span style="font-size:10px;background:var(--green-light);color:var(--green);padding:2px 7px;border-radius:10px;font-weight:600">✅ Validado</span>`
      :`<span style="font-size:10px;background:var(--amber-light);color:var(--amber);padding:2px 7px;border-radius:10px;font-weight:600">⏳ Pendente</span>`;
    return `<div class="cp-row"><div class="cp-header"><div class="avatar">${m.iniciais}</div><div style="flex:1"><div class="cp-name">${m.nome}</div><div style="margin-top:2px">${validBadge}</div></div><div class="cp-total">${tc>0?window.fmt(tc):'—'}</div></div>${tags?`<div class="cp-tags" style="margin-top:6px">${tags}</div>`:''}<div class="cp-actions">
      <button class="btn btn-primary btn-xs" style="flex:1" onclick="abrirConsumo('${part.mensalistaId}')">✏️ ${tc>0?'Alterar':'Incluir'}</button>
      <button class="btn ${jaValidou?'btn-secondary':'btn-green'} btn-xs" onclick="validarConsumoAdmin('${sab.id}','${part.mensalistaId}')" style="${jaValidou?'opacity:.6;cursor:default':''}">${jaValidou?'🔒 Validado':'✅ Validar'}</button>
      <button class="btn btn-danger btn-xs" onclick="excluirPart('${part.mensalistaId}')">🗑️</button>
    </div></div>`;
  }).join('');
}

window.renderTabP = function renderTabP(sab){
  const el=document.getElementById('tab-pagamentos');
  const com=(sab.participantes||[]).filter(p=>window.calcC(p.consumos)>0);
  if(!com.length){el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text2)">Nenhum consumo</div>';return;}
  const sorted=[...com].sort((a,b)=>{const na=(window.db.mensalistas||[]).find(m=>m.id===a.mensalistaId)?.nome||'';const nb=(window.db.mensalistas||[]).find(m=>m.id===b.mensalistaId)?.nome||'';return na.localeCompare(nb,'pt-BR');});
  el.innerHTML=sorted.map(part=>{
    const m=(window.db.mensalistas||[]).find(x=>x.id===part.mensalistaId)||{nome:'?',iniciais:'?'};
    const tc=window.calcC(part.consumos),pg=window.totPago(part),sd=window.saldoP(part),st=window.stPart(part);
    const bL={pago:'Pago ✓',parcial:'Parcial',aberto:'Em aberto',zero:'—'}[st];
    const bC={pago:'badge-pago',parcial:'badge-parcial',aberto:'badge-aberto',zero:'badge-fechado'}[st];
    const jaValidouP=(sab.validadoPor||[]).some(v=>v==part.mensalistaId);
    return `<div class="card"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div class="avatar">${m.iniciais}</div><div style="flex:1"><div style="font-size:14px;font-weight:600">${m.nome}</div><div style="font-size:12px;color:var(--text2)">Consumiu: ${window.fmt(tc)} · Pago: ${window.fmt(pg)}</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px"><span class="badge ${bC}">${bL}</span>${jaValidouP?'<span style="font-size:10px;color:var(--green);font-weight:600">✅ Validado</span>':'<span style="font-size:10px;color:var(--amber);font-weight:600">⏳ Pendente</span>'}</div></div>${sd>0?`<div style="background:var(--amber-light);border-radius:8px;padding:7px 10px;font-size:13px;color:var(--amber);font-weight:600;margin-bottom:8px">Saldo: ${window.fmt(sd)}</div>`:''}${sd<0?`<div style="background:var(--green-light);border-radius:8px;padding:7px 10px;font-size:13px;color:var(--green);font-weight:600;margin-bottom:8px">Crédito: ${window.fmt(Math.abs(sd))}</div>`:''}<div style="display:flex;gap:6px">${sd>0?`<button class="btn btn-primary btn-sm" style="flex:1" onclick="abrirPag('${sab.id}','${part.mensalistaId}')">💳 Pagar</button>`:''}<button class="btn btn-secondary btn-sm" style="flex:1" onclick="abrirWpp('${sab.id}','${part.mensalistaId}')">📲 Cobrar</button></div></div>`;
  }).join('');
}

window.renderTabE = function renderTabE(sab){
  const vendido={};
  (sab.participantes||[]).forEach(p=>Object.entries(p.consumos||{}).forEach(([id,q])=>{vendido[id]=(vendido[id]||0)+q;}));
  const rows=(window.db.produtos||[]).map(p=>{const lev=sab.estoque?.[p.id]||0,vend=vendido[p.id]||0,sobra=lev-vend;const cls=sobra>0?'bg-pos':sobra<0?'bg-neg':'';return `<div class="bg-cell">${p.icon} ${p.nome}</div><div class="bg-cell">${lev}</div><div class="bg-cell">${vend}</div><div class="bg-cell ${cls}">${sobra>0?'+':''}${sobra}</div>`;}).join('');
  document.getElementById('tab-estoque').innerHTML=`<div class="card"><div class="balanço-grid"><div class="bg-header">Produto</div><div class="bg-header">Levou</div><div class="bg-header">Vendeu</div><div class="bg-header">Sobra</div>${rows}</div></div><div style="font-size:12px;color:var(--text2);text-align:center;margin-top:8px">🟢 sobra · 🔴 faltou</div>`;
}

window.renderTabR = function renderTabR(sab){
  const contagens={};
  (sab.participantes||[]).forEach(p=>Object.entries(p.consumos||{}).forEach(([id,q])=>{contagens[id]=(contagens[id]||0)+q;}));
  const top=Object.entries(contagens).sort((a,b)=>b[1]-a[1]);
  const tg=(sab.participantes||[]).reduce((s,p)=>s+window.calcC(p.consumos),0);
  const tr=(sab.participantes||[]).reduce((s,p)=>s+window.totPago(p),0);
  let cT=0,lT=0;
  const prodRows=top.map(([id,q])=>{const p=window.gProd(id);let rec=p.promo&&q>=p.promo.qtd?Math.floor(q/p.promo.qtd)*p.promo.valor+(q%p.promo.qtd)*p.preco:q*p.preco;const cst=(p.custo||0)*q,luc=rec-cst;cT+=cst;lT+=luc;return `<div class="rep-row"><span style="color:var(--text2)">${p.icon} ${p.nome} (${q}x)</span><span style="font-weight:600">${window.fmt(rec)}</span></div>`;}).join('');
  const porP=[...(sab.participantes||[])].sort((a,b)=>{const na=(window.db.mensalistas||[]).find(m=>m.id===a.mensalistaId)?.nome||'';const nb=(window.db.mensalistas||[]).find(m=>m.id===b.mensalistaId)?.nome||'';return na.localeCompare(nb,'pt-BR');}).filter(p=>window.calcC(p.consumos)>0).map(p=>{const m=(window.db.mensalistas||[]).find(x=>x.id===p.mensalistaId)||{nome:'?'};return `<div class="rep-row"><span style="color:var(--text2)">${m.nome}</span><span style="font-weight:700;color:var(--red)">${window.fmt(window.calcC(p.consumos))}</span></div>`;}).join('');
  document.getElementById('tab-resumo').innerHTML=`<div class="card"><div class="rep-row"><span style="color:var(--text2)">Total consumido</span><span style="font-weight:700">${window.fmt(tg)}</span></div><div class="rep-row"><span style="color:var(--text2)">Total recebido</span><span style="font-weight:700;color:var(--green-mid)">${window.fmt(tr)}</span></div><div class="rep-row"><span style="color:var(--text2)">A receber</span><span style="font-weight:700;color:var(--amber)">${window.fmt(tg-tr)}</span></div></div><div class="s-title">Por produto</div><div class="card">${prodRows||'<div style="color:var(--text2)">Sem consumos</div>'}</div><div class="s-title">Por mensalista</div><div class="card">${porP||'<div style="color:var(--text2)">Sem consumos</div>'}</div><div class="total-bar-green" style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between;font-size:13px;opacity:.85"><span>Custo estimado</span><span>${window.fmt(cT)}</span></div><div style="display:flex;justify-content:space-between;font-size:17px"><span>Lucro bruto</span><span>${window.fmt(lT)}</span></div></div>${sab.ativo?`<button class="btn btn-amber" style="margin-top:12px" onclick="fecharSabado()">🔒 Fechar este sábado</button>`:''}`;
}

// ═══════════════════════════════════════════
// CRIAR SÁBADO
// ═══════════════════════════════════════════
window.abrirCriarSabado=()=>{
  document.getElementById('cs-data').value=new Date().toISOString().split('T')[0];
  const sorted=[...(window.db.produtos||[])].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  document.getElementById('cs-estoque').innerHTML=sorted.map(p=>`<div class="estoque-row"><span style="font-size:18px">${p.icon}</span><div style="flex:1;font-size:14px">${p.nome}</div><input class="estoque-input" type="number" id="est-${p.id}" placeholder="0" min="0"></div>`).join('');
  window.showModal('m-criar-sab');
};

window.criarSabado=()=>{
  const data=document.getElementById('cs-data').value;
  if(!data){alert('Selecione a data');return;}
  const estoque={};
  (window.db.produtos||[]).forEach(p=>{const v=parseInt(document.getElementById('est-'+p.id)?.value)||0;if(v>0)estoque[p.id]=v;});
  (window.db.sabados||[]).forEach(s=>s.ativo=false);
  if(!window.db.sabados)window.db.sabados=[];
  const novo={id:window.db.nextId++,data,ativo:true,estoque,participantes:[]};
  window.db.sabados.push(novo);
  window.save();
  window.closeModal('m-criar-sab');
  window.openSabado(novo.id);
};

window.fecharMes=(mk)=>{
  const sabs=(window.db.sabados||[]).filter(s=>window.mk(s.data)===mk);
  // Calcular devedores
  const devedores=[];
  (window.db.mensalistas||[]).forEach(m=>{
    let tc=0,pg=0;
    sabs.forEach(s=>{const p=s.participantes?.find(x=>x.mensalistaId==m.id);if(p){tc+=window.calcC(p.consumos);pg+=window.totPago(p);}});
    if(tc-pg>0) devedores.push({m,saldo:tc-pg,tc,pg});
  });
  // Montar tela de fechamento
  const nomeMes=window.fmtM(mk+'-01');
  const totalMes=sabs.reduce((s,sab)=>s+(sab.participantes||[]).reduce((s2,p)=>s2+window.calcC(p.consumos),0),0);
  const totalPgMes=sabs.reduce((s,sab)=>s+(sab.participantes||[]).reduce((s2,p)=>s2+window.totPago(p),0),0);
  const totalDev=devedores.reduce((s,x)=>s+x.saldo,0);
  document.getElementById('fm-mes-nome').textContent=nomeMes;
  document.getElementById('fm-resumo').innerHTML=`
    <div class="metric-grid">
      <div class="metric-card"><div class="m-label">Total consumido</div><div class="m-val blue" style="font-size:16px">${window.fmt(totalMes)}</div></div>
      <div class="metric-card"><div class="m-label">Total recebido</div><div class="m-val green" style="font-size:16px">${window.fmt(totalPgMes)}</div></div>
    </div>
    <div style="background:var(--red-light);border:1px solid #fca5a5;border-radius:var(--radius);padding:10px 14px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:6px">⚠️ ${devedores.length} devedores · ${window.fmt(totalDev)}</div>
      ${devedores.map(({m,saldo})=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #fca5a580">
          <div style="font-size:13px;font-weight:600">${m.nome}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:13px;font-weight:700;color:var(--red)">${window.fmt(saldo)}</span>
            <button onclick="abrirWppMes('${mk}',${m.id})" style="background:#25D366;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer">📲 Cobrar</button>
            <button onclick="abrirPagMensal('${m.id}')" style="background:var(--blue);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer">💳 Registrar pag.</button>
          </div>
        </div>`).join('')}
    </div>`;
  window._fecharMesKey=mk;
  // Sugerir dia 10 do mês seguinte como vencimento padrão
  const [ano,mes]=mk.split('-').map(Number);
  const proxMes=mes===12?1:mes+1;
  const proxAno=mes===12?ano+1:ano;
  const venc=`${proxAno}-${String(proxMes).padStart(2,'0')}-10`;
  document.getElementById('fm-vencimento').value=venc;
  window.showModal('m-fechar-mes');
};

window.abrirWppMes=(mk,mid)=>{
  // Pega qualquer sábado do mês para usar como referência na mensagem mensal
  const sabs=(window.db.sabados||[]).filter(s=>window.mk(s.data)===mk);
  if(!sabs.length)return;
  // Usa o último sábado do mês como referência (abrirWpp já agrupa por mês)
  const sab=sabs.sort((a,b)=>b.data.localeCompare(a.data))[0];
  window.abrirWpp(sab.id,mid);
};

window.confirmarFechamentoMes=()=>{
  const mk=window._fecharMesKey;
  if(!mk)return;
  const venc=document.getElementById('fm-vencimento').value;
  if(!venc){alert('Informe a data de vencimento');return;}
  if(!window.db.mesesFechados)window.db.mesesFechados=[];
  if(!window.db.mesesFechados.includes(mk))window.db.mesesFechados.push(mk);
  // Salvar vencimento por mês
  if(!window.db.vencimentos)window.db.vencimentos={};
  window.db.vencimentos[mk]=venc;
  window.save();
  window.closeModal('m-fechar-mes');
  renderSabados();
  renderHome();
};

window.excluirSabado=(id)=>{
  const sab=(window.db.sabados||[]).find(s=>s.id===id);
  if(!sab)return;
  const label=window.fmtD(sab.data);
  const temDados=(sab.participantes||[]).length>0;
  const msg=temDados
    ? `Excluir o sábado de ${label}? Ele possui ${sab.participantes.length} participante(s) com consumos registrados. Todos os dados serão perdidos.`
    : `Excluir o sábado de ${label}?`;
  window.customConfirm(msg, ()=>{
    window.db.sabados=window.db.sabados.filter(s=>s.id!==id);
    window.save();
    renderSabados();
  }, {icon:'🗑️', title:'Excluir sábado', okLabel:'Excluir', danger:true});
};

window.validarConsumoAdmin=(sabId,mid)=>{
  const sab=(window.db.sabados||[]).find(s=>s.id==sabId);
  if(!sab)return;
  if(!sab.validadoPor)sab.validadoPor=[];
  const m=(window.db.mensalistas||[]).find(x=>x.id==mid);
  const midN = isNaN(mid) ? mid : Number(mid);
  // Já validado por qualquer um (admin ou mensalista)
  const jaValidou = sab.validadoPor.some(v => v==mid || v==midN);
  if(jaValidou){
    // Quem validou?
    alert(`✅ Consumo de ${m?.nome||'mensalista'} já está validado.\nNão é possível alterar após a validação.`);
    return;
  }
  // Verificar se tem consumo para validar
  const part = (sab.participantes||[]).find(p=>p.mensalistaId==mid||p.mensalistaId==midN);
  const tc = window.calcC(part?.consumos||{});
  if(tc === 0){
    if(!confirm(`${m?.nome||'Mensalista'} não tem consumo registrado. Validar mesmo assim?`)) return;
  }
  sab.validadoPor.push(midN);
  window.save();renderSabDet();
};

window.fecharSabado=()=>{
  window.customConfirm('Confirma o encerramento deste sábado? Esta ação não pode ser desfeita.', ()=>{ const sab=gSab();if(sab)sab.ativo=false; window.save();window.navTo('sabados'); }, {icon:'🔒', title:'Fechar sábado', okLabel:'Fechar', danger:true});
};

// ═══════════════════════════════════════════
// PARTICIPANTES
// ═══════════════════════════════════════════
window.abrirAddPessoa=()=>{
  const sab=gSab();if(!sab)return;
  const ja=(sab.participantes||[]).map(p=>p.mensalistaId);
  const disp=[...(window.db.mensalistas||[]).filter(m=>!ja.includes(m.id))].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  document.getElementById('search-add').value='';
  renderAddLista(disp);
  window.showModal('m-add-pessoa');
};

window.renderAddLista = function renderAddLista(lista){
  const el=document.getElementById('add-lista');
  if(!lista.length){el.innerHTML='<div style="text-align:center;color:var(--text2);padding:20px">Todos já adicionados</div>';return;}
  el.innerHTML=lista.map(m=>`<div class="cfg-item" style="cursor:pointer" onclick="addPart('${m.id}')"><div style="display:flex;align-items:center;gap:10px"><div class="avatar">${m.iniciais}</div><div style="font-weight:600;font-size:14px">${m.nome}</div></div><span style="color:var(--blue);font-size:22px">+</span></div>`).join('');
}

window.filtrarAdd=()=>{
  const sab=gSab();if(!sab)return;
  const q=(document.getElementById('search-add').value||'').toLowerCase().trim();
  const ja=(sab.participantes||[]).map(p=>p.mensalistaId);
  let disp=[...(window.db.mensalistas||[]).filter(m=>!ja.includes(m.id))].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  if(q)disp=disp.filter(m=>m.nome.toLowerCase().includes(q));
  renderAddLista(disp);
};

window.addPart=(mid)=>{
  const sab=gSab();if(!sab)return;
  // Normalizar ID (pode vir como string ou número)
  const midNorm = isNaN(mid) ? mid : Number(mid);
  if(!(sab.participantes||[]).find(p=>p.mensalistaId==mid || p.mensalistaId==midNorm)){
    if(!sab.participantes)sab.participantes=[];
    sab.participantes.push({mensalistaId:midNorm,consumos:{},pagamentos:[]});
    window.save();
  }
  window.closeModal('m-add-pessoa');renderSabDet();
};

window.excluirPart=(mid)=>{
  const midN = isNaN(mid) ? mid : Number(mid);
  const m=(window.db.mensalistas||[]).find(x=>x.id==mid||x.id==midN);
  const _nome=m?.nome||'mensalista'; window.customConfirm('Remover '+_nome+' deste sábado?', ()=>{ const sab=gSab();sab.participantes=sab.participantes.filter(p=>p.mensalistaId!=mid&&p.mensalistaId!=midN); window.save();renderSabDet(); }, {icon:'🗑️', title:'Remover participante', okLabel:'Remover', danger:true});
};

// ═══════════════════════════════════════════
// CONSUMO
// ═══════════════════════════════════════════
window.abrirConsumo=(mid)=>{
  const sab=(window.db.sabados||[]).find(s=>s.id===(window._sabId||_sabId));
  const part=sab?.participantes?.find(p=>p.mensalistaId===mid);
  const m=(window.db.mensalistas||[]).find(x=>x.id===mid);
  _consMid=mid;_cTemp=Object.assign({},part?.consumos||{});
  document.getElementById('mc-title').textContent=m?.nome||'Consumo';
  renderCProdos();window.showModal('m-consumo');
};

function renderCProdos(){
  const sorted=[...(window.db.produtos||[])].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  document.getElementById('mc-produtos').innerHTML=sorted.map(p=>{
    const q=_cTemp[p.id]||0;
    const promoL=p.promo?`<span class="promo-tag">${p.promo.qtd}x=${window.fmt(p.promo.valor)}</span>`:'';
    return `<div class="prod-row"><span style="font-size:22px">${p.icon}</span><div style="flex:1"><div class="prod-name">${p.nome}${promoL}</div><div class="prod-price">${window.fmt(p.preco)}</div></div><div class="counter-ctrl">${q>0?`<div class="c-btn minus" onclick="chgC('${p.id}',-1)">−</div>`:'<div style="width:30px"></div>'}<span class="${q>0?'c-val':'c-val zero'}">${q>0?q:'—'}</span><div class="c-btn plus" onclick="chgC('${p.id}',1)">+</div></div></div>`;
  }).join('');
  document.getElementById('mc-total').textContent=window.fmt(window.calcC(_cTemp));
}

window.chgC=(id,delta)=>{const a=_cTemp[id]||0,n=Math.max(0,a+delta);if(n===0)delete _cTemp[id];else _cTemp[id]=n;renderCProdos();};

window.salvarConsumo=()=>{
  const sab=(window.db.sabados||[]).find(s=>s.id===(window._sabId||_sabId));
  const part=sab?.participantes?.find(p=>p.mensalistaId==_consMid);
  if(part){
    part.consumosAdmin = Object.assign({}, _cTemp);
    const merged = Object.assign({}, part.consumosAdmin);
    Object.entries(part.consumosMember || {}).forEach(([k,v]) => { merged[k] = (merged[k]||0) + v; });
    part.consumos = merged;
    window.save();
  }
  window.closeModal('m-consumo');renderSabDet();renderConsumoRapido();
};

// ═══════════════════════════════════════════
// CONSUMO RÁPIDO
// ═══════════════════════════════════════════
function renderConsumoRapido(){
  const sab=(window.db.sabados||[]).find(s=>s.ativo);
  const empty=document.getElementById('consumo-empty');
  const hdr=document.getElementById('consumo-header-info');
  const listaTodos=document.getElementById('lista-todos-mensalistas');

  if(sab){
    // Sábado ativo: mostrar participantes com consumo rápido
    empty.style.display='none';
    listaTodos.style.display='none';
    document.getElementById('lista-consumo-rapido').style.display='block';
    document.getElementById('search-consumo').style.display='block';
    const tc=(sab.participantes||[]).reduce((s,p)=>s+window.calcC(p.consumos),0);
    hdr.innerHTML=`<div style="background:var(--blue-bg);border:1px solid var(--blue-light);border-radius:var(--radius);padding:10px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:12px;color:var(--blue);font-weight:600">📅 SÁBADO ATIVO</div><div style="font-size:13px;color:var(--text2)">${window.fmtD(sab.data)} · ${(sab.participantes||[]).length} participantes</div></div><span style="font-size:15px;font-weight:700;color:var(--green-mid)">${window.fmt(tc)}</span></div>`;
    _sabId=sab.id; window._sabId=sab.id;
    filtrarConsumo();
  } else {
    // Sem sábado ativo: mostrar todos os mensalistas com histórico
    empty.style.display='block';
    document.getElementById('lista-consumo-rapido').innerHTML='';
    hdr.innerHTML='';
    listaTodos.style.display='block';
    renderTodosMensalistas();
  }
}


// ═══════════════════════════════════════════
// PAGAMENTO BAR — Recebimento com abatimento por sábado
// ═══════════════════════════════════════════
window.abrirPagBarMensalista = function(mid) {
  const m = (window.db.mensalistas||[]).find(x=>x.id==mid);
  if(!m) return;

  // Sábados com saldo em aberto, do mais antigo ao mais recente
  const sabsAbertos = (window.db.sabados||[])
    .filter(s => {
      const p = s.participantes?.find(x=>x.mensalistaId==mid);
      if(!p) return false;
      return window.saldoP(p) > 0;
    })
    .sort((a,b) => a.data.localeCompare(b.data));

  const totalAberto = sabsAbertos.reduce((s,sab)=>{
    const p = sab.participantes?.find(x=>x.mensalistaId==mid);
    return s + window.saldoP(p);
  }, 0);

  const overlay = document.createElement('div');
  overlay.id = 'pag-bar-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end';

  let detalheHtml = sabsAbertos.map(sab=>{
    const p = sab.participantes?.find(x=>x.mensalistaId==mid);
    const sd = window.saldoP(p);
    return `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);padding:3px 0">
      <span>📅 ${window.fmtD(sab.data)}</span>
      <span style="color:var(--red);font-weight:600">${window.fmt(sd)}</span>
    </div>`;
  }).join('');

  overlay.innerHTML = `<div style="background:#fff;border-radius:20px 20px 0 0;width:100%;padding:20px;max-height:85vh;overflow-y:auto">
    <div style="font-size:16px;font-weight:800;margin-bottom:4px">💵 Registrar Recebimento</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:12px">${m.nome}</div>

    <div style="background:var(--bg2);border-radius:var(--radius);padding:10px 12px;margin-bottom:14px">
      <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:6px">SÁBADOS EM ABERTO</div>
      ${detalheHtml}
      <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;display:flex;justify-content:space-between;font-weight:700;font-size:13px">
        <span>Total em aberto</span>
        <span style="color:var(--red)">${window.fmt(totalAberto)}</span>
      </div>
    </div>

    <div class="form-group"><label class="form-label">Valor recebido (R$)</label>
      <input class="form-input" type="tel" id="pbm-valor" inputmode="numeric"
        oninput="maskMoeda(this)"
        value="${Number(totalAberto).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}">
    </div>
    <div class="form-group"><label class="form-label">Método</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap" id="pbm-metodos">
        <button class="tag active" onclick="this.parentNode.querySelectorAll('.tag').forEach(b=>b.classList.remove('active'));this.classList.add('active')">PIX</button>
        <button class="tag" onclick="this.parentNode.querySelectorAll('.tag').forEach(b=>b.classList.remove('active'));this.classList.add('active')">Dinheiro</button>
        <button class="tag" onclick="this.parentNode.querySelectorAll('.tag').forEach(b=>b.classList.remove('active'));this.classList.add('active')">Débito</button>
        <button class="tag" onclick="this.parentNode.querySelectorAll('.tag').forEach(b=>b.classList.remove('active'));this.classList.add('active')">Crédito</button>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Observação (opcional)</label>
      <input class="form-input" type="text" id="pbm-obs" placeholder="Referência, mês...">
    </div>
    <button class="btn btn-primary" onclick="confirmarPagBarMensalista('${mid}')">✅ Confirmar recebimento</button>
    <button class="btn btn-secondary" onclick="document.getElementById('pag-bar-overlay').remove()" style="margin-top:8px">Cancelar</button>
  </div>`;

  overlay.onclick = (e) => { if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
};

window.confirmarPagBarMensalista = function(mid) {
  const valor  = window.parseMoeda(document.getElementById('pbm-valor'));
  const metodo = document.querySelector('#pbm-metodos .tag.active')?.textContent || 'PIX';
  const obs    = document.getElementById('pbm-obs')?.value?.trim() || '';

  if(!valor || valor <= 0) return alert('Informe o valor recebido.');

  // Abater nos sábados do mais antigo ao mais recente
  const sabsAbertos = (window.db.sabados||[])
    .filter(s => {
      const p = s.participantes?.find(x=>x.mensalistaId==mid);
      return p && window.saldoP(p) > 0;
    })
    .sort((a,b) => a.data.localeCompare(b.data));

  let restante = valor;

  sabsAbertos.forEach(sab => {
    if(restante <= 0) return;
    const part = sab.participantes?.find(p=>p.mensalistaId==mid);
    if(!part) return;
    const sd = window.saldoP(part);
    const pagando = Math.min(restante, sd);
    restante -= pagando;
    if(!part.pagamentos) part.pagamentos = [];
    part.pagamentos.push({
      valor: pagando,
      metodo,
      data: window.dataLocal(),
      obs: obs || '',
      id: 'p' + Date.now() + Math.random().toString(36).slice(2),
    });
  });

  // Se sobrou crédito — registrar no último sábado com valor negativo (crédito)
  if(restante > 0 && sabsAbertos.length > 0) {
    const ultimoSab = sabsAbertos[sabsAbertos.length - 1];
    const part = ultimoSab.participantes?.find(p=>p.mensalistaId==mid);
    if(part) {
      if(!part.pagamentos) part.pagamentos = [];
      part.pagamentos.push({
        valor: restante, metodo, data: window.dataLocal(),
        obs: 'Crédito a favor', id: 'p' + Date.now() + 'c',
      });
    }
  }

  window.save();
  document.getElementById('pag-bar-overlay')?.remove();

  // Toast
  const _t = document.createElement('div');
  _t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#065f46;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;z-index:9999;white-space:nowrap';
  _t.textContent = `✅ ${window.fmt(valor)} recebido e abatido!`;
  document.body.appendChild(_t);
  setTimeout(() => _t.remove(), 2500);

  window.renderHist();
};

function renderTodosMensalistas(){
  const sorted=[...(window.db.mensalistas||[])].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const el=document.getElementById('lista-todos-mensalistas');
  el.innerHTML=`<div class="s-title">👥 ${sorted.length} Mensalistas</div>` + sorted.map(m=>{
    let td=0,tp=0;
    (window.db.sabados||[]).forEach(s=>{const p=s.participantes?.find(x=>x.mensalistaId==m.id);if(p){td+=window.calcC(p.consumos);tp+=window.totPago(p);}});
    const net=td-tp;
    const st=td===0?'zero':tp>=td?'pago':tp>0?'parcial':'aberto';
    const badge={zero:'',pago:`<span class="badge badge-pago">Em dia ✓</span>`,parcial:`<span class="badge badge-parcial">${window.fmt(net)}</span>`,aberto:`<span class="badge badge-aberto">${window.fmt(net)}</span>`}[st];
    // Verificar inadimplência > 30 dias
    const hoje=new Date();
    let inadimplente30=false;
    Object.entries(window.db.vencimentos||{}).forEach(([mk,venc])=>{
      const diffDias=(hoje-new Date(venc+'T12:00:00'))/(1000*60*60*24);
      if(diffDias>30){
        const sabsMk=(window.db.sabados||[]).filter(s=>window.mk(s.data)===mk);
        let tcMk=0,pgMk=0;
        sabsMk.forEach(s=>{const p=s.participantes?.find(x=>x.mensalistaId==m.id);if(p){tcMk+=window.calcC(p.consumos);pgMk+=window.totPago(p);}});
        if(tcMk-pgMk>0)inadimplente30=true;
      }
    });
    const badgeInad=inadimplente30?`<span style="background:var(--red-light);color:var(--red);padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;margin-left:4px">+30d</span>`:'';
    return `<div class="card" style="margin-bottom:7px;padding:10px 12px;${inadimplente30?'border-left:3px solid var(--red)':''}">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="avatar" style="${inadimplente30?'background:var(--red-light);color:var(--red)':''}">${m.iniciais}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600">${m.nome}${badgeInad}</div>
          ${m.code?`<div style="font-size:11px;color:var(--text2)">🔑 ${m.code}</div>`:
          `<div style="font-size:11px;color:var(--text3)">Sem código de acesso</div>`}
        </div>
        ${badge}
        <button class="btn-icon" onclick="openHistorico('${m.id}')" title="Ver histórico">📋</button>
      </div>
    </div>`;
  }).join('');
}

window.filtrarConsumo=()=>{
  const sab=(window.db.sabados||[]).find(s=>s.ativo);if(!sab)return;
  const q=(document.getElementById('search-consumo').value||'').toLowerCase().trim();
  const sorted=[...(sab.participantes||[])].sort((a,b)=>{const na=(window.db.mensalistas||[]).find(m=>m.id===a.mensalistaId)?.nome||'';const nb=(window.db.mensalistas||[]).find(m=>m.id===b.mensalistaId)?.nome||'';return na.localeCompare(nb,'pt-BR');});
  const filtered=q?sorted.filter(p=>{const m=(window.db.mensalistas||[]).find(x=>x.id===p.mensalistaId);return m&&m.nome.toLowerCase().includes(q);}):sorted;
  document.getElementById('lista-consumo-rapido').innerHTML=filtered.map(part=>{
    const m=(window.db.mensalistas||[]).find(x=>x.id===part.mensalistaId)||{nome:'?',iniciais:'?'};
    const tc=window.calcC(part.consumos);
    const tags=Object.entries(part.consumos||{}).filter(([,q])=>q>0).map(([id,q])=>{const p=window.gProd(id);return `<span class="cp-tag">${p.icon} ${p.nome} x${q}${p.promo&&q>=p.promo.qtd?' 🏷️':''}</span>`;}).join('');
    return `<div class="cp-row"><div class="cp-header"><div class="avatar">${m.iniciais}</div><div class="cp-name">${m.nome}</div><div class="cp-total">${tc>0?window.fmt(tc):'—'}</div></div>${tags?`<div class="cp-tags" style="margin-top:6px">${tags}</div>`:''}<div class="cp-actions"><button class="btn btn-primary btn-xs" style="flex:1" onclick="abrirConsumoR(${part.mensalistaId})">✏️ ${tc>0?'Alterar':'Incluir'}</button></div></div>`;
  }).join('');
};

window.abrirConsumoR=(mid)=>{window.abrirConsumo(mid);};

// ═══════════════════════════════════════════
// PAGAMENTO
// ═══════════════════════════════════════════
window.abrirPag=(sabId,mid)=>{
  const sab=(window.db.sabados||[]).find(s=>s.id===sabId);
  const part=sab?.participantes?.find(p=>p.mensalistaId===mid);
  const m=(window.db.mensalistas||[]).find(x=>x.id===mid);
  _payPart={sabId,mid};
  const tc=window.calcC(part.consumos),pg=window.totPago(part),sd=window.saldoP(part);
  document.getElementById('mp-title').textContent='Pagamento — '+m.nome;
  document.getElementById('mp-resumo').innerHTML=`<b>${m.nome}</b><br>Consumiu: ${window.fmt(tc)}<br>Pago: ${window.fmt(pg)}<br><b>Saldo: ${window.fmt(sd)}</b>`;
  document.getElementById('mp-valor').value=sd.toFixed(2);
  document.getElementById('mp-data').value=new Date().toISOString().split('T')[0];
  document.getElementById('mp-obs').value='';
  _metodo='';document.querySelectorAll('.method-btn').forEach(b=>b.classList.remove('selected'));
  window.showModal('m-pag');
};

window.selMetodo=(btn,m)=>{_metodo=m;document.querySelectorAll('.method-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');};

window.confirmarPag=()=>{
  if(!_payPart)return;
  const valor=parseFloat(document.getElementById('mp-valor').value)||0;
  if(valor<=0){alert('Informe um valor válido');return;}
  if(!_metodo){alert('Selecione a forma de pagamento');return;}
  const sab=(window.db.sabados||[]).find(s=>s.id===_payPart.sabId);
  const part=sab?.participantes?.find(p=>p.mensalistaId===_payPart.mid);
  if(!part.pagamentos)part.pagamentos=[];
  part.pagamentos.push({valor,metodo:_metodo,data:document.getElementById('mp-data').value,obs:document.getElementById('mp-obs').value});
  window.save();window.closeModal('m-pag');renderSabDet();
};

// ═══════════════════════════════════════════
// WPP COBRANÇA
// ═══════════════════════════════════════════
window.abrirWpp=(sabId,mid)=>{
  const sab=(window.db.sabados||[]).find(s=>s.id===sabId);
  const mes=window.mk(sab.data);
  const m=(window.db.mensalistas||[]).find(x=>x.id===mid);
  const sabsMes=(window.db.sabados||[]).filter(s=>window.mk(s.data)===mes).sort((a,b)=>a.data.localeCompare(b.data));
  let totalMes=0;
  const linhas=sabsMes.map(s=>{const p=s.participantes?.find(x=>x.mensalistaId===mid);if(!p)return null;const tc=window.calcC(p.consumos);totalMes+=tc;return `  📅 ${window.fmtD(s.data)} — ${window.fmt(tc)}`;}).filter(Boolean).join('\n');
  const sAnt=window.saldoAnt(mid,mes);
  const tPagoMes=sabsMes.reduce((s,s2)=>{const p=s2.participantes?.find(x=>x.mensalistaId===mid);return s+(p?window.totPago(p):0);},0);
  const totalDever=totalMes+Math.max(0,sAnt)-tPagoMes;
  const appUrl='' + window.location.origin + '';
  const msg=`Olá, ${m.nome}! 😊\n\nFechamento de *${window.fmtM(mes+'-01')}*\n\n📋 *Consumos por sábado:*\n${linhas||'  Sem consumos'}\n\n💰 *Total do mês:* ${window.fmt(totalMes)}${sAnt>0?`\n⏮ *Saldo anterior:* ${window.fmt(sAnt)}`:sAnt<0?`\n💚 *Crédito anterior:* −${window.fmt(Math.abs(sAnt))}`:''}${tPagoMes>0?`\n✅ *Já pago:* ${window.fmt(tPagoMes)}`:''}\n⚠️ *Total a pagar:* ${window.fmt(Math.max(0,totalDever))}\n\n✅ PIX  ✅ Cartão  ✅ Dinheiro\n🔑 *PIX:* ${window.db.config?.pix||'—'}\n\n📱 Seu extrato: ${appUrl}\n🔑 Código: ${m.code||'solicite ao admin'}\n\n🏟️ CremeFC`;
  document.getElementById('mw-title').textContent='Cobrança — '+m.nome;
  document.getElementById('mw-msg').textContent=msg;
  _payPart={mid,m};window.showModal('m-wpp');
};

window.enviarWpp=()=>{
  const msg=document.getElementById('mw-msg').textContent;
  const tel=_payPart?.m?.tel||'';
  window.open(tel?`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`:`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
};

// ═══════════════════════════════════════════
// HISTÓRICO ADMIN
// ═══════════════════════════════════════════
window.renderHist = function renderHist(){
  const mid=_histMid;
  const m=(window.db.mensalistas||[]).find(x=>x.id==mid);if(!m)return;
  document.getElementById('hdr-sub').innerHTML=m.nome+'<span class="sync-dot" id="sync-dot"></span>';

  // ── Totais gerais ──
  let tdTotal=0, tpTotal=0;
  (window.db.sabados||[]).forEach(s=>{
    const p=s.participantes?.find(x=>x.mensalistaId==mid);
    if(p){tdTotal+=window.calcC(p.consumos);tpTotal+=window.totPago(p);}
  });
  const emAberto=Math.max(0,tdTotal-tpTotal);

  let html=`
    <!-- TOTAIS GERAIS -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
      <div class="card" style="padding:10px;text-align:center">
        <div style="font-size:10px;color:var(--text2);margin-bottom:2px">Total gasto</div>
        <div style="font-size:15px;font-weight:800;color:var(--red)">${window.fmt(tdTotal)}</div>
      </div>
      <div class="card" style="padding:10px;text-align:center">
        <div style="font-size:10px;color:var(--text2);margin-bottom:2px">Total pago</div>
        <div style="font-size:15px;font-weight:800;color:var(--green-mid)">${window.fmt(tpTotal)}</div>
      </div>
      <div class="card" style="padding:10px;text-align:center">
        <div style="font-size:10px;color:var(--text2);margin-bottom:2px">Em aberto</div>
        <div style="font-size:15px;font-weight:800;color:${emAberto>0?'var(--amber)':'var(--green-mid)'}">${window.fmt(emAberto)}</div>
      </div>
    </div>
    ${emAberto>0?`<button class="btn btn-primary" onclick="abrirPagBarMensalista('${mid}')" style="width:100%;margin-bottom:14px;padding:11px">💵 Registrar recebimento</button>`:''}`;

  // ── Histórico por mês ──
  const meses={};
  (window.db.sabados||[]).forEach(sab=>{
    const mk=window.mk(sab.data);
    const part=sab.participantes?.find(p=>p.mensalistaId==mid);
    if(!part)return;
    if(!meses[mk])meses[mk]={sabs:[],pags:[]};
    meses[mk].sabs.push({sab,part});
    meses[mk].pags.push(...(part.pagamentos||[]));
  });

  html+=`<div class="s-title">📅 Histórico por mês</div>`;
  Object.keys(meses).sort().reverse().forEach(mk=>{
    const d=meses[mk];
    const cm=d.sabs.reduce((s,{part})=>s+window.calcC(part.consumos),0);
    const pm=d.pags.reduce((s,p)=>s+p.valor,0);
    const sm=cm-pm;
    const st=pm>=cm&&cm>0?'pago':pm>0?'parcial':'aberto';
    const rs=d.sabs.sort((a,b)=>a.sab.data.localeCompare(b.sab.data))
      .map(({sab,part})=>`<div class="extrato-row">
        <span style="color:var(--text2)">${window.fmtD(sab.data)}</span>
        <span style="font-weight:700;color:var(--red)">${window.fmt(window.calcC(part.consumos))}</span>
      </div>`).join('');
    const rp=d.pags.map(p=>`<div class="extrato-row">
      <span style="color:var(--text2)">✅ ${p.metodo||'Pago'}${p.obs?' · '+p.obs:''}</span>
      <span style="font-weight:700;color:var(--green-mid)">-${window.fmt(p.valor)}</span>
    </div>`).join('');
    html+=`<div class="card" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:15px;font-weight:700">${window.fmtM(mk)}</div>
        <span class="badge badge-${st==='pago'?'pago':st==='parcial'?'parcial':'aberto'}">${st==='pago'?'Pago ✓':st==='parcial'?'Parcial':'Em aberto'}</span>
      </div>
      ${rs}${rp}
      <div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:13px">
        <span style="font-weight:600">Saldo do mês</span>
        <span style="font-weight:700;color:${sm>0?'var(--amber)':sm<0?'var(--green-mid)':'var(--text2)'}">
          ${sm>0?window.fmt(sm):sm<0?'Crédito '+window.fmt(Math.abs(sm)):'Zerado'}
        </span>
      </div>
    </div>`;
  });

  if(!Object.keys(meses).length) html+='<div style="text-align:center;padding:30px;color:var(--text2)">Nenhum consumo registrado</div>';
  document.getElementById('sc-historico-body').innerHTML=html;
}

// ═══════════════════════════════════════════
// RELATÓRIO
// ═══════════════════════════════════════════