// ═══════════════════════════════════════════════════
// mensalistas.js — Config: membros, produtos, modais, utilitários
// ═══════════════════════════════════════════════════
'use strict';

window.showCfgTab=(tab,btn)=>{
  document.querySelectorAll('#cfg-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ['geral','mensalistas','produtos'].forEach(t=>document.getElementById('cfg-tab-'+t).style.display=t===tab?'block':'none');
};

window.filtrarCfgMens=()=>{
  const q=(document.getElementById('search-cfg-mens')?.value||'').toLowerCase().trim();
  const mens=[...(window.db.mensalistas||[])].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const filtered=q?mens.filter(m=>m.nome.toLowerCase().includes(q)):mens;
  renderListaMensalistas(filtered);
};

function renderListaMensalistas(lista){
  document.getElementById('cfg-mensalistas').innerHTML=lista.map(m=>`<div class="cfg-item" style="flex-direction:column;align-items:stretch;gap:8px"><div style="display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:8px"><div class="avatar" style="width:32px;height:32px;font-size:10px">${m.iniciais}</div><div><div style="font-size:14px;font-weight:600">${m.nome}</div>${m.tel?`<div style="font-size:11px;color:var(--text2)">${m.tel}</div>`:''}</div></div><div style="display:flex;gap:5px"><button class="btn-icon" onclick="editarMensalista('${m.id}')">✏️</button><button class="btn-icon" onclick="delPessoa('${m.id}')">🗑️</button></div></div><div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg2);border-radius:8px;padding:8px 10px">${m.code?`<div class="code-badge" onclick="mostrarCodigo('${m.id}')">🔑 ${m.code} <span style="font-size:10px;opacity:.7">· ver/enviar</span></div>`:`<span style="font-size:12px;color:var(--text2)">Sem código de acesso</span>`}<button class="btn-icon" onclick="definirCodigo('${m.id}')" title="Definir código">${m.code?'✏️':'＋'}</button></div></div>`).join('');
}

function renderConfig(){
  document.getElementById('cfg-nome').value=window.db.config?.nome||'';
  document.getElementById('cfg-pix').value=window.db.config?.pix||'';
  const prods=[...(window.db.produtos||[])].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  document.getElementById('cfg-produtos').innerHTML=prods.map(p=>{const mar=p.custo?((p.preco-p.custo)/p.custo*100).toFixed(0):0;const pL=p.promo?` · ${p.promo.qtd}x=${window.fmt(p.promo.valor)}`:'';return `<div class="cfg-item" style="flex-direction:column;align-items:stretch;gap:7px"><div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:14px;font-weight:600">${p.icon} ${p.nome}<span style="font-size:11px;color:var(--text2)">${pL}</span></div><div style="display:flex;gap:5px"><button class="btn-icon" onclick="editProd('${p.id}')">✏️</button><button class="btn-icon" onclick="delProd('${p.id}')">🗑️</button></div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;font-size:11px;text-align:center"><div style="background:var(--red-light);border-radius:6px;padding:5px"><div style="color:var(--red);font-size:10px">CUSTO</div><div style="font-weight:700;color:var(--red)">${window.fmt(p.custo||0)}</div></div><div style="background:var(--green-light);border-radius:6px;padding:5px"><div style="color:var(--green);font-size:10px">VENDA</div><div style="font-weight:700;color:var(--green-mid)">${window.fmt(p.preco)}</div></div><div style="background:var(--blue-light);border-radius:6px;padding:5px"><div style="color:var(--blue);font-size:10px">MARGEM</div><div style="font-weight:700;color:var(--blue)">${mar}%</div></div></div></div>`;}).join('');
  const mens=[...(window.db.mensalistas||[])].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  document.getElementById('cfg-mensalistas').innerHTML=mens.map(m=>`<div class="cfg-item" style="flex-direction:column;align-items:stretch;gap:8px"><div style="display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:8px"><div class="avatar" style="width:32px;height:32px;font-size:10px">${m.iniciais}</div><div><div style="font-size:14px;font-weight:600">${m.nome}</div>${m.tel?`<div style="font-size:11px;color:var(--text2)">${m.tel}</div>`:''}</div></div><div style="display:flex;gap:5px"><button class="btn-icon" onclick="editarMensalista('${m.id}')">✏️</button><button class="btn-icon" onclick="delPessoa('${m.id}')">🗑️</button></div></div><div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg2);border-radius:8px;padding:8px 10px">${m.code?`<div class="code-badge" onclick="mostrarCodigo('${m.id}')">🔑 ${m.code} <span style="font-size:10px;opacity:.7">· ver/enviar</span></div>`:`<span style="font-size:12px;color:var(--text2)">Sem código de acesso</span>`}<button class="btn-icon" onclick="definirCodigo('${m.id}')">${m.code?'✏️':'＋'}</button></div></div>`).join('');
  window.updateHeader();
}

window.salvarCfg=()=>{
  if(!window.db.config)window.db.config={};
  window.db.config.nome=document.getElementById('cfg-nome').value;
  window.db.config.pix=document.getElementById('cfg-pix').value;
  window.save();window.updateHeader();
};

window.editProd=(id)=>{
  const p=(window.db.produtos||[]).find(x=>x.id===id);
  const nv=prompt(`Preço de venda — ${p.nome}:`,p.preco.toFixed(2));if(nv&&!isNaN(nv))p.preco=parseFloat(nv);
  const nc=prompt(`Custo de compra — ${p.nome}:`,(p.custo||0).toFixed(2));if(nc&&!isNaN(nc))p.custo=parseFloat(nc);
  if(confirm('Tem promoção?')){const pq=parseInt(prompt('Quantidade:',p.promo?.qtd||3)),pv=parseFloat(prompt('Valor R$:',p.promo?.valor||10));if(!isNaN(pq)&&!isNaN(pv))p.promo={qtd:pq,valor:pv};}else p.promo=null;
  window.save();renderConfig();
};
window.delProd=(id)=>{const p=(window.db.produtos||[]).find(x=>x.id===id); window.customConfirm('Remover o produto '+(p?.nome||'')+' do cardápio?', ()=>{ window.db.produtos=window.db.produtos.filter(x=>x.id!==id);window.save();renderConfig(); }, {icon:'🗑️', title:'Remover produto', okLabel:'Remover', danger:true});};
window.adicionarProduto=()=>{
  const nome=prompt('Nome:');if(!nome)return;
  const icon=prompt('Emoji:','🥤')||'🥤';
  const preco=parseFloat(prompt('Preço (R$):','5'));if(isNaN(preco))return;
  const custo=parseFloat(prompt('Custo (R$):','3'))||0;
  let promo=null;if(confirm('Tem promoção?')){const pq=parseInt(prompt('Qtd:','3')),pv=parseFloat(prompt('Valor R$:','10'));if(!isNaN(pq)&&!isNaN(pv))promo={qtd:pq,valor:pv};}
  if(!window.db.produtos)window.db.produtos=[];
  window.db.produtos.push({id:'p'+Date.now(),nome,icon,preco,custo,promo});
  window.save();renderConfig();
};

// ═══════════════════════════════════════════
// MENSALISTAS (CRUD + CÓDIGO)
// ═══════════════════════════════════════════
window.abrirNovaPessoa=()=>{
  _editMid=null;
  document.getElementById('mp-pessoa-title').textContent='Novo mensalista';
  document.getElementById('np-nome').value='';
  document.getElementById('np-tel').value='';
  document.getElementById('np-code').value='';
  window.showModal('m-pessoa');
};

window.editarMensalista=(id)=>{
  _editMid=id;
  const m=(window.db.mensalistas||[]).find(x=>x.id==id);if(!m)return;
  document.getElementById('mp-pessoa-title').textContent='Editar — '+m.nome;
  document.getElementById('np-nome').value=m.nome;
  document.getElementById('np-tel').value=m.tel||'';
  document.getElementById('np-code').value=m.code||'';
  window.showModal('m-pessoa');
};

window.definirCodigo=(id)=>{
  const m=(window.db.mensalistas||[]).find(x=>x.id==id);if(!m)return;
  const code=prompt(`Código de acesso para ${m.nome}:`,m.code||`CREME${id}`);
  if(code===null)return;
  m.code=code.toUpperCase().trim();
  window.save();renderConfig();
};

window.salvarPessoa=()=>{
  const nome=document.getElementById('np-nome').value.trim();
  if(!nome){alert('Informe o nome');return;}
  const tel=document.getElementById('np-tel').value.trim();
  const code=document.getElementById('np-code').value.trim().toUpperCase();
  if(code){const dup=(window.db.mensalistas||[]).find(m=>m.code===code&&m.id!==_editMid);if(dup){alert(`Código "${code}" já está em uso por ${dup.nome}`);return;}}
  if(_editMid){
    const m=(window.db.mensalistas||[]).find(x=>x.id==_editMid);
    if(m){m.nome=nome;m.tel=tel;m.code=code;m.iniciais=window.ini(nome);}
  } else {
    if(!window.db.mensalistas)window.db.mensalistas=[];
    window.db.mensalistas.push({id:window.db.nextId++,nome,tel,iniciais:window.ini(nome),code});
  }
  window.save();window.closeModal('m-pessoa');renderConfig();
};

window.delPessoa=(id)=>{const mx=(window.db.mensalistas||[]).find(x=>x.id==id); window.customConfirm('Remover '+(mx?.nome||'mensalista')+'? Os dados de consumo serão mantidos nos sábados.', ()=>{ window.db.mensalistas=window.db.mensalistas.filter(m=>m.id!=id);window.save();renderConfig(); }, {icon:'🗑️', title:'Remover mensalista', okLabel:'Remover', danger:true});};


// ═══════════════════════════════════════════
// PAGAMENTOS MENSAIS / PARCIAIS
// ═══════════════════════════════════════════

window.abrirPagMensal = (mid) => {
  const m = (window.db.mensalistas||[]).find(x=>x.id===mid);
  if(!m) return;
  window._pagMensalMid = mid;

  // Calcular saldo total de bar
  let td=0, tp=0;
  (window.db.sabados||[]).forEach(s=>{
    const p=s.participantes?.find(x=>x.mensalistaId===mid);
    if(p){td+=window.calcC(p.consumos);tp+=window.totPago(p);}
  });
  const saldoBar = Math.max(0, td-tp);

  document.getElementById('pm-title').textContent = 'Pagamento — '+m.nome;
  document.getElementById('pm-resumo').innerHTML = `
    <div style="font-size:13px;line-height:1.8">
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text2)">Consumo total bar:</span>
        <b>${window.fmt(td)}</b>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text2)">Já pago:</span>
        <b style="color:var(--green-mid)">${window.fmt(tp)}</b>
      </div>
      <div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px solid var(--border);font-weight:700">
        <span>Saldo a pagar:</span>
        <span style="color:${saldoBar>0?'var(--red)':'var(--green-mid)'}">${saldoBar>0?window.fmt(saldoBar):'✅ Em dia'}</span>
      </div>
    </div>`;
  // Preencher pm-valor com máscara monetária
  const _pmEl = document.getElementById('pm-valor');
  if (_pmEl) {
    if (saldoBar > 0) {
      _pmEl.value = saldoBar.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
    } else {
      _pmEl.value = '';
    }
  }
  document.getElementById('pm-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('pm-obs').value = '';
  document.getElementById('pm-metodo').value = 'PIX';
  window.showModal('m-pag-mensal');
};

window.confirmarPagMensal = () => {
  const mid = window._pagMensalMid;
  const m = (window.db.mensalistas||[]).find(x=>x.id===mid);
  if(!m) return;
  const valor = window.parseMoeda(document.getElementById('pm-valor'))||0;
  if(valor <= 0){ alert('Informe um valor válido'); return; }
  const data = document.getElementById('pm-data').value;
  if(!data){ alert('Informe a data'); return; }
  const obs = document.getElementById('pm-obs').value.trim();
  const metodo = document.getElementById('pm-metodo').value;
  if(!m.pagamentos_mes) m.pagamentos_mes = [];
  m.pagamentos_mes.push({
    id: Date.now().toString(),
    valor, data, obs, metodo
  });
  window.save();
  window.closeModal('m-pag-mensal');
  renderHist(); // Atualizar a tela
};

window.excluirPagMensal = (mid, pagId) => {
  const m = (window.db.mensalistas||[]).find(x=>x.id===mid);
  if(!m) return;
  window.customConfirm('Excluir este pagamento?', ()=>{
    m.pagamentos_mes = (m.pagamentos_mes||[]).filter(p=>p.id!==pagId);
    window.save();
    renderHist();
  }, {icon:'🗑️', title:'Excluir pagamento', okLabel:'Excluir', danger:true});
};

// ═══════════════════════════════════════════
// MODAIS + UTILITÁRIOS
// ═══════════════════════════════════════════
// showModal/closeModal definidos em utils.js — aqui apenas o caso especial do QR
const _origShowModal = window.showModal;
window.showModal = (id) => {
  _origShowModal(id);
  if(id==='m-qr') setTimeout(()=>{
    if(typeof QRCode!=='undefined' && window.db.config?.pix)
      QRCode.toCanvas(document.getElementById('qr-canvas'), window.db.config.pix, {width:180,margin:1}, ()=>{});
  }, 100);
};

window.exportar=()=>{
  const b=new Blob([JSON.stringify(window.db,null,2)],{type:'application/json'});
  const u=URL.createObjectURL(b),a=document.createElement('a');
  a.href=u;a.download='cremefc-backup.json';a.click();URL.revokeObjectURL(u);
};


// ═══════════════════════════════════════════
// PWA INSTALL
// ═══════════════════════════════════════════
let _deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredPrompt = e;
  // Android: mostra banner com botão real
  const banner = document.getElementById('install-banner');
  const instr = document.getElementById('install-instruction');
  if (banner && instr) {
    instr.innerHTML = '<button onclick="installApp()" style="background:#ffd700;color:#1e3a8a;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">📲 Instalar agora</button>';
    banner.style.display = 'block';
  }
});

window.installApp = async () => {
  if (!_deferredPrompt) return;
  _deferredPrompt.prompt();
  const { outcome } = await _deferredPrompt.userChoice;
  _deferredPrompt = null;
  document.getElementById('install-banner').style.display = 'none';
};

window.addEventListener('appinstalled', () => {
  document.getElementById('install-banner').style.display = 'none';
  _deferredPrompt = null;
});

// iOS: detectar se não está instalado e mostrar banner
window.addEventListener('load', () => {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !isStandalone) {
    setTimeout(() => {
      const banner = document.getElementById('install-banner');
      if (banner) banner.style.display = 'block';
    }, 3000);
  }
});


// ═══════════════════════════════════════════
// CONFIRM CUSTOMIZADO
// ═══════════════════════════════════════════
window.customConfirm = (msg, onOk, opts={}) => {
  const icon = opts.icon || '⚠️';
  const title = opts.title || 'Confirmar';
  const okLabel = opts.okLabel || 'Confirmar';
  const okClass = opts.danger ? 'btn btn-danger' : 'btn btn-primary';
  document.getElementById('mc-icon').textContent = icon;
  document.getElementById('mc-title-text').textContent = title;
  document.getElementById('mc-msg').textContent = msg;
  const btnOk = document.getElementById('mc-ok');
  const btnCancel = document.getElementById('mc-cancel');
  btnOk.textContent = okLabel;
  btnOk.className = okClass + ' btn-sm';
  btnOk.style.flex = '1';
  const overlay = document.getElementById('m-confirm');
  overlay.style.display = 'flex';
  const close = () => { overlay.style.display = 'none'; };
  btnOk.onclick = () => { close(); onOk(); };
  btnCancel.onclick = close;
  overlay.onclick = (e) => { if(e.target === overlay) close(); };
};

// SPLASH + SW movido para o head
