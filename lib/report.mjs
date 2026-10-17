import {SEATS} from './domain.mjs';
const name=k=>SEATS.find(s=>s.key===k)?.name||k;
export function reportMarkdown(s) {
  const {brief:b,verdict:v}=s;
  const lines=[`# Roast Room: ${b.decision}`,'',s.demo?'DEMOSTRACIÓN PRECALCULADA. No se consultó a una IA.':'Consejo generado por IA. Asesores simulados, sin afiliación con las personas representadas.',
    '',`Sesión: ${s.id}`,`Fecha: ${s.createdAt}`,`Modelo: ${s.engine.provider} / ${s.engine.model}`,`Origen de packs: ${s.upstream}`,
    '',`## Veredicto: ${v.label}`,`Opción ${v.recommended}: ${b.options.find(o=>o.id===v.recommended).label}`,'',v.call,
    '',...v.overrides.map(x=>`CONTROL: ${x}`),'','## Puntuaciones','| Opción | Ponderada | Igual peso | Dispersión | Cálculo |','|---|---:|---:|---:|---|',
    ...v.rows.map(r=>`| ${r.id}: ${r.label.replace(/\|/g,'/')} | ${r.score} | ${r.equal} | ${r.spread} | ${r.math} |`),
    '',`Confianza subjetiva: ${v.confidence}/10. No es una probabilidad. Apoyo a la resolución: ${v.support??'sin ratificación'}.`,
    `Sensibilidad: ${v.sensitive?'el ganador cambia con pesos iguales':'el ganador se mantiene con pesos iguales'}. Empates: ${v.tied.join(', ')}.`,
    '','## Argumentos',...v.why.map(x=>`- ${x}`),'','## Objeción que sobrevive',v.minority,
    '','## Resolución sometida a voto',s.draft.recommendation,...s.draft.conditions.map(c=>`- ${c}`),
    '','## Próximos pasos',...v.nextSteps.map(n=>`- ${n.owner} · ${n.when}: ${n.action}`),
    '',`Prueba mínima: ${v.cheapestTest}`,`Detenerse cuando: ${v.killCriteria}`,`Reevaluar: ${v.revisit}`,
    '','## Enmiendas propuestas',...v.amendments.map(a=>`- ${name(a.seat)}: ${a.amendment}. ${a.reason}`),
    '','## Brief',`Responsable: ${b.owner}. Fecha: ${b.deadline}.`,b.context,`Recursos: ${b.resources}`,`Éxito: ${b.success}`,`Límites: ${b.constraints}`,`Preferencia inicial (oculta en ronda 1): ${b.lean||'no indicada'}`,
    '','## Trazabilidad',`Llamadas: ${s.usage.calls}/${b.maxCalls}; tokens reportados: ${s.usage.input} entrada, ${s.usage.output} salida. Los intentos fallidos pueden no reportar consumo.`,
    'Referencias verificadas contra el pack local, no contra publicaciones primarias. Las paráfrasis y opiniones requieren criterio humano.'];
  for(const round of [1,2,3]) {
    if(!Object.keys(s.rounds[round]).length)continue;
    lines.push('',`## Ronda ${round}`);
    for(const k of b.seats) {
      const c=s.rounds[round][k];
      lines.push('',`### ${name(k)}`,c.call,...c.reasons.map(x=>`- ${x}`),`Contraargumento: ${c.counterargument}`,`Cambiaría de opinión: ${c.changeMind}`);
      if(c.vote)lines.push(`Voto: ${c.vote}; apoyo: ${c.support}/10. ${c.amendment}`);
      for(const x of c.scenarios||[])lines.push(`Escenario ${x.id}: ${x.response}`);
      for(const x of c.citations)lines.push(`Referencia del pack ${k}/${x.id}: ${x.claim}. ${x.url}${x.quote?` · Cita: “${x.quote}”`:''}`);
    }
  }
  return lines.join('\n')+'\n';
}
function cardText(c) {
  const best=Object.entries(c.scores).sort((a,b)=>b[1]-a[1])[0][0],risk=c.risks[best];
  return [`SEAT: ${c.seat}`,`OPTION SCORES: ${Object.entries(c.scores).map(([k,v])=>`${k} ${v}/10`).join(' · ')}`,
    `PILLAR SCORE: ${c.pillar}/10`,`CONFIDENCE: ${c.confidence}/5`,`RUIN RISK: ${risk.ruin}`,`DOOR: ${risk.door}`,`THE CALL: ${c.call}`,
    ...c.reasons.map(x=>`- ${x}`),c.vote?`VOTE: ${c.vote==='amend'?'Endorse with amendment':c.vote==='dissent'?'Dissent':'Endorse'}\nFINAL SCORE: ${c.support}/10\nAMENDMENT OR DISSENT: ${c.amendment}`:''].join('\n');
}
export function writeCompatibility(store,s) {
  const b=s.brief;
  store.write(s,'brief.md',`# ${b.decision}\n\n${b.context}\nRecursos: ${b.resources}\nÉxito: ${b.success}\nLímites: ${b.constraints}\nFecha: ${b.deadline}\n\n${b.options.map(o=>`${o.id}: ${o.label}`).join('\n')}\n`);
  store.write(s,'council.json',{title:b.decision,decision:b.decision,brief:b.context,mode:b.mode==='quick'?'quick':'full',options:b.options,seats:b.seats,weights:Object.fromEntries(b.seats.map(k=>[k,{weight:b.weights[k],reason:SEATS.find(x=>x.key===k).role}])),assumptions:[]});
  for(const r of [1,2,3])if(Object.keys(s.rounds[r]).length)store.write(s,`round-${r}.md`,b.seats.map(k=>`## ${name(k)}\n\n${cardText(s.rounds[r][k])}`).join('\n\n'));
  store.write(s,'cruxes.json',{cruxes:s.cruxes.cruxes.map(question=>({question,sides:[]})),unanimous:s.unanimous,note:s.cruxes.forcedAlternative||''});
  if(!s.skippedRatification) {
    store.write(s,'draft-resolution.md',JSON.stringify(s.draft,null,2));
    store.write(s,'draft.json',{option:s.draft.option,label:'GO WITH CONDITIONS',recommendation:s.draft.recommendation,conditions:s.draft.conditions,next_steps:[],cheapest_test:s.draft.cheapestTest,kill_criteria:s.draft.killCriteria});
  }
  store.write(s,'manifest.json',{version:s.version,upstream:s.upstream,knowledge:s.knowledge,engine:s.engine,limits:{calls:b.maxCalls,maxOutputTokens:b.maxOutputTokens},demo:s.demo});
}
export function viewerVerdict(s) {
  const v=s.verdict;
  return {label:v.label,call:v.call,recommended:v.recommended,
    why:v.why.map(point=>({point,seat:'Chair',framework:'Síntesis del debate'})),
    minority:{seat:'Consejo',quote:v.minority,would_have_to_be_true:'Revisar con la evidencia del próximo experimento.'},
    next_steps:v.nextSteps.map(n=>({when:n.when,action:`${n.owner}: ${n.action}`})),
    kill_criteria:v.killCriteria,conditions:s.draft.conditions,
    fights:s.cruxes.cruxes.map(crux=>({crux,story:'Consultar las tarjetas verbatim de cada ronda.'})),
    amendments:v.amendments,cheapest_test:v.cheapestTest,revisit:v.revisit,override_note:v.overrides.join(' ')};
}
