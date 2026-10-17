const $=s=>document.querySelector(s);
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={boot:null,session:null,round:null,selected:new Set(['graham','martell','bezos','buffett']),weights:{graham:3,martell:2,bezos:2,buffett:2,hormozi:2,garyvee:2,wickman:2},options:['','',''],polling:false,lastUpdate:null};
const phaseNames={setup:'Preparando el consejo',round1:'Posiciones independientes',cruxes:'Encontrando los desacuerdos',round2:'Debate y escenarios',draft:'Construyendo una resolución',round3:'Ratificación y disenso',verdict:'Verificando el veredicto',complete:'Consejo completo'};
const statusNames={RUNNING:'En curso',PAUSED:'Pausada',FAILED:'Requiere atención',COMPLETE:'Completa',BUDGET_EXCEEDED:'Límite alcanzado'};
function toast(message,error=false) {$('#toast').textContent=message;$('#toast').classList.toggle('error',error);$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6000);}
async function api(url,{method='GET',body}={}) {
  const res=await fetch(url,{method,headers:{'content-type':'application/json',...(state.boot?{'x-roast-token':state.boot.csrf}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=await res.json();if(!res.ok)throw new Error(data.error||'No se pudo completar la acción.');return data;
}
function configUI() {
  const c=state.boot.config;
  $('#key-indicator').classList.toggle('ready',c.hasKey);
  $('#launch-hint').textContent=c.hasKey?`IA conectada · ${c.model}`:'Conecta tu IA para abrir el consejo.';
  $('#launch-btn').disabled=Boolean(state.boot.active);
  if(state.boot.active)$('#launch-hint').textContent='Ya hay un consejo en curso. Puedes abrirlo desde el historial.';
}
function openSettings() {
  const c=state.boot.config;$('#provider').value=c.provider;$('#model').value=c.model;$('#api-key').value='';$('#settings-error').textContent='';
  for(const id of ['provider','model','api-key'])$(`#${id}`).disabled=Boolean(c.locked);
  $('#settings-form button[type="submit"]').hidden=Boolean(c.locked);
  $('#settings-copy').textContent=c.locked?'El motor de IA está configurado y administrado por el servidor. La clave nunca se envía a tu navegador.':'Las llamadas salen desde el servidor al proveedor que elijas. La clave introducida aquí permanece sólo en memoria.';
  $('#settings-help').textContent=c.locked?`Gateway: ${c.baseURL||c.provider}. Modelo: ${c.model}.`:'Deja vacío para conservar la clave ya cargada de este proveedor. Guardar no hace llamadas.';
  $('#api-key').placeholder=c.locked?'Configurada en el servidor':'Introduce tu clave';$('#settings-dialog').showModal();
}
$('#settings-open').addEventListener('click',openSettings);
document.querySelectorAll('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$('#provider').addEventListener('change',()=>{$('#model').value=$('#provider').value===state.boot.config.provider?state.boot.config.model:$('#provider').value==='openai'?'gpt-4o-mini':$('#provider').value==='freellmapi'?'auto':'';$('#api-key').value='';});
$('#settings-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;$('#settings-error').textContent='';
  try {state.boot.config=await api('/api/config',{method:'POST',body:{provider:$('#provider').value,model:$('#model').value,apiKey:$('#api-key').value.trim()}});$('#api-key').value='';$('#settings-dialog').close();configUI();toast('Conexión guardada. Ya puedes abrir el consejo.');}
  catch(e){$('#settings-error').textContent=e.message;}finally{button.disabled=false;}
});
function optionsUI() {
  $('#options-editor').innerHTML=state.options.map((v,i)=>`<div class="option-row"><span class="option-id">${'ABCD'[i]}</span><input data-option="${i}" aria-label="Opción ${'ABCD'[i]}" maxlength="200" required placeholder="${['La apuesta principal','Una alternativa más pequeña','Mantener la situación actual','Otra forma de resolverlo'][i]}" value="${h(v)}">${i>=2?`<button class="option-remove" type="button" data-remove="${i}" aria-label="Eliminar opción ${'ABCD'[i]}">×</button>`:''}</div>`).join('');
  $('#add-option').hidden=state.options.length===4;
  $('#options-editor').querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{state.options[Number(input.dataset.option)]=input.value;noActionUI();}));
  $('#options-editor').querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{state.options.splice(Number(b.dataset.remove),1);optionsUI();}));
  noActionUI();
}
function noActionUI() {
  const old=$('#no-action').value;
  $('#no-action').innerHTML=state.options.map((label,i)=>`<option value="${'ABCD'[i]}">${'ABCD'[i]} · ${h(label||['Opción A','Opción B','Mantener situación actual','Opción D'][i])}</option>`).join('');
  $('#no-action').value=old&&'ABCD'.slice(0,state.options.length).includes(old)?old:'ABCD'[state.options.length-1];
}
$('#add-option').addEventListener('click',()=>{if(state.options.length<4){state.options.push('');optionsUI();}});
function seatsUI() {
  const full=$('#mode').value==='full';
  $('#seats-editor').innerHTML=state.boot.seats.map(s=>`<div class="seat-row"><label class="seat-check"><input type="checkbox" data-seat="${s.key}" ${state.selected.has(s.key)?'checked':''} ${full?'disabled':''}><img class="seat-avatar" src="/portraits/${s.key}-base.webp" alt=""><span><strong>${h(s.name)}</strong><small>${h(s.role)}</small></span></label><select data-weight="${s.key}" aria-label="Peso de ${h(s.name)}" ${!state.selected.has(s.key)?'disabled':''}>${[1,2,3].map(w=>`<option value="${w}" ${state.weights[s.key]===w?'selected':''}>${w}</option>`).join('')}</select></div>`).join('');
  $('#seats-editor').querySelectorAll('[data-seat]').forEach(input=>input.addEventListener('change',()=>{input.checked?state.selected.add(input.dataset.seat):state.selected.delete(input.dataset.seat);seatsUI();}));
  $('#seats-editor').querySelectorAll('[data-weight]').forEach(select=>select.addEventListener('change',()=>state.weights[select.dataset.weight]=Number(select.value)));
  $('#portrait-stack').innerHTML=state.boot.seats.filter(s=>state.selected.has(s.key)).slice(0,5).map(s=>`<img src="/portraits/${s.key}-base.webp" alt="${h(s.name)}">`).join('');
  $('#seat-count').textContent=state.selected.size;
  $('#call-estimate').textContent=`${state.selected.size*3+3} llamadas sin reintentos${$('#mode').value==='quick'?' como máximo':''}`;
}
$('#mode').addEventListener('change',()=>{
  if($('#mode').value==='full'){state.selected=new Set(state.boot.seats.map(s=>s.key));$('#max-calls').value=48;}
  else if($('#mode').value==='quick'&&state.selected.size!==4)state.selected=new Set(['graham','martell','bezos','buffett']);
  seatsUI();
});
function scenariosUI() {
  $('#scenarios-editor').innerHTML=state.boot.scenarios.map((s,i)=>`<label class="scenario-choice"><input type="checkbox" name="scenario" value="${s.id}" ${i<2?'checked':''}><span><strong>${h(s.name)}</strong><small>${h(s.description)}</small></span></label>`).join('');
}
function readBrief() {
  const f=new FormData($('#brief-form'));
  return {decision:f.get('decision'),context:f.get('context'),resources:f.get('resources'),success:f.get('success'),constraints:f.get('constraints'),deadline:f.get('deadline'),owner:f.get('owner'),lean:f.get('lean'),
    options:state.options.map(label=>({label})),noActionId:$('#no-action').value,mode:$('#mode').value,seats:[...state.selected],weights:{...state.weights},
    scenarios:[...document.querySelectorAll('[name="scenario"]:checked')].map(x=>x.value),maxCalls:Number($('#max-calls').value),maxOutputTokens:Number($('#max-output').value)};
}
function fillBrief(brief) {
  for(const key of ['decision','context','resources','success','constraints','deadline','owner','lean'])$(`#${key}`).value=brief[key]||'';
  state.options=brief.options.map(o=>o.label);optionsUI();$('#no-action').value=brief.noActionId;
  $('#mode').value=brief.mode;state.selected=new Set(brief.seats);state.weights={...state.weights,...brief.weights};seatsUI();
  document.querySelectorAll('[name="scenario"]').forEach(i=>i.checked=brief.scenarios.includes(i.value));
}
$('#brief-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!state.boot.config.hasKey){openSettings();return;}
  $('#launch-btn').disabled=true;
  try {const result=await api('/api/sessions',{method:'POST',body:readBrief()});state.boot.active=result.id;await openSession(result.id);}
  catch(e){toast(e.message,true);}finally{configUI();}
});
function newSession() {state.session=null;state.lastUpdate=null;state.round=null;location.hash='';$('#brief-view').hidden=false;$('#session-view').hidden=true;$('#breadcrumb-current').textContent='Nueva decisión';configUI();window.scrollTo({top:0,behavior:'smooth'});renderHistory(state.boot.sessions);}
$('#new-session').addEventListener('click',newSession);
async function demo() {try {const d=await api('/api/demo',{method:'POST',body:{}});state.boot.active=d.id;await openSession(d.id);}catch(e){toast(e.message,true);}}
$('#demo-top').addEventListener('click',demo);
async function refreshHistory() {
  const data=await api('/api/sessions');state.boot.sessions=data.sessions;state.boot.active=data.active;renderHistory(data.sessions);configUI();
}
$('#refresh-history').addEventListener('click',()=>refreshHistory().catch(e=>toast(e.message,true)));
function renderHistory(sessions) {
  $('#history').innerHTML=sessions.length?sessions.map(s=>`<button class="history-item ${state.session?.id===s.id?'active':''}" data-history="${s.id}"><strong>${h(s.title)}</strong><small>${s.demo?'DEMO · ':''}${h(statusNames[s.status]||s.status)} · ${new Date(s.createdAt).toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</small></button>`).join(''):'<p class="sidebar-empty">El próximo buen argumento empieza aquí.</p>';
  $('#history').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openSession(b.dataset.history).catch(e=>toast(e.message,true))));
}
async function openSession(id) {
  state.round=null;state.lastUpdate=null;
  const s=await api(`/api/sessions/${id}`);state.session=s;location.hash=id;
  $('#brief-view').hidden=true;$('#session-view').hidden=false;renderSession();await refreshHistory();window.scrollTo({top:0,behavior:'smooth'});
}
function selectedRound(s) {return state.round||([3,2,1].find(r=>Object.keys(s.rounds[r]).length)||1);}
function renderSession() {
  const s=state.session,r=selectedRound(s);state.lastUpdate=s.updatedAt;
  $('#breadcrumb-current').textContent='Tu consejo';$('#session-title').textContent=s.title;
  $('#session-kicker').textContent=s.demo?'UN EJEMPLO PARA EXPLORAR':s.status==='COMPLETE'?'UN VEREDICTO, CON SUS CONDICIONES':statusNames[s.status]?.toUpperCase()||s.status;
  $('#session-meta').textContent=`${s.brief.seats.length} perspectivas · ${s.demo?'Demostración sin IA':`${s.engine.provider} / ${s.engine.model}`} · ${new Date(s.createdAt).toLocaleString('es-MX')}`;
  $('#demo-banner').hidden=!s.demo;$('#session-error').hidden=!s.error;$('#session-error').textContent=s.error||'';
  $('#stop-session').hidden=s.status!=='RUNNING';$('#resume-session').hidden=!['PAUSED','FAILED'].includes(s.status);
  const steps=['round1','round2','draft','round3','complete'],current=s.status==='COMPLETE'?4:s.phase==='setup'?0:s.phase==='cruxes'?1:s.phase==='verdict'?4:Math.max(0,steps.indexOf(s.phase));
  $('#progress-steps').innerHTML=steps.map((p,i)=>`<li class="${i===current?'active':i<current?'done':''}"><span>${i<current?'✓':String(i+1).padStart(2,'0')}</span>${['Posiciones','Debate','Resolución',s.skippedRatification?'Voto omitido (rápido)':'Ratificación','Veredicto'][i]}</li>`).join('');
  $('#round-heading').textContent=s.status==='RUNNING'?(phaseNames[s.phase]||'El consejo está pensando…'):s.status==='COMPLETE'?'Todas las voces, sobre la mesa.':'El debate está guardado.';
  $('#round-tabs').innerHTML=[1,2,3].filter(n=>Object.keys(s.rounds[n]).length).map(n=>`<button data-round="${n}" class="${n===r?'active':''}">Ronda ${n}</button>`).join('');
  $('#round-tabs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.round=Number(b.dataset.round);renderSession();}));
  const pending=s.events.at(-1)?.step;
  $('#advisor-grid').innerHTML=s.brief.seats.map(k=>{
    const seat=state.boot.seats.find(x=>x.key===k),card=s.rounds[r][k],thinking=s.status==='RUNNING'&&pending===`round${r}/${k}`;
    return `<button class="advisor-card ${card?'':'pending'} ${thinking?'thinking':''}" data-advisor="${k}" aria-label="${h(seat.name)}: ${card?'leer análisis':'pendiente'}"><div class="advisor-top"><img src="/portraits/${k}-base.webp" alt=""><span class="advisor-role">${h(seat.role)}</span></div><div class="advisor-name">${h(seat.name)}</div><div class="advisor-call">${card?h(card.call):h(seat.question)}</div>${card?`<div class="score-mini">${s.brief.options.map(o=>`<span>${o.id} <b>${card.scores[o.id]}</b></span>`).join('')}</div>`:`<div class="advisor-state">${thinking?'<span class="loading"></span> Está pensando…':'Esperando su turno'}</div>`}</button>`;
  }).join('');
  $('#advisor-grid').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openAdvisor(b.dataset.advisor,r)));
  $('#crux-content').innerHTML=s.cruxes?`${s.cruxes.cruxes.map(q=>`<div class="crux-item">${h(q)}</div>`).join('')}${s.cruxes.forcedAlternative?`<div class="force-note">${h(s.cruxes.forcedAlternative)}</div>`:''}`:'Aparecerán después de las posiciones iniciales.';
  if(s.draft)$('#crux-content').innerHTML+=`<div class="verdict-section"><h3>La resolución sobre la mesa</h3><p>${h(s.draft.recommendation)}</p></div>`;
  $('#usage-display').textContent=`${s.usage.calls}/${s.brief.maxCalls} llamadas`;
  $('#activity').innerHTML=s.events.slice(-14).reverse().map(ev=>`<div class="activity-item"><time>${new Date(ev.time).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</time><span class="status-dot"></span><span>${h(ev.message)}</span></div>`).join('');
  $('#verdict-panel').hidden=s.status!=='COMPLETE';if(s.status==='COMPLETE')renderVerdict(s);
}
function openAdvisor(k,r) {
  const seat=state.boot.seats.find(s=>s.key===k),card=state.session.rounds[r][k];if(!card){toast('Esta perspectiva todavía está pendiente.');return;}
  $('#advisor-name').textContent=seat.name;$('#advisor-kicker').textContent=`${seat.role.toUpperCase()} · RONDA ${r} · VOZ SIMULADA`;
  $('#advisor-detail').innerHTML=`<div class="detail-scores">${Object.entries(card.scores).map(([k,v])=>`<span>${k} <b>${v}/10</b></span>`).join('')}</div><section class="detail-section"><h3>Su posición</h3><p>${h(card.call)}</p><ul>${card.reasons.map(x=>`<li>${h(x)}</li>`).join('')}</ul></section><section class="detail-section"><h3>El mejor argumento en contra</h3><p>${h(card.counterargument)}</p></section><section class="detail-section"><h3>Qué cambiaría su opinión</h3><p>${h(card.changeMind)}</p></section>${card.disagreesWith?`<section class="detail-section"><h3>El desacuerdo</h3><p>${h(card.disagreesWith)}</p><h3>Lo que concede</h3><p>${h(card.concedes)}</p></section>`:''}${(card.scenarios||[]).map(x=>`<section class="detail-section"><h3>Si cambia el escenario: ${h(state.boot.scenarios.find(s=>s.id===x.id)?.name)}</h3><p>${h(x.response)}</p></section>`).join('')}<section class="detail-section"><h3>Riesgo por opción</h3>${Object.entries(card.risks).map(([id,x])=>`<p><b>${id}</b> · ${h({none:'Sin ruina identificada',possible:'Ruina posible',likely:'Ruina probable'}[x.ruin])} · ${x.door==='one-way'?'Irreversible':'Reversible'}<br>${h(x.reason)}</p>`).join('')}</section>${card.vote?`<section class="detail-section"><h3>Voto: ${h({endorse:'Respalda',amend:'Propone enmienda',dissent:'Disiente'}[card.vote])}</h3><p>Apoyo a la resolución: ${card.support}/10. ${h(card.amendment)}</p></section>`:''}<section class="detail-section"><h3>Referencias del pack</h3><p>Se validó la atribución local. No se comprobaron las publicaciones primarias.</p>${card.citations.length?card.citations.map(c=>`<p><a href="${h(c.url)}" target="_blank" rel="noopener noreferrer">${h(c.id)} · ${h(c.title)} ↗</a><br>${h(c.claim)}</p>${c.quote?`<blockquote>${h(c.quote)}</blockquote>`:''}`).join(''):'<p>No hay referencias citadas en esta perspectiva.</p>'}</section>`;
  $('#advisor-dialog').showModal();
}
function renderVerdict(s) {
  const v=s.verdict,winner=s.brief.options.find(o=>o.id===v.recommended);
  $('#verdict-panel').innerHTML=`<div class="verdict-hero"><span class="verdict-badge">${h(v.label)} · OPCIÓN ${v.recommended}</span><h2>${h(winner.label)}</h2><p>${h(v.call)}</p>${v.overrides.length?`<div class="overrides">${v.overrides.map(h).join('<br>')}</div>`:''}<div class="verdict-controls"><button id="export-pdf">Descargar PDF ↓</button><a href="/api/sessions/${s.id}/report">Informe Markdown ↓</a><a href="/api/sessions/${s.id}/export">Sesión JSON ↓</a><button id="reuse-brief">Usar este brief ↗</button><button id="new-from-verdict">Nueva decisión ＋</button></div></div><div class="verdict-grid"><section class="paper-card"><p class="eyebrow">EL RESULTADO, CON SUS NÚMEROS</p><h2>Cómo se comparan las opciones</h2><table class="scores-table"><thead><tr><th>Opción</th><th>Ponderada</th><th>Igual peso</th></tr></thead><tbody>${v.rows.map(row=>`<tr><td><b>${row.id}</b> · ${h(row.label)}</td><td>${row.score.toFixed(1)}<div class="score-bar"><progress max="10" value="${row.score}"></progress></div></td><td>${row.equal.toFixed(1)}</td></tr>`).join('')}</tbody></table><p class="muted">Confianza subjetiva ${v.confidence}/10 · Apoyo a la resolución ${v.support===null?'sin voto final':`${v.support}/10`}. Estos valores no son probabilidades.</p><div class="verdict-section"><h3>¿Depende de los pesos?</h3><p>${v.sensitive?'Sí. Con pesos iguales cambia la opción líder; conviene validar la diferencia antes de ejecutar.':'La opción líder se mantiene con pesos iguales.'}${v.tied.length>1?` Hay empate entre ${h(v.tied.join(', '))}; se usó el orden de las opciones para mostrar una primero.`:''}</p></div><div class="verdict-section"><h3>Los argumentos decisivos</h3><ul>${v.why.map(x=>`<li>${h(x)}</li>`).join('')}</ul></div><div class="verdict-section"><h3>La objeción que sobrevive</h3><p>${h(v.minority)}</p></div></section><section class="paper-card"><p class="eyebrow">DE LA CONVERSACIÓN A LA PRUEBA</p><h2>El próximo paso es reversible.</h2>${v.nextSteps.map(n=>`<div class="next-step"><small>${h(n.owner)} · ${h(n.when)}</small><p>${h(n.action)}</p></div>`).join('')}<div class="verdict-section"><h3>Condiciones de la resolución</h3><ul>${s.draft.conditions.map(c=>`<li>${h(c)}</li>`).join('')}</ul><h3>La prueba más pequeña</h3><p>${h(v.cheapestTest)}</p></div><div class="verdict-section"><h3>Cuándo detenerse</h3><p>${h(v.killCriteria)}</p></div><div class="verdict-section"><h3>Cuándo reevaluar</h3><p>${h(v.revisit)}</p></div>${v.amendments.length?`<div class="verdict-section"><h3>Enmiendas para una nueva sesión</h3>${v.amendments.map(a=>`<p>${h(a.seat)}: ${h(a.amendment)}</p>`).join('')}</div>`:''}</section></div>`;
  $('#export-pdf').addEventListener('click',()=>exportPDF().catch(e=>toast(e.message,true)));
  $('#reuse-brief').addEventListener('click',()=>{fillBrief(s.brief);newSession();});
  $('#new-from-verdict').addEventListener('click',newSession);
}
async function exportPDF() {
  if(!window.jspdf)throw new Error('No se pudo cargar el exportador PDF. Recarga la página.');
  const response=await fetch(`/api/sessions/${state.session.id}/report`);if(!response.ok)throw new Error('El informe todavía no está disponible.');
  const markdown=await response.text(),doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'});
  const sanitize=s=>s.replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[→↗]/g,'->').replace(/≥/g,'>=').replace(/[–—]/g,'-').replace(/×/g,'x');
  let y=18;doc.setFont('helvetica');
  for(const line of markdown.split('\n')) {
    const heading=line.startsWith('#');doc.setFontSize(heading?12:9);doc.setTextColor(32,54,47);
    const rows=doc.splitTextToSize(sanitize(line.replace(/^#+\s*/,'')),174);
    for(const row of rows){if(y>278){doc.addPage();y=18;}doc.text(row,18,y);y+=heading?6:4.5;}
    y+=1;
  }
  doc.save(`roast-room-${state.session.id}.pdf`);
}
$('#stop-session').addEventListener('click',async()=>{try{await api(`/api/sessions/${state.session.id}/stop`,{method:'POST',body:{}});toast('Deteniendo la llamada en curso; se conserva el progreso.');}catch(e){toast(e.message,true);}});
$('#resume-session').addEventListener('click',async()=>{try{if(!state.session.demo&&!state.boot.config.hasKey){openSettings();return;}await api(`/api/sessions/${state.session.id}/resume`,{method:'POST',body:{}});state.lastUpdate=null;}catch(e){toast(e.message,true);}});
async function poll() {
  if(state.polling||!state.session)return;state.polling=true;
  try {
    const id=state.session.id,s=await api(`/api/sessions/${id}`);if(state.session?.id!==id)return;
    if(s.updatedAt!==state.lastUpdate){state.session=s;renderSession();await refreshHistory();}
  }catch(e){toast('No se pudo actualizar la sesión. El servidor conserva el progreso.',true);}
  finally{state.polling=false;}
}
async function boot() {
  try{state.boot=await api('/api/bootstrap');optionsUI();seatsUI();scenariosUI();configUI();renderHistory(state.boot.sessions);
    const id=location.hash.slice(1);if(/^[a-f0-9-]{36}$/.test(id))await openSession(id);
    setInterval(poll,1200);
  }catch(e){toast(`No se pudo cargar Roast Room: ${e.message}`,true);}
}
boot();
