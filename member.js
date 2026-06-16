// ═══════════════════════════════════════════════════
// member.js — Visão e interações do mensalista logado
// ═══════════════════════════════════════════════════
'use strict';

window.renderMemberView = ()=>{
  const mid=window._memberId;
  const m=(window.db.mensalistas||[]).find(x=>x.id===mid);if(!m)return;

  // Calcular totais gerais
  let totalGasto=0,totalPago=0,totalSabados=0;
  (window.db.sabados||[]).forEach(s=>{
    const p=s.participantes?.find(x=>x.mensalistaId===mid);
    if(p){totalGasto+=window.calcC(p.consumos);totalPago+=window.totPago(p);totalSabados++;}
  });
  const totalAberto=Math.max(0,totalGasto-totalPago);
  const credito=totalPago>totalGasto?totalPago-totalGasto:0;

  // Hero card com painel completo
  document.getElementById('member-hero-card').innerHTML=`
    <div class="member-hero" style="padding:18px 16px 16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0">
          ${m.iniciais||m.nome.slice(0,2).toUpperCase()}
        </div>
        <div>
          <div class="member-name" style="margin-bottom:2px">${m.nome}</div>
          <div class="member-code">🔑 ${m.code||'—'} · ${totalSabados} sábado(s)</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div style="background:rgba(255,255,255,.12);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:9px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Total gasto</div>
          <div style="font-size:15px;font-weight:800;color:#fff">${window.fmt(totalGasto)}</div>
        </div>
        <div style="background:rgba(134,239,172,.2);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:9px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Total pago</div>
          <div style="font-size:15px;font-weight:800;color:#86efac">${window.fmt(totalPago)}</div>
        </div>
        <div style="background:${totalAberto>0?'rgba(252,165,165,.25)':'rgba(134,239,172,.2)'};border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:9px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${credito>0?'Crédito':'Em aberto'}</div>
          <div style="font-size:15px;font-weight:800;color:${totalAberto>0?'#fca5a5':'#86efac'}">${window.fmt(credito>0?credito:totalAberto)}</div>
        </div>
      </div>
    </div>`;

  // Saldo box — apenas se tiver algo em aberto ou crédito
  const saldoEl=document.getElementById('member-saldo-box');
  if(totalAberto>0){
    saldoEl.innerHTML=`<div class="saldo-box due" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px">
      <div><div class="saldo-label" style="text-align:left;margin-bottom:2px">⚠️ Saldo devedor atual</div>
      <div style="font-size:11px;color:var(--red);opacity:.8">Referente a meses anteriores + mês atual</div></div>
      <div class="saldo-value" style="color:var(--red);font-size:24px">${window.fmt(totalAberto)}</div>
    </div>`;
  } else if(credito>0){
    saldoEl.innerHTML=`<div class="saldo-box credit" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px">
      <div><div class="saldo-label" style="text-align:left;margin-bottom:2px">💚 Você tem crédito</div></div>
      <div class="saldo-value" style="color:var(--green-mid);font-size:24px">${window.fmt(credito)}</div>
    </div>`;
  } else {
    saldoEl.innerHTML=`<div class="saldo-box ok" style="text-align:center;padding:10px">
      <div style="font-size:13px;font-weight:700;color:var(--green)">✅ Tudo em dia!</div>
    </div>`;
  }

  renderMemberSabados(mid);
};


// ═══════════════════════════════════════════
// ABA SÁBADOS DO MENSALISTA
// ═══════════════════════════════════════════
function renderMemberSabados(mid){
  // Todos os sábados que o mensalista participou, do mais recente ao mais antigo
  const sabsMembro=(window.db.sabados||[])
    .filter(s=>s.participantes?.find(p=>p.mensalistaId===mid))
    .sort((a,b)=>b.data.localeCompare(a.data));

  if(!sabsMembro.length){
    document.getElementById('member-tab-sabados').innerHTML=
      '<div style="text-align:center;padding:30px;color:var(--text2)"><div style="font-size:36px;margin-bottom:8px">📅</div><div>Você ainda não participou de nenhum sábado</div></div>';
    return;
  }

  let html='';
  sabsMembro.forEach(sab=>{
    const part=sab.participantes.find(p=>p.mensalistaId===mid);
    const tc=window.calcC(part.consumos);
    const pg=window.totPago(part);
    const saldo=tc-pg;
    const jaValidou=(sab.validadoPor||[]).some(v=>v==mid);
    const st=pg>=tc&&tc>0?'pago':pg>0?'parcial':tc>0?'aberto':'zero';
    const stLabel={pago:'✅ Pago',parcial:'⚠️ Parcial',aberto:'🔴 Em aberto',zero:'—'}[st];
    const stColor={pago:'var(--green)',parcial:'var(--amber)',aberto:'var(--red)',zero:'var(--text3)'}[st];

    // Itens consumidos
    const itens=Object.entries(part.consumos||{}).filter(([,q])=>q>0).map(([id,q])=>{
      const p=window.gProd(id);
      return `<span class="cp-tag">${p.icon} ${p.nome} x${q}${p.promo&&q>=p.promo.qtd?' 🏷️':''}</span>`;
    }).join('');

    html+=`<div class="card" style="margin-bottom:10px">
      <!-- Header do sábado -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div style="font-size:14px;font-weight:700">📅 ${window.fmtD(sab.data)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">${window.fmtM(sab.data.slice(0,7)+'-01')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:15px;font-weight:700;color:var(--red)">${window.fmt(tc)}</div>
          <div style="font-size:11px;font-weight:600;color:${stColor}">${stLabel}</div>
        </div>
      </div>

      <!-- Itens consumidos -->
      ${itens?`<div class="cp-tags" style="margin-bottom:8px">${itens}</div>`:
        '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">Nenhum consumo registrado</div>'}

      <!-- Pagamentos -->
      ${(part.pagamentos||[]).length?`
        <div style="background:var(--green-light);border-radius:8px;padding:7px 10px;font-size:12px;color:var(--green);margin-bottom:8px">
          ${(part.pagamentos||[]).map(pg=>`✅ Pago ${window.fmt(pg.valor)} (${pg.metodo})`).join(' · ')}
        </div>`:''}

      ${saldo>0?`<div style="background:var(--amber-light);border-radius:8px;padding:7px 10px;font-size:12px;color:var(--amber);font-weight:600;margin-bottom:8px">
        💰 Saldo deste sábado: ${window.fmt(saldo)}</div>`:''}

      <!-- Ações -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button onclick="abrirConsumoMember(${sab.id},${mid})" class="btn btn-primary btn-xs" style="width:auto">+ Incluir consumo</button>
        ${jaValidou
          ?`<button disabled style="width:auto;padding:5px 10px;font-size:12px;font-weight:600;background:var(--bg3);color:var(--text3);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:default">✅ Validado</button>`
          :`<button onclick="validarConsumoMember('${sab.id}','${mid}')" class="btn btn-green btn-xs" style="width:auto">✅ Validar consumo</button>`
        }
      </div>
    </div>`;
  });

  document.getElementById('member-tab-sabados').innerHTML=html;
}

// ═══════════════════════════════════════════
// ABA MÊS DO MENSALISTA
// ═══════════════════════════════════════════
function renderMemberMeses(mid){
  // Agrupar sábados por mês
  const meses={};
  (window.db.sabados||[]).forEach(sab=>{
    const mk=sab.data.slice(0,7);
    const part=sab.participantes?.find(p=>p.mensalistaId===mid);
    if(!part)return;
    if(!meses[mk])meses[mk]={sabs:[],tc:0,pg:0};
    const tc=window.calcC(part.consumos);
    const pg=window.totPago(part);
    meses[mk].sabs.push({sab,part,tc,pg});
    meses[mk].tc+=tc;
    meses[mk].pg+=pg;
  });

  const keys=Object.keys(meses).sort().reverse();
  if(!keys.length){
    document.getElementById('member-tab-mes').innerHTML=
      '<div style="text-align:center;padding:30px;color:var(--text2)">Nenhum consumo registrado</div>';
    return;
  }

  // Seletor de mês
  let selEl=`<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px">
    ${keys.map(mk=>`<button onclick="window._memberMesSel='${mk}';renderMemberMesDetalhe('${mk}',${mid})"
      style="flex-shrink:0;padding:7px 14px;border-radius:20px;border:1.5px solid ${mk===(window._memberMesSel||keys[0])?'var(--blue)':'var(--border)'};
      background:${mk===(window._memberMesSel||keys[0])?'var(--blue)':'var(--bg)'};
      color:${mk===(window._memberMesSel||keys[0])?'#fff':'var(--text2)'};font-size:12px;font-weight:600;cursor:pointer">
      ${window.fmtM(mk+'-01')}
    </button>`).join('')}
  </div>`;

  document.getElementById('member-tab-mes').innerHTML=selEl+'<div id="member-mes-detalhe"></div>';

  // Mostrar o mês selecionado (ou o mais recente)
  if(!window._memberMesSel)window._memberMesSel=keys[0];
  renderMemberMesDetalhe(window._memberMesSel,mid);
}

window.renderMemberMesDetalhe = function renderMemberMesDetalhe(mk,mid){
  const meses={};
  (window.db.sabados||[]).forEach(sab=>{
    const msk=sab.data.slice(0,7);
    const part=sab.participantes?.find(p=>p.mensalistaId===mid);
    if(!part)return;
    if(!meses[msk])meses[msk]={sabs:[],tc:0,pg:0};
    const tc=window.calcC(part.consumos);
    const pg=window.totPago(part);
    meses[msk].sabs.push({sab,part,tc,pg});
    meses[msk].tc+=tc;meses[msk].pg+=pg;
  });

  const dados=meses[mk];
  if(!dados){document.getElementById('member-mes-detalhe').innerHTML='<div style="text-align:center;padding:20px;color:var(--text2)">Nenhum dado</div>';return;}

  const saldo=dados.tc-dados.pg;
  const mesFechado=(window.db.mesesFechados||[]).includes(mk);
  const st=dados.pg>=dados.tc&&dados.tc>0?'pago':dados.pg>0?'parcial':dados.tc>0?'aberto':'zero';

  let html=`
    <!-- Resumo do mês -->
    <div style="background:var(--blue);border-radius:var(--radius);padding:14px 16px;color:#fff;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:16px;font-weight:800">${window.fmtM(mk+'-01')}</div>
        <span style="background:rgba(255,255,255,.2);padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600">
          ${mesFechado?'✅ Mês fechado':st==='pago'?'✅ Pago':st==='parcial'?'⚠️ Parcial':'🔴 Em aberto'}
        </span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:rgba(255,255,255,.1);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.05em">Total do mês</div>
          <div style="font-size:18px;font-weight:700;margin-top:2px">${window.fmt(dados.tc)}</div>
        </div>
        <div style="background:rgba(255,255,255,.1);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.05em">Já pago</div>
          <div style="font-size:18px;font-weight:700;color:#86efac;margin-top:2px">${window.fmt(dados.pg)}</div>
        </div>
      </div>
      ${saldo>0?`<div style="background:rgba(255,200,0,.2);border-radius:8px;padding:10px;text-align:center;margin-top:8px">
        <div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.05em">A pagar</div>
        <div style="font-size:22px;font-weight:900;color:#ffd700;margin-top:2px">${window.fmt(saldo)}</div>
      </div>`:'<div style="background:rgba(134,239,172,.15);border-radius:8px;padding:8px;text-align:center;margin-top:8px;font-size:13px;font-weight:600">✅ Sem pendências neste mês</div>'}
    ${vencMes&&saldo>0?`<div style="background:${vencido?'rgba(252,165,165,.25)':'rgba(255,255,255,.12)'};border-radius:8px;padding:8px 10px;margin-top:8px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:11px;opacity:.8">${vencido?'⚠️ Vencido em':'📅 Vence em'}</span>
      <span style="font-size:13px;font-weight:700;color:${vencido?'#fca5a5':'#ffd700'}">${fmtVenc}</span>
    </div>`:''}
    </div>

    <!-- Sábados do mês -->
    <div class="s-title">📅 Sábados de ${window.fmtM(mk+'-01')}</div>`;

  dados.sabs.sort((a,b)=>a.sab.data.localeCompare(b.sab.data)).forEach(({sab,part,tc,pg})=>{
    const itens=Object.entries(part.consumos||{}).filter(([,q])=>q>0)
      .map(([id,q])=>{const p=window.gProd(id);return `${p.icon}${p.nome}(${q})`;}).join(', ');
    const sd=tc-pg;
    html+=`<div class="card" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:13px;font-weight:600">📅 ${window.fmtD(sab.data)}</div>
          ${itens?`<div style="font-size:11px;color:var(--text2);margin-top:2px">${itens}</div>`:''}
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:700;color:var(--red)">${window.fmt(tc)}</div>
          ${pg>0?`<div style="font-size:11px;color:var(--green-mid)">Pago: ${window.fmt(pg)}</div>`:''}
        </div>
      </div>
      ${sd>0?`<div style="margin-top:6px;font-size:12px;color:var(--amber);font-weight:600">Saldo: ${window.fmt(sd)}</div>`:''}
    </div>`;
  });

  document.getElementById('member-mes-detalhe').innerHTML=html;

  // Atualizar visual dos botões de mês
  document.querySelectorAll('#member-tab-mes button[onclick*="renderMemberMesDetalhe"]').forEach(btn=>{
    const isSel=btn.textContent.trim()===window.fmtM(mk+'-01');
    btn.style.background=isSel?'var(--blue)':'var(--bg)';
    btn.style.color=isSel?'#fff':'var(--text2)';
    btn.style.borderColor=isSel?'var(--blue)':'var(--border)';
  });
}

window.renderMemberMes=(mid)=>{
  const mes=new Date().toISOString().slice(0,7);
  const sabs=(window.db.sabados||[]).filter(s=>s.data.slice(0,7)===mes).sort((a,b)=>a.data.localeCompare(b.data));
  let tm=0,rows='';
  sabs.forEach(sab=>{
    const part=sab.participantes?.find(p=>p.mensalistaId===mid);if(!part)return;
    const tc=window.calcC(part.consumos);tm+=tc;
    const itens=Object.entries(part.consumos||{}).filter(([,q])=>q>0).map(([id,q])=>{const p=window.gProd(id);return `<span class="cp-tag">${p.icon} ${p.nome} x${q}</span>`;}).join('');
    const jaValidou=(sab.validadoPor||[]).some(v=>v==mid);
    const btnValidar=!jaValidou
      ?`<button onclick="validarConsumoMember('${sab.id}','${mid}')" class="btn btn-green" style="margin-top:10px;width:100%;font-size:16px;padding:14px;font-weight:700;border-radius:12px;box-shadow:0 4px 14px rgba(34,197,94,.35);letter-spacing:.3px">✅ Validar meu consumo</button>`
      :`<div style="font-size:13px;color:var(--green-mid);margin-top:8px;font-weight:700;background:var(--green-light);padding:10px 14px;border-radius:10px;text-align:center">✅ Validado</div>`;
    rows+=`<div class="card" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;font-weight:600">📅 ${window.fmtD(sab.data)}</span>
        <span style="font-size:14px;font-weight:700;color:var(--red)">${window.fmt(tc)}</span>
      </div>
      ${itens?`<div class="cp-tags" style="margin-bottom:8px">${itens}</div>`:'<div style="font-size:12px;color:var(--text2);margin-bottom:8px">Nenhum consumo registrado</div>'}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button onclick="abrirConsumoMember(${sab.id},${mid})" class="btn btn-primary btn-xs" style="width:auto">+ Incluir consumo</button>
      </div>
      ${btnValidar}
    </div>`;
  });
  let tp=sabs.reduce((s,sab)=>{const p=sab.participantes?.find(x=>x.mensalistaId===mid);return s+(p?(p.pagamentos||[]).reduce((s2,pg)=>s2+pg.valor,0):0);},0);
  document.getElementById('member-tab-mes').innerHTML=(rows||'<div style="text-align:center;padding:24px;color:var(--text2)">Você não participou de nenhum sábado este mês</div>')+(tm>0?`<div class="card" style="background:var(--bg2)"><div class="rep-row"><span style="color:var(--text2)">Total do mês</span><span style="font-weight:700">${window.fmt(tm)}</span></div><div class="rep-row"><span style="color:var(--text2)">Já pago</span><span style="font-weight:700;color:var(--green-mid)">${window.fmt(tp)}</span></div><div class="rep-row"><span style="font-weight:700">Saldo</span><span style="font-weight:700;color:var(--amber)">${window.fmt(tm-tp)}</span></div></div>`:'');
};

window.abrirConsumoMember=(sabId,mid)=>{
  const sab=(window.db.sabados||[]).find(s=>s.id===sabId);
  if(!sab)return;
  // Garantir que o mensalista está nos participantes
  if(!(sab.participantes||[]).find(p=>p.mensalistaId===mid)){
    if(!sab.participantes)sab.participantes=[];
    sab.participantes.push({mensalistaId:mid,consumos:{},pagamentos:[]});
  }
  window._sabIdMember=sabId;
  const part=sab.participantes.find(p=>p.mensalistaId===mid);
  window._cTempMember=Object.assign({},part.consumos||{});
  window._consumoMemberMid=mid;
  renderConsumoProdutosMember();
  window.showModal('m-consumo-member');
};

function renderConsumoProdutosMember(){
  const sorted=[...(window.db.produtos||[])].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  // Mostrar apenas NOVOS itens (não pode remover os já lançados)
  const sab=(window.db.sabados||[]).find(s=>s.id===window._sabIdMember);
  const part=sab?.participantes?.find(p=>p.mensalistaId===window._consumoMemberMid);
  const jaLancados=Object.assign({},part?.consumos||{});
  document.getElementById('mc-member-produtos').innerHTML=sorted.map(p=>{
    const qtdAtual=window._cTempMember[p.id]||0;
    const qtdBase=jaLancados[p.id]||0;
    const qtdNova=Math.max(0,qtdAtual-qtdBase);
    const promoL=p.promo?`<span class="promo-tag">${p.promo.qtd}x=${window.fmt(p.promo.valor)}</span>`:'';
    return `<div class="prod-row">
      <span style="font-size:22px">${p.icon}</span>
      <div style="flex:1"><div class="prod-name">${p.nome}${promoL}</div><div class="prod-price">${window.fmt(p.preco)}${qtdBase>0?` · <span style="color:var(--text2)">${qtdBase} já lançado(s)</span>`:''}</div></div>
      <div class="counter-ctrl">
        ${qtdNova>0?`<div class="c-btn minus" onclick="chgCMember('${p.id}',-1)">−</div>`:'<div style="width:30px"></div>'}
        <span class="${qtdNova>0?'c-val':'c-val zero'}">${qtdNova>0?qtdNova:'—'}</span>
        <div class="c-btn plus" onclick="chgCMember('${p.id}',1)">+</div>
      </div>
    </div>`;
  }).join('');
  // Total apenas dos novos
  const novoTotal=Object.entries(window._cTempMember).reduce((s,[id,q])=>{
    const base=jaLancados[id]||0;
    const nova=Math.max(0,q-base);
    if(nova<=0)return s;
    const p=window.gProd(id);
    if(p.promo&&nova>=p.promo.qtd){const b=Math.floor(nova/p.promo.qtd),r=nova%p.promo.qtd;return s+b*p.promo.valor+r*p.preco;}
    return s+nova*p.preco;
  },0);
  document.getElementById('mc-member-total').textContent=window.fmt(novoTotal);
}

window.chgCMember=(id,delta)=>{
  const sab=(window.db.sabados||[]).find(s=>s.id===window._sabIdMember);
  const part=sab?.participantes?.find(p=>p.mensalistaId===window._consumoMemberMid);
  const base=(part?.consumos||{})[id]||0;
  const atual=window._cTempMember[id]||0;
  const novo=Math.max(base,atual+delta); // Não pode ir abaixo do base
  if(novo===0)delete window._cTempMember[id];else window._cTempMember[id]=novo;
  renderConsumoProdutosMember();
};

window.salvarConsumoMember=async()=>{
  const sab=(window.db.sabados||[]).find(s=>s.id===window._sabIdMember);
  const part=sab?.participantes?.find(p=>p.mensalistaId===window._consumoMemberMid);
  if(!part)return;
  // Salvar separado em consumosMember (não sobrescreve consumosAdmin)
  part.consumosMember = Object.assign({}, window._cTempMember);
  // Reconsolidar consumos totais
  const merged = Object.assign({}, part.consumosAdmin || {});
  Object.entries(part.consumosMember || {}).forEach(([k,v]) => {
    merged[k] = (merged[k] || 0) + v;
  });
  part.consumos = merged;
  // Salvar local sempre
  window.saveLocal();
  // Tentar salvar no Firestore via coleção de consumos do membro
  // (regra: allow write: if request.auth != null)
  try {
    const key = `consumo_${window._sabIdMember}_${window._consumoMemberMid}`;
    await setDoc(doc(fdb,'validacoes',key),{
      tipo:'consumo',
      sabId: window._sabIdMember,
      mid: window._consumoMemberMid,
      consumos: window._cTempMember,
      ts: new Date().toISOString()
    });
    setSyncDot('ok');
  } catch(e){
    setSyncDot('error');
    console.log('Erro ao salvar consumo membro:',e);
  }
  window.closeModal('m-consumo-member');

  const mid=window._consumoMemberMid;

  // 1. Recalcular e atualizar saldo no topo
  let td=0,tp=0;
  (window.db.sabados||[]).forEach(s=>{
    const p=s.participantes?.find(x=>x.mensalistaId===mid);
    if(p){td+=window.calcC(p.consumos);tp+=window.totPago(p);}
  });
  const net=td-tp;
  const cls=net>0?'due':net<0?'credit':'ok';
  const lbl=net>0?'⚠️ Saldo devedor':net<0?'💚 Crédito':'✅ Em dia';
  const saldoEl=document.getElementById('member-saldo-box');
  if(saldoEl){
    saldoEl.innerHTML=`<div class="saldo-box ${cls}">
      <div class="saldo-label">${lbl}</div>
      <div class="saldo-value" style="color:${net>0?'var(--red)':'var(--green-mid)'}">
        ${window.fmt(Math.abs(net))}
      </div>
    </div>`;
  }

  // 2. Rerenderizar a aba ativa
  const tabAtiva=document.querySelector('#sc-member-home .tab-btn.active');
  if(tabAtiva){
    const txt=tabAtiva.textContent;
    if(txt.includes('Sábados'))renderMemberSabados(mid);
    else if(txt.includes('Mês'))renderMemberMeses(mid);
    else window.renderMemberHist(mid);
  } else {
    renderMemberSabados(mid);
  }
};

window.validarConsumoMember=async(sabId,mid)=>{
  const sab=(window.db.sabados||[]).find(s=>s.id===sabId);
  if(!sab)return;
  // Não faz nada se já validou
  const midNM = isNaN(mid) ? mid : Number(mid);
  if((sab.validadoPor||[]).some(v=>v==mid||v==midNM))return;
  if(!sab.validadoPor)sab.validadoPor=[];
  sab.validadoPor.push(midNM);
  // Salvar localmente
  window.saveLocal();
  setSyncDot('syncing');
  try {
    // Salvar na coleção 'validacoes' — mensalista tem permissão aqui
    const {doc, setDoc} = window._firebase;
    await setDoc(doc(fdb,'validacoes',String(mid)+'_'+String(sabId)),{
      mid, sabId, validado:true, ts:new Date().toISOString()
    });
    // Atualizar também o doc principal via merge (merge não sobrescreve outros campos)
    const {setDoc:sd} = window._firebase;
    await sd(doc(fdb,'club','data'),{
      sabados: window.db.sabados,
      updatedAt: new Date().toISOString()
    },{merge:true});
    setSyncDot('ok');
  } catch(e){
    console.log('Validação Firestore erro:', e.code, e.message);
    setSyncDot('error');
    // Mesmo com erro no Firestore, manter local
  }
  // Atualizar UI
  const tabAtiva=document.querySelector('#sc-member-home .tab-btn.active');
  if(tabAtiva){
    const txt=tabAtiva.textContent;
    if(txt.includes('Sábados'))renderMemberSabados(mid);
    else if(txt.includes('Mês'))renderMemberMeses(mid);
    else window.renderMemberHist(mid);
  }
};

window.showMemberTab=(tab,btn)=>{
  document.querySelectorAll('#sc-member-home .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('member-tab-sabados').style.display=tab==='sabados'?'block':'none';
  document.getElementById('member-tab-mes').style.display=tab==='mes'?'block':'none';
  document.getElementById('member-tab-historico').style.display=tab==='historico'?'block':'none';
  if(tab==='sabados')renderMemberSabados(window._memberId);
  if(tab==='mes')renderMemberMeses(window._memberId);
  if(tab==='historico')window.renderMemberHist(window._memberId);
};

window.renderMemberHist=(mid)=>{
  const meses={};
  (window.db.sabados||[]).forEach(sab=>{const mk=sab.data.slice(0,7);const part=sab.participantes?.find(p=>p.mensalistaId===mid);if(!part)return;if(!meses[mk])meses[mk]={sabs:[],pags:[]};meses[mk].sabs.push({sab,part});meses[mk].pags.push(...(part.pagamentos||[]));});
  let html='';
  Object.keys(meses).sort().reverse().forEach(mk=>{
    const d=meses[mk];const cm=d.sabs.reduce((s,{part})=>s+window.calcC(part.consumos),0);const pm=d.pags.reduce((s,p)=>s+p.valor,0);const sm=cm-pm;
    const st=pm>=cm&&cm>0?'pago':pm>0?'parcial':'aberto';
    const rs=d.sabs.sort((a,b)=>a.sab.data.localeCompare(b.sab.data)).map(({sab,part})=>`<div class="extrato-row"><span style="color:var(--text2)">${window.fmtD(sab.data)}</span><span style="font-weight:700;color:var(--red)">${window.fmt(window.calcC(part.consumos))}</span></div>`).join('');
    const rp=d.pags.map(p=>`<div class="extrato-row"><span style="color:var(--text2)">✅ Pago (${p.metodo})</span><span style="font-weight:700;color:var(--green-mid)">−${window.fmt(p.valor)}</span></div>`).join('');
    html+=`<div class="card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;margin-bottom:10px"><div style="font-size:15px;font-weight:700">${window.fmtM(mk+'-01')}</div><span class="badge badge-${st==='pago'?'pago':st==='parcial'?'parcial':'aberto'}">${st==='pago'?'Pago ✓':st==='parcial'?'Parcial':'Em aberto'}</span></div>${rs}${rp}<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:13px"><span style="font-weight:600">Saldo</span><span style="font-weight:700;color:${sm>0?'var(--amber)':sm<0?'var(--green-mid)':'var(--text2)'}">${sm>0?window.fmt(sm):sm<0?'Crédito '+window.fmt(Math.abs(sm)):'Zerado'}</span></div></div>`;
  });
  document.getElementById('member-tab-historico').innerHTML=html||'<div style="text-align:center;padding:30px;color:var(--text2)">Nenhum histórico</div>';
};

// Code share
window.mostrarCodigo=(mid)=>{
  const m=(window.db.mensalistas||[]).find(x=>x.id===mid);if(!m||!m.code)return;
  document.getElementById('mcs-title').textContent='Código de '+m.nome;
  document.getElementById('mcs-name').textContent=m.nome;
  document.getElementById('mcs-code').textContent=m.code;
  const url='' + window.location.origin + '';
  const msg=`Olá, ${m.nome}! 👋

Seu acesso ao app do *CremeFC* está pronto! 🍺⚽

📱 *Acesse o app:*
' + window.location.origin + '

🔑 *Seu código de acesso:* ${m.code}

*Como instalar no celular:*
• *Android:* toque em "Instalar" quando aparecer
• *iPhone:* toque em Compartilhar ↗️ → "Adicionar à Tela de Início"

Depois abra o app, toque em *Mensalista* e digite seu código para ver seus consumos e saldo. 😊

🏟️ CremeFC`;
  document.getElementById('mcs-preview').textContent=msg;
  document.getElementById('mcs-preview').style.display='block';
  window._shareM={m,msg};
  window.showModal('m-code-share');
};

window.enviarCodigoWpp=()=>{
  const {m,msg}=window._shareM||{};
  const tel=m?.tel||'';
  window.open(tel?`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`:`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
};

window.switchLoginTab=(tab,btn)=>{
  document.querySelectorAll('.login-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.login-form').forEach(f=>f.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('form-'+tab).classList.add('active');
};
