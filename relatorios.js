// ═══════════════════════════════════════════════════
// relatorios.js — Relatórios do bar
// ═══════════════════════════════════════════════════
'use strict';

window.showRelTab=(tab,btn)=>{
  document.querySelectorAll('#sc-relatorio .tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ['geral','mensal','ranking','mensalistas','produtos'].forEach(t=>document.getElementById('rel-'+t).style.display=t===tab?'block':'none');
  if(tab==='geral')renderRelGeral();
  else if(tab==='mensal')renderRelMensal();
  else if(tab==='ranking')renderRelRanking();
  else if(tab==='mensalistas')renderRelMens();
  else if(tab==='produtos')renderRelProds();
};

window.renderRelMensal = function renderRelMensal(){
  const el=document.getElementById('rel-mensal');
  // Selector de mês
  const meses=[...new Set((window.db.sabados||[]).map(s=>window.mk(s.data)))].sort().reverse();
  if(!meses.length){el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text2)">Nenhum sábado registrado</div>';return;}
  if(!window._relMes) window._relMes=meses[0];
  const mk=window._relMes;
  const sabs=(window.db.sabados||[]).filter(s=>window.mk(s.data)===mk).sort((a,b)=>a.data.localeCompare(b.data));
  // Calcular totais
  let totalCons=0,totalPg=0,custot=0;
  const contagens={};
  const porMens=[];
  (window.db.mensalistas||[]).forEach(m=>{
    let tc=0,pg=0;
    sabs.forEach(s=>{
      const p=s.participantes?.find(x=>x.mensalistaId===m.id);
      if(p){
        tc+=window.calcC(p.consumos);pg+=window.totPago(p);
        custot+=window.calcCusto(p.consumos);
        Object.entries(p.consumos||{}).forEach(([id,q])=>{contagens[id]=(contagens[id]||0)+q;});
      }
    });
    if(tc>0) porMens.push({m,tc,pg,saldo:tc-pg});
  });
  totalCons=porMens.reduce((s,x)=>s+x.tc,0);
  totalPg=porMens.reduce((s,x)=>s+x.pg,0);
  const lucroReal=totalPg-custot*(totalPg/Math.max(totalCons,1));
  const lucroPrevisao=totalCons-custot;
  const devedores=porMens.filter(x=>x.saldo>0).sort((a,b)=>b.saldo-a.saldo);
  const topProds=Object.entries(contagens).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const mesFechado=(window.db.mesesFechados||[]).includes(mk);

  el.innerHTML=`
    <!-- Seletor de mês -->
    <div style="display:flex;gap:8px;margin-bottom:14px;overflow-x:auto;padding-bottom:4px">
      ${meses.map(m=>`<button onclick="window._relMes='${m}';renderRelMensal()" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:1.5px solid ${m===mk?'var(--blue)':'var(--border)'};background:${m===mk?'var(--blue)':'var(--bg)'};color:${m===mk?'#fff':'var(--text2)'};font-size:12px;font-weight:600;cursor:pointer">${window.fmtM(m+'-01')}</button>`).join('')}
    </div>

    <!-- Status do mês -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:16px;font-weight:800">${window.fmtM(mk+'-01')}</div>
      <span class="badge ${mesFechado?'badge-pago':'badge-ativo'}">${mesFechado?'✅ Fechado':'Em aberto'}</span>
    </div>

    <!-- Métricas -->
    <div class="metric-grid">
      <div class="metric-card"><div class="m-label">Consumido</div><div class="m-val blue" style="font-size:16px">${window.fmt(totalCons)}</div></div>
      <div class="metric-card"><div class="m-label">Recebido</div><div class="m-val green" style="font-size:16px">${window.fmt(totalPg)}</div></div>
      <div class="metric-card"><div class="m-label">Previsão Lucro</div><div class="m-val amber" style="font-size:16px">${window.fmt(lucroPrevisao)}</div></div>
      <div class="metric-card"><div class="m-label">Lucro Real</div><div class="m-val green" style="font-size:16px">${window.fmt(Math.max(0,lucroReal))}</div></div>
    </div>

    <!-- Sábados do mês -->
    <div class="s-title">📅 Sábados (${sabs.length})</div>
    <div class="card">
      ${sabs.map(s=>{
        const tc=(s.participantes||[]).reduce((sum,p)=>sum+window.calcC(p.consumos),0);
        const pg=(s.participantes||[]).reduce((sum,p)=>sum+window.totPago(p),0);
        return `<div class="rep-row"><span style="color:var(--text2)">${window.fmtD(s.data)} · ${(s.participantes||[]).length} part.</span><div style="text-align:right"><div style="font-size:13px;font-weight:600">${window.fmt(tc)}</div><div style="font-size:11px;color:var(--green-mid)">${window.fmt(pg)} recebido</div></div></div>`;
      }).join('')}
    </div>

    <!-- Top produtos -->
    <div class="s-title">🍺 Mais vendidos</div>
    <div class="card">
      ${topProds.map(([id,q])=>{const p=window.gProd(id);return `<div class="rep-row"><span style="color:var(--text2)">${p.icon} ${p.nome}</span><span style="font-weight:600">${q}x</span></div>`;}).join('')}
    </div>

    <!-- Devedores -->
    ${devedores.length?`
    <div class="s-title">⚠️ Em aberto (${devedores.length})</div>
    <div class="card">
      ${devedores.map(({m,saldo})=>`<div class="rep-row"><span style="color:var(--text2)">${m.nome}</span><span style="font-weight:700;color:var(--red)">${window.fmt(saldo)}</span></div>`).join('')}
    </div>`:'<div class="card" style="text-align:center;color:var(--green-mid);font-weight:600;padding:14px">✅ Todos pagos!</div>'}

    <!-- Exportar PDF -->
    <button class="btn btn-secondary" style="margin-top:12px" onclick="exportarRelatorioPDF('${mk}')">📄 Exportar PDF</button>
  `;
}

window.exportarRelatorioPDF=(mk)=>{
  const sabs=(window.db.sabados||[]).filter(s=>window.mk(s.data)===mk).sort((a,b)=>a.data.localeCompare(b.data));
  const nomeMes=window.fmtM(mk+'-01');
  let totalCons=0,totalPg=0,custot=0;
  const contagens={};
  const porMens=[];
  (window.db.mensalistas||[]).forEach(m=>{
    let tc=0,pg=0;
    sabs.forEach(s=>{const p=s.participantes?.find(x=>x.mensalistaId===m.id);if(p){tc+=window.calcC(p.consumos);pg+=window.totPago(p);custot+=window.calcCusto(p.consumos);Object.entries(p.consumos||{}).forEach(([id,q])=>{contagens[id]=(contagens[id]||0)+q;});}});
    if(tc>0) porMens.push({m,tc,pg,saldo:tc-pg});
  });
  totalCons=porMens.reduce((s,x)=>s+x.tc,0);
  totalPg=porMens.reduce((s,x)=>s+x.pg,0);
  const lucroReal=totalPg-custot*(totalPg/Math.max(totalCons,1));
  const topProds=Object.entries(contagens).sort((a,b)=>b[1]-a[1]);
  const devedores=porMens.filter(x=>x.saldo>0).sort((a,b)=>b.saldo-a.saldo);

  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111;max-width:700px;margin:0 auto}
    h1{color:#1e3a8a;border-bottom:3px solid #1e3a8a;padding-bottom:8px}
    h2{color:#1e3a8a;font-size:14px;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.05em}
    .grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin:12px 0}
    .card{border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center}
    .label{font-size:10px;color:#6b7280;text-transform:uppercase;margin-bottom:4px}
    .val{font-size:18px;font-weight:700}
    .green{color:#059669}.amber{color:#92400e}.red{color:#991b1b}.blue{color:#1c64f2}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#1e3a8a;color:#fff;padding:8px;text-align:left}
    td{padding:7px 8px;border-bottom:1px solid #e5e7eb}
    tr:last-child td{border:none}
    .footer{margin-top:30px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px}
  </style></head><body>
  <h1>CremeFC — Relatório Mensal</h1>
  <p style="color:#6b7280;font-size:13px">Mês de referência: <b>${nomeMes}</b> · Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
  <div class="grid">
    <div class="card"><div class="label">Consumido</div><div class="val blue">${window.fmt(totalCons)}</div></div>
    <div class="card"><div class="label">Recebido</div><div class="val green">${window.fmt(totalPg)}</div></div>
    <div class="card"><div class="label">Em aberto</div><div class="val amber">${window.fmt(totalCons-totalPg)}</div></div>
    <div class="card"><div class="label">Lucro real</div><div class="val green">${window.fmt(Math.max(0,lucroReal))}</div></div>
  </div>
  <h2>Sábados do mês</h2>
  <table><tr><th>Data</th><th>Participantes</th><th>Consumido</th><th>Recebido</th></tr>
  ${sabs.map(s=>{const tc=(s.participantes||[]).reduce((sum,p)=>sum+window.calcC(p.consumos),0);const pg=(s.participantes||[]).reduce((sum,p)=>sum+window.totPago(p),0);return `<tr><td>${window.fmtD(s.data)}</td><td>${(s.participantes||[]).length}</td><td>${window.fmt(tc)}</td><td>${window.fmt(pg)}</td></tr>`;}).join('')}
  </table>
  <h2>Por mensalista</h2>
  <table><tr><th>Nome</th><th>Consumido</th><th>Pago</th><th>Saldo</th></tr>
  ${porMens.sort((a,b)=>a.m.nome.localeCompare(b.m.nome,'pt-BR')).map(({m,tc,pg,saldo})=>`<tr><td>${m.nome}</td><td>${window.fmt(tc)}</td><td>${window.fmt(pg)}</td><td style="color:${saldo>0?'#991b1b':saldo<0?'#059669':'#6b7280'};font-weight:${saldo!==0?'700':'400'}">${saldo>0?window.fmt(saldo):saldo<0?'Crédito '+window.fmt(Math.abs(saldo)):'✓'}</td></tr>`).join('')}
  </table>
  <h2>Produtos mais vendidos</h2>
  <table><tr><th>Produto</th><th>Qtd</th></tr>
  ${topProds.map(([id,q])=>{const p=window.gProd(id);return `<tr><td>${p.icon} ${p.nome}</td><td>${q}</td></tr>`;}).join('')}
  </table>
  ${devedores.length?`<h2 style="color:#991b1b">⚠️ Devedores (${devedores.length})</h2>
  <table><tr><th>Nome</th><th>Saldo devedor</th></tr>
  ${devedores.map(({m,saldo})=>`<tr><td>${m.nome}</td><td style="color:#991b1b;font-weight:700">${window.fmt(saldo)}</td></tr>`).join('')}
  </table>`:''}
  <div class="footer">CremeFC · Bar do Clube · ${nomeMes} · frolicking-lokum-e76d57.netlify.app</div>
  <\/body><\/html>`;

  const w=window.open('','_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(()=>w.print(),500);
};

function renderRelRanking(){
  const el=document.getElementById('rel-ranking');
  // Calcular totais por mensalista — histórico completo
  const dados=[];
  (window.db.mensalistas||[]).forEach(m=>{
    let tc=0,pg=0,sabCount=0;
    const prodCnt={};
    (window.db.sabados||[]).forEach(s=>{
      const p=s.participantes?.find(x=>x.mensalistaId===m.id);
      if(!p)return;
      const val=window.calcC(p.consumos);
      if(val>0){tc+=val;sabCount++;pg+=window.totPago(p);}
      Object.entries(p.consumos||{}).forEach(([id,q])=>{prodCnt[id]=(prodCnt[id]||0)+q;});
    });
    if(tc>0){
      const favProd=Object.entries(prodCnt).sort((a,b)=>b[1]-a[1])[0];
      dados.push({m,tc,pg,sabCount,fav:favProd?window.gProd(favProd[0]):null,favQtd:favProd?favProd[1]:0});
    }
  });

  // Top consumidores (por valor)
  const topVal=[...dados].sort((a,b)=>b.tc-a.tc);
  // Top frequência (por sábados)
  const topFreq=[...dados].sort((a,b)=>b.sabCount-a.sabCount);

  const medalha=['🥇','🥈','🥉'];
  const maxVal=topVal[0]?.tc||1;
  const maxFreq=topFreq[0]?.sabCount||1;

  const rowVal=(x,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:20px;width:28px;text-align:center">${medalha[i]||`${i+1}º`}</div>
      <div class="avatar" style="width:34px;height:34px;font-size:11px">${x.m.iniciais}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${x.m.nome}</div>
        <div style="font-size:11px;color:var(--text2)">${x.sabCount} sábado(s) ${x.fav?`· ${x.fav.icon}${x.fav.nome}(${x.favQtd}x)`:''}</div>
        <div style="margin-top:4px;height:4px;background:var(--border);border-radius:2px;overflow:hidden">
          <div style="height:100%;background:${i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'var(--blue-mid)'};width:${(x.tc/maxVal*100).toFixed(0)}%;border-radius:2px"></div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:14px;font-weight:700;color:var(--blue-mid)">${window.fmt(x.tc)}</div>
        <div style="font-size:10px;color:${x.pg<x.tc?'var(--red)':'var(--green-mid)'}">${x.pg>=x.tc?'✅ pago':'⚠️ '+window.fmt(x.tc-x.pg)}</div>
      </div>
    </div>`;

  const rowFreq=(x,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:20px;width:28px;text-align:center">${medalha[i]||`${i+1}º`}</div>
      <div class="avatar" style="width:34px;height:34px;font-size:11px">${x.m.iniciais}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${x.m.nome}</div>
        <div style="margin-top:4px;height:4px;background:var(--border);border-radius:2px;overflow:hidden">
          <div style="height:100%;background:${i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'var(--green-mid)'};width:${(x.sabCount/maxFreq*100).toFixed(0)}%;border-radius:2px"></div>
        </div>
      </div>
      <div style="font-size:18px;font-weight:700;color:var(--green-mid)">${x.sabCount}x</div>
    </div>`;

  el.innerHTML=`
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:20px">🏆</span>
        <div style="font-size:15px;font-weight:700">Top consumidores</div>
        <span style="font-size:11px;color:var(--text2);margin-left:auto">por valor total</span>
      </div>
      ${topVal.slice(0,10).map(rowVal).join('')}
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:20px">⚽</span>
        <div style="font-size:15px;font-weight:700">Mais presentes</div>
        <span style="font-size:11px;color:var(--text2);margin-left:auto">por sábados</span>
      </div>
      ${topFreq.slice(0,10).map(rowFreq).join('')}
    </div>`;
}

function renderRelGeral(){
  const tots={pix:0,dinheiro:0,debito:0,credito:0,transf:0};
  (window.db.sabados||[]).forEach(s=>(s.participantes||[]).forEach(p=>(p.pagamentos||[]).forEach(pg=>{if(tots[pg.metodo]!==undefined)tots[pg.metodo]+=pg.valor;})));
  const tr=Object.values(tots).reduce((s,v)=>s+v,0);
  const tc=(window.db.sabados||[]).reduce((s,sab)=>s+(sab.participantes||[]).reduce((s2,p)=>s2+window.calcC(p.consumos),0),0);
  document.getElementById('rel-geral').innerHTML=`<div class="card"><div class="rep-row"><span style="color:var(--text2)">PIX</span><span style="font-weight:700">${window.fmt(tots.pix)}</span></div><div class="rep-row"><span style="color:var(--text2)">Dinheiro</span><span style="font-weight:700">${window.fmt(tots.dinheiro)}</span></div><div class="rep-row"><span style="color:var(--text2)">Débito</span><span style="font-weight:700">${window.fmt(tots.debito)}</span></div><div class="rep-row"><span style="color:var(--text2)">Crédito</span><span style="font-weight:700">${window.fmt(tots.credito)}</span></div><div class="rep-row"><span style="color:var(--text2)">Transferência</span><span style="font-weight:700">${window.fmt(tots.transf)}</span></div></div><div class="total-bar"><span>Total recebido</span><span>${window.fmt(tr)}</span></div><div class="card" style="margin-top:10px"><div class="rep-row"><span style="color:var(--text2)">Total consumido</span><span style="font-weight:700">${window.fmt(tc)}</span></div><div class="rep-row"><span style="color:var(--text2)">Total recebido</span><span style="font-weight:700;color:var(--green-mid)">${window.fmt(tr)}</span></div><div class="rep-row"><span style="font-weight:700">A receber</span><span style="font-weight:700;color:var(--amber)">${window.fmt(tc-tr)}</span></div></div>`;
}

function renderRelMens(){
  const sorted=[...(window.db.mensalistas||[])].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  document.getElementById('rel-mensalistas').innerHTML=sorted.map(m=>{
    let td=0,tp=0;
    (window.db.sabados||[]).forEach(s=>{const p=s.participantes?.find(x=>x.mensalistaId===m.id);if(p){td+=window.calcC(p.consumos);tp+=window.totPago(p);}});
    if(td===0)return'';
    const net=td-tp,st=tp>=td?'pago':tp>0?'parcial':'aberto';
    return `<div class="card" style="margin-bottom:8px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div class="avatar">${m.iniciais}</div><div style="flex:1"><div style="font-size:14px;font-weight:600">${m.nome}</div><div style="font-size:12px;color:var(--text2)">${window.fmt(td)} consumido · ${window.fmt(tp)} pago</div></div><span class="badge badge-${st==='pago'?'pago':st==='parcial'?'parcial':'aberto'}">${net>0?window.fmt(net):net<0?'Crédito':''}</span></div><button class="btn btn-secondary btn-xs" onclick="openHistorico(${m.id})">📋 Ver histórico</button></div>`;
  }).join('');
}

function renderRelProds(){
  const cnt={};
  (window.db.sabados||[]).forEach(s=>(s.participantes||[]).forEach(p=>Object.entries(p.consumos||{}).forEach(([id,q])=>{cnt[id]=(cnt[id]||0)+q;})));
  const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);
  let cT=0,lT=0;
  const rows=top.map(([id,q])=>{const p=window.gProd(id);let rec=p.promo&&q>=p.promo.qtd?Math.floor(q/p.promo.qtd)*p.promo.valor+(q%p.promo.qtd)*p.preco:q*p.preco;const cst=(p.custo||0)*q,luc=rec-cst,mar=p.custo?((p.preco-p.custo)/p.custo*100).toFixed(0):0;cT+=cst;lT+=luc;return `<div class="card" style="margin-bottom:8px;padding:10px 12px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:18px">${p.icon}</span><span style="font-weight:600;flex:1">${p.nome}</span><span style="font-size:12px;color:var(--text2)">${q}x</span></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;font-size:10px;text-align:center"><div style="background:var(--bg2);border-radius:5px;padding:5px"><div style="color:var(--text2)">Receita</div><div style="font-weight:700">${window.fmt(rec)}</div></div><div style="background:var(--red-light);border-radius:5px;padding:5px"><div style="color:var(--red)">Custo</div><div style="font-weight:700;color:var(--red)">${window.fmt(cst)}</div></div><div style="background:var(--green-light);border-radius:5px;padding:5px"><div style="color:var(--green)">Lucro</div><div style="font-weight:700;color:var(--green-mid)">${window.fmt(luc)}</div></div><div style="background:var(--blue-light);border-radius:5px;padding:5px"><div style="color:var(--blue)">Margem</div><div style="font-weight:700;color:var(--blue)">${mar}%</div></div></div></div>`;}).join('');
  document.getElementById('rel-produtos').innerHTML=(rows||'<div style="text-align:center;padding:30px;color:var(--text2)">Nenhum consumo</div>')+(top.length?`<div class="total-bar-green" style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between;font-size:13px;opacity:.85"><span>Custo total</span><span>${window.fmt(cT)}</span></div><div style="display:flex;justify-content:space-between;font-size:17px"><span>Lucro bruto</span><span>${window.fmt(lT)}</span></div></div>`:'');
}

// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════