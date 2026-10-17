import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {brief,ROOT} from './helpers.mjs';
import {Knowledge} from '../lib/knowledge.mjs';
import {validateBrief,validateCard,aggregate,unanimous,canSkip,finalVerdict,SEATS} from '../lib/domain.mjs';
import {DEMO_BRIEF,DemoProvider} from '../lib/demo.mjs';
const knowledge=new Knowledge(path.join(ROOT,'knowledge/brains'));
async function card(k='graham',r=3) {
  const s={brief:brief()},response=await new DemoProvider().call({step:`round${r}/${k}`,session:s,signal:new AbortController().signal});
  return JSON.parse(response.raw);
}
test('brief rejects missing limits, duplicate options, invalid weights and quick seat count',()=>{
  for(const change of [{constraints:''},{options:[{label:'igual'},{label:'igual'}],noActionId:'B'},{weights:{graham:35,martell:25,bezos:20,buffett:20}},{mode:'quick',seats:['graham','buffett']}])
    assert.throws(()=>validateBrief({...structuredClone(DEMO_BRIEF),...change}));
});
test('every upstream registry format loads, including bullet lists and pipe-containing titles',()=>{
  for(const s of SEATS)assert(knowledge.get(s.key).sources.size>50,s.key);
  assert.match(knowledge.get('graham').sources.get('S016').url,/paulgraham/);
});
test('source verification binds ID to seat and exact attributed quotation',()=>{
  const quote='Type 2 decisions can and should be made quickly by high judgment individuals or small groups.';
  assert.equal(knowledge.verify('bezos',{id:'S063',claim:'Reversibilidad',quote}).verification,'pack-quote');
  assert.throws(()=>knowledge.verify('bezos',{id:'S999',claim:'Reversibilidad',quote}));
  assert.throws(()=>knowledge.verify('bezos',{id:'S064',claim:'Reversibilidad',quote}));
  assert.throws(()=>knowledge.verify('graham',{id:'S063',claim:'Reversibilidad',quote}));
});
test('card rejects missing scores, out-of-range values, votes and scenarios',async()=>{
  const b=brief(),c=await card();
  validateCard(c,b,3,'graham',knowledge);
  for(const mutate of [v=>delete v.scores.A,v=>v.scores.B=50,v=>v.vote='',v=>v.scenarios=[]]) {
    const bad=structuredClone(c);mutate(bad);assert.throws(()=>validateCard(bad,b,3,'graham',knowledge));
  }
});
test('aggregation blocks missing values instead of renormalizing and computes stable complete scores',async()=>{
  const b=brief(),cards={};for(const k of b.seats)cards[k]=await card(k);
  assert.equal(aggregate(b,cards)[0].id,'B');assert.equal(aggregate(b,cards)[0].score,8);
  assert(unanimous(b,cards));delete cards.buffett.scores.A;assert.throws(()=>aggregate(b,cards));
});
test('quick mode requires complete data, low spread and no likely ruin',async()=>{
  const b={...brief(),mode:'quick'},cards={};for(const k of b.seats)cards[k]=await card(k);
  assert(canSkip(b,cards));cards.buffett.risks.B.ruin='likely';assert(!canSkip(b,cards));
});
test('deterministic ruin and one-way caps cannot be overridden by model summary',async()=>{
  const b=brief(),cards={};for(const k of b.seats)cards[k]=await card(k);
  const s={brief:b,rounds:{1:structuredClone(cards),2:structuredClone(cards),3:cards},draft:{conditions:[]}};
  s.rounds[1].buffett.risks.B.ruin='likely';
  let v=finalVerdict(s,{label:'GO',recommended:'A'});assert.equal(v.label,'RESHAPE');assert.equal(v.recommended,'B');
  delete s.rounds[1].buffett.risks.B;
  cards.bezos.risks.B.door='one-way';cards.buffett.scores.B=3;
  // Raise other scores to keep B the winner with a wide spread.
  cards.graham.scores.B=10;cards.martell.scores.B=10;cards.bezos.scores.B=10;
  v=finalVerdict(s,{});assert.equal(v.label,'GO WITH CONDITIONS');assert(v.overrides.some(x=>x.includes('irreversible')));
});
test('a dissenting seat cannot clear earlier ruin by naming a condition',async()=>{
  const b=brief(),cards={};for(const k of b.seats)cards[k]=await card(k);
  const s={brief:b,rounds:{1:structuredClone(cards),2:structuredClone(cards),3:cards},draft:{conditions:['Condición real']}};
  s.rounds[1].buffett.risks.B.ruin='likely';cards.buffett.mitigations=[{option:'B',condition:'Condición real'}];cards.buffett.vote='dissent';
  assert.equal(finalVerdict(s,{}).label,'RESHAPE');cards.buffett.vote='endorse';assert.equal(finalVerdict(s,{}).label,'GO');
});
test('missing vote cannot become endorsement',async()=>{
  const b=brief(),cards={};for(const k of b.seats)cards[k]=await card(k);
  delete cards.buffett.vote;
  assert.throws(()=>finalVerdict({brief:b,rounds:{1:{},2:{},3:cards},draft:{conditions:[]}},{}));
});
