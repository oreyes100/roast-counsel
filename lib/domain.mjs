export const UPSTREAM = 'f5e7b631a172ecc8ef5488760654ad37f24204b0';
export const SEATS = [
  {key:'bezos',name:'Jeff Bezos',role:'Estrategia',question:'¿Es la apuesta correcta y qué tan reversible es?',slug:'jeff-bezos',color:'#d5ac62'},
  {key:'graham',name:'Paul Graham',role:'Producto',question:'¿Hay un problema que alguien necesita resolver?',slug:'paul-graham',color:'#e68968'},
  {key:'hormozi',name:'Alex Hormozi',role:'Oferta y ventas',question:'¿Qué valor compran y por qué pagarían?',slug:'alex-hormozi',color:'#cf8194'},
  {key:'garyvee',name:'Gary Vaynerchuk',role:'Distribución',question:'¿Cómo llegará a las primeras personas?',slug:'gary-vaynerchuk',color:'#a79bcd'},
  {key:'martell',name:'Dan Martell',role:'Ejecución',question:'¿Quién lo hará y con cuánto tiempo?',slug:'dan-martell',color:'#7eadd0'},
  {key:'wickman',name:'Gino Wickman',role:'Operaciones',question:'¿Se puede ejecutar sin depender de una persona?',slug:'gino-wickman',color:'#77af98'},
  {key:'buffett',name:'Warren Buffett',role:'Capital y riesgo',question:'¿Cuánto se puede perder y cuándo paramos?',slug:'warren-buffett',color:'#b4ac8b'}
];
export const SCENARIOS = [
  {id:'budget',name:'Presupuesto a la mitad',description:'El presupuesto y las horas disponibles se reducen 50%. ¿Qué recortas y qué condición invalida tu opción?'},
  {id:'demand',name:'La demanda no aparece',description:'El primer experimento no consigue usuarios interesados. No inventes el número: explica qué medir y cuándo detenerse.'},
  {id:'competitor',name:'Un competidor se adelanta',description:'Una alternativa gratuita resuelve el trabajo principal. ¿Qué ventaja queda y cómo la comprobarías?'},
  {id:'execution',name:'Falla una dependencia',description:'La persona o integración crítica no estará disponible durante dos semanas. Replantea alcance y fechas.'},
  {id:'reversal',name:'La decisión se vuelve irreversible',description:'Aparece un compromiso de dinero o reputación que impide volver atrás. Define una prueba y un límite de pérdida.'}
];
export class AppError extends Error {
  constructor(message, code='INVALID', status=400) { super(message); this.code=code; this.status=status; }
}
export function ensure(ok,message) { if(!ok) throw new AppError(message); }
export function text(value,name,max=4000,min=1) {
  ensure(typeof value==='string' && value.trim().length>=min && value.length<=max,`${name}: usa entre ${min} y ${max} caracteres.`);
  return value.trim();
}
export function strings(value,name,max=8) {
  ensure(Array.isArray(value)&&value.length<=max,`${name}: lista inválida.`);
  return value.map(v=>text(v,name,1200));
}
export function validateBrief(input) {
  ensure(input && typeof input==='object','Brief inválido.');
  const options=input.options;
  ensure(Array.isArray(options)&&options.length>=2&&options.length<=4,'Incluye entre 2 y 4 opciones.');
  const clean=options.map((o,i)=>({id:'ABCD'[i],label:text(o.label,'Opción',200)}));
  ensure(new Set(clean.map(o=>o.label.toLowerCase())).size===clean.length,'Las opciones deben ser diferentes.');
  ensure(clean.some(o=>o.id===input.noActionId),'Selecciona la opción de mantener la situación actual.');
  ensure(['full','quick','named'].includes(input.mode),'Modo inválido.');
  let seats=input.mode==='full'?SEATS.map(s=>s.key):input.seats;
  ensure(Array.isArray(seats)&&seats.length>=2&&seats.length<=7&&new Set(seats).size===seats.length&&seats.every(k=>SEATS.some(s=>s.key===k)),'Selecciona entre 2 y 7 asesores.');
  if(input.mode==='quick') ensure(seats.length===4,'El modo rápido usa exactamente 4 asesores.');
  const weights=Object.fromEntries(seats.map(k=>[k,Number(input.weights?.[k])]));
  ensure(Object.values(weights).every(w=>[1,2,3].includes(w)),'Cada asesor necesita un peso de 1 a 3.');
  const top=Object.values(weights).filter(w=>w===3).length;
  ensure(top>=1&&top<=2,'Asigna peso 3 a uno o dos asesores.');
  const scenarios=strings(input.scenarios,'Escenarios',5);
  ensure(scenarios.length>=2&&new Set(scenarios).size===scenarios.length&&scenarios.every(id=>SCENARIOS.some(s=>s.id===id)),'Selecciona al menos 2 escenarios diferentes.');
  const maxCalls=Number(input.maxCalls??32), maxOutputTokens=Number(input.maxOutputTokens??2000);
  ensure(Number.isInteger(maxCalls)&&maxCalls>=5&&maxCalls<=64,'El límite de llamadas debe estar entre 5 y 64.');
  ensure(Number.isInteger(maxOutputTokens)&&maxOutputTokens>=1000&&maxOutputTokens<=4000,'El límite por respuesta debe estar entre 1000 y 4000 tokens.');
  return {
    decision:text(input.decision,'Decisión',500,10),context:text(input.context,'Contexto',5000,10),
    resources:text(input.resources,'Recursos y presupuesto',2000),success:text(input.success,'Éxito medible',1500),
    constraints:text(input.constraints,'Límites',1500),deadline:text(input.deadline,'Fecha de decisión',150),
    owner:text(input.owner||'Yo','Responsable',100),lean:typeof input.lean==='string'?input.lean.slice(0,1000):'',
    options:clean,noActionId:input.noActionId,mode:input.mode,seats,weights,scenarios,
    maxCalls,maxOutputTokens
  };
}
export function validateCard(card, brief, round, key, knowledge) {
  ensure(card&&typeof card==='object','El asesor no devolvió un objeto JSON.');
  ensure(card.seat===key,'El identificador del asesor no coincide.');
  const scores={}, risks={};
  for(const {id} of brief.options) {
    const score=card.scores?.[id];
    ensure(typeof score==='number'&&Number.isFinite(score)&&score>=0&&score<=10,`Falta una puntuación válida para ${id}.`);
    scores[id]=score;
    const risk=card.risks?.[id];
    ensure(risk&&['none','possible','likely'].includes(risk.ruin)&&['one-way','two-way'].includes(risk.door),`Riesgo inválido para ${id}: ruin debe ser none/possible/likely y door one-way/two-way.`);
    risks[id]={ruin:risk.ruin,door:risk.door,reason:text(risk.reason,'Motivo del riesgo',600)};
  }
  ensure(typeof card.confidence==='number'&&card.confidence>=1&&card.confidence<=5,'Confianza inválida: confidence debe ser un número entre 1 y 5, nunca escala de 10.');
  ensure(typeof card.pillar==='number'&&card.pillar>=0&&card.pillar<=10,'Pilar inválido.');
  ensure(Array.isArray(card.citations)&&card.citations.length<=6,'Referencias inválidas.');
  const citations=[],citationWarnings=[];
  for(const citation of card.citations) {
    try {citations.push(knowledge.verify(key,citation));}
    catch(error) {
      if(!(error instanceof AppError))throw error;
      const id=typeof citation?.id==='string'?citation.id:'';
      if(/La cita no coincide/.test(error.message)) {
        try {
          citations.push(knowledge.verify(key,{...citation,quote:''}));
          citationWarnings.push(`Se retiró una cita literal no verificable de ${id}; la fuente queda como referencia registrada.`);
          continue;
        }catch(recheckError) {
          if(!(recheckError instanceof AppError))throw recheckError;
        }
      }
      citationWarnings.push(id?`Se omitió la referencia ${id} porque no está verificada para esta voz.`:'Se omitió una referencia incompleta o no verificada.');
    }
  }
  const out={seat:key,scores,risks,confidence:card.confidence,pillar:card.pillar,
    call:text(card.call,'Argumento',1500),reasons:strings(card.reasons,'Razones',4),
    counterargument:text(card.counterargument,'Contraargumento',1000),
    changeMind:text(card.changeMind,'Condición de cambio',800),citations};
  if(citationWarnings.length)out.citationWarnings=citationWarnings;
  ensure(out.reasons.length>=1,'Incluye al menos una razón.');
  out.conditions=strings(card.conditions,'Condiciones',4);
  if(round>=2) {
    out.disagreesWith=text(card.disagreesWith,'Respuesta al debate',1500);
    out.concedes=text(card.concedes,'Concesión',1000);
    ensure(Array.isArray(card.scenarios)&&card.scenarios.length===brief.scenarios.length,'Faltan respuestas a los escenarios.');
    out.scenarios=brief.scenarios.map(id=>{
      const v=card.scenarios.find(s=>s.id===id);
      ensure(v,`Falta el escenario ${id}.`);
      return {id,response:text(v.response,'Respuesta al escenario',1000)};
    });
  }
  if(round===3) {
    ensure(['endorse','amend','dissent'].includes(card.vote),'Falta un voto explícito.');
    ensure(typeof card.support==='number'&&card.support>=0&&card.support<=10,'Falta apoyo a la resolución.');
    out.vote=card.vote; out.support=card.support;
    out.amendment=typeof card.amendment==='string'?card.amendment.slice(0,1200):'';
    ensure(card.vote==='endorse'||out.amendment.trim(),'Explica la enmienda o disenso.');
    ensure(Array.isArray(card.mitigations)&&card.mitigations.length<=4,'Mitigaciones inválidas.');
    out.mitigations=card.mitigations.map(m=>({option:text(m.option,'Opción mitigada',1),condition:text(m.condition,'Mitigación',1000)}));
  }
  return out;
}
export function aggregate(brief,cards) {
  const rows=brief.options.map(({id,label})=>{
    let total=0; const parts=[],values=[];
    for(const key of brief.seats) {
      const v=cards[key]?.scores?.[id],w=brief.weights[key];
      ensure(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=10,`Consejo incompleto: ${key}, opción ${id}.`);
      total+=w*v; parts.push(`${w} × ${v}`); values.push(v);
    }
    const denominator=brief.seats.reduce((n,k)=>n+brief.weights[k],0);
    return {id,label,score:Math.round(total/denominator*10)/10,raw:total/denominator,
      equal:Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10,
      spread:Math.max(...values)-Math.min(...values),math:`(${parts.join(' + ')}) / ${denominator}`};
  });
  // Stable option order breaks exact ties; surface tied options to the chair.
  rows.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  return rows;
}
export function unanimous(brief,cards) {
  aggregate(brief,cards);
  const tops=brief.seats.map(k=>{
    const sorted=brief.options.map(o=>({id:o.id,v:cards[k].scores[o.id]})).sort((a,b)=>b.v-a.v);
    return sorted[0].v===sorted[1].v?null:sorted[0].id;
  });
  return Boolean(tops[0]&&tops.every(x=>x===tops[0]));
}
export function canSkip(brief,cards) {
  const scores=aggregate(brief,cards);
  return brief.mode==='quick'&&scores[0].spread<=3&&!brief.seats.some(k=>Object.values(cards[k].risks).some(r=>r.ruin==='likely'));
}
export function finalVerdict(session,summary) {
  const {brief,rounds,draft}=session;
  const last=session.skippedRatification?2:3;
  if(last===3) for(const k of brief.seats) ensure(['endorse','amend','dissent'].includes(rounds[3][k]?.vote),'No se puede completar con votos ausentes.');
  const rows=aggregate(brief,rounds[last]),winner=rows[0];
  let label=winner.score>=7.5?'GO':winner.score>=6?'GO WITH CONDITIONS':winner.score>=4.5?'RESHAPE':"DON'T DO IT";
  const overrides=[];
  const ruinSeats=brief.seats.filter(k=>[1,2,3].some(r=>rounds[r]?.[k]?.risks?.[winner.id]?.ruin==='likely')&&
    !(['endorse','amend'].includes(rounds[3]?.[k]?.vote)&&rounds[3]?.[k]?.mitigations?.some(m=>m.option===winner.id&&draft?.conditions.includes(m.condition))));
  if(ruinSeats.length) {label='RESHAPE'; overrides.push(`Riesgo de ruina sin mitigación ratificada: ${ruinSeats.join(', ')}.`);}
  const doors=brief.seats.filter(k=>[1,2,3].some(r=>rounds[r]?.[k]?.risks?.[winner.id]?.door==='one-way'));
  if((doors.includes('bezos')||doors.length>brief.seats.length/2)&&winner.spread>=4) {
    if(label==='GO')label='GO WITH CONDITIONS';
    overrides.push('Decisión irreversible y dispersión ≥4: la prueba mínima es una condición previa.');
  }
  if(winner.id===brief.noActionId)label="DON'T DO IT";
  const equalWinner=[...rows].sort((a,b)=>b.equal-a.equal||a.id.localeCompare(b.id))[0].id;
  const confidence=Math.max(1,Math.min(10,Math.round(brief.seats.reduce((n,k)=>n+rounds[last][k].confidence,0)/brief.seats.length*2)-(winner.spread>=5?1:0)));
  const support=last===3?Math.round(brief.seats.reduce((n,k)=>n+brief.weights[k]*rounds[3][k].support,0)/brief.seats.reduce((n,k)=>n+brief.weights[k],0)*10)/10:null;
  return {...summary,label,recommended:winner.id,rows,overrides,confidence,support,equalWinner,
    tied:rows.filter(r=>r.score===winner.score).map(r=>r.id),sensitive:equalWinner!==winner.id,
    pillarFixes:brief.seats.filter(k=>rounds[last][k].pillar<=4)};
}
