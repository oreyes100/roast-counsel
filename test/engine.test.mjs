import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture} from './helpers.mjs';
import {Store} from '../lib/store.mjs';
import {publicBrief} from '../lib/engine.mjs';
import {AppError,SEATS,validateBrief} from '../lib/domain.mjs';
test('complete three-round run isolates openings, challenges unanimity, ratifies and persists unique sessions',async t=>{
  const f=fixture(t);await f.engine.start(f.s,f.config);
  assert.equal(f.s.status,'COMPLETE');assert.equal(f.calls.length,15);assert.equal(f.s.verdict.recommended,'B');assert.equal(f.s.forcedChallenge.length,2);
  const openings=f.calls.filter(c=>c.step.startsWith('round1'));
  for(const c of openings){assert(!c.prompt.includes(f.s.brief.lean));assert(!c.prompt.includes('Posiciones de ronda 1'));}
  assert(!('lean' in publicBrief(f.s.brief)));
  assert(f.calls.some(c=>c.prompt.includes('ejercicio de steelman')));
  assert(fs.existsSync(path.join(f.dir,f.s.id,'verdict.json')));
  const second=f.store.create(f.s.brief,f.config,f.knowledge);assert.notEqual(second.id,f.s.id);
  assert.equal(new Store(f.dir).get(f.s.id).status,'COMPLETE');
});
test('quick mode skips ratification with valid cards; no fake vote or support is produced',async t=>{
  const f=fixture(t);f.s.brief.mode='quick';await f.engine.start(f.s,f.config);
  assert.equal(f.s.status,'COMPLETE');assert(f.s.skippedRatification);assert.equal(f.calls.length,11);assert.equal(f.s.verdict.support,null);
  assert.equal(Object.keys(f.s.rounds[3]).length,0);assert(!fs.existsSync(path.join(f.dir,f.s.id,'draft.json')));
});
test('invalid model output repairs once, then blocks completion',async t=>{
  const f=fixture(t,{mutate(v,{step}){if(step==='round1/graham')delete v.scores.B;}});
  await f.engine.start(f.s,f.config);assert.equal(f.s.status,'FAILED');assert.equal(f.s.usage.calls,2);
  assert(!fs.existsSync(path.join(f.dir,f.s.id,'verdict.json')));assert.deepEqual(f.s.rounds[1],{});
});
test('call cap stops before dispatch and preserves checkpoints',async t=>{
  const f=fixture(t);f.s.brief.maxCalls=5;await f.engine.start(f.s,f.config);
  assert.equal(f.s.status,'BUDGET_EXCEEDED');assert.equal(f.calls.length,5);assert.equal(f.s.usage.calls,5);
  assert.equal(Object.keys(f.s.rounds[1]).length,4);assert(!f.s.verdict);
});
test('provider failure can resume without repeating completed calls; restart pauses the session',async t=>{
  let failed=false;
  const f=fixture(t,{fail({step}){if(step==='round1/martell'&&!failed){failed=true;throw new AppError('Temporal','PROVIDER_HTTP',502);}}});
  await f.engine.start(f.s,f.config);assert.equal(f.s.status,'FAILED');
  assert.equal(f.calls.filter(c=>c.step==='round1/graham').length,1);
  await f.engine.start(f.s,f.config);assert.equal(f.s.status,'COMPLETE');
  assert.equal(f.calls.filter(c=>c.step==='round1/graham').length,1);assert.equal(f.s.usage.calls,16);
  const other=f.store.create(f.s.brief,f.config,f.knowledge);other.status='RUNNING';f.store.save(other);
  const restored=new Store(f.dir);assert.equal(restored.get(other.id).status,'PAUSED');
});
test('stopping aborts the run before completion; second simultaneous run is rejected',async t=>{
  const f=fixture(t);const done=f.engine.start(f.s,f.config);
  assert.throws(()=>f.engine.start(f.s,f.config),/curso/);f.engine.cancel(f.s.id);await done;
  assert.equal(f.s.status,'PAUSED');assert(!f.s.verdict);
});
test('changed knowledge manifest blocks resume rather than mixing evidence versions',async t=>{
  const f=fixture(t);f.s.knowledge.graham='wrong';await f.engine.start(f.s,f.config);
  assert.equal(f.s.status,'FAILED');assert.equal(f.calls.length,0);assert.match(f.s.error,/pack cambió/);
});
test('an optimistic summary cannot bypass persistent ruin risk',async t=>{
  const f=fixture(t,{mutate(v,{step}){if(step==='round1/buffett')v.risks.B.ruin='likely';}});
  await f.engine.start(f.s,f.config);assert.equal(f.s.status,'COMPLETE');assert.equal(f.s.verdict.label,'RESHAPE');
});
test('full mode completes seven seats, three rounds and 24 bounded calls',async t=>{
  const f=fixture(t);f.s.brief=validateBrief({...f.s.brief,mode:'full',weights:Object.fromEntries(SEATS.map(s=>[s.key,s.key==='graham'?3:2]))});
  f.s.knowledge=f.knowledge.manifest(f.s.brief.seats);
  await f.engine.start(f.s,f.config);assert.equal(f.s.status,'COMPLETE');assert.equal(f.calls.length,24);
  for(const r of [1,2,3])assert.equal(Object.keys(f.s.rounds[r]).length,7);
  const exported=JSON.parse(fs.readFileSync(path.join(f.dir,f.s.id,'verdict.json'),'utf8'));
  assert.equal(exported.recommended,'B');assert.equal(exported.why[0].seat,'Chair');assert(exported.next_steps[0].when);
});
test('quick mode cannot hide earlier likely ruin; actual amendments survive chair omission',async t=>{
  const f=fixture(t,{mutate(v,{step}){
    if(step==='round1/buffett')v.risks.B.ruin='likely';
    if(step==='round3/buffett'){v.vote='amend';v.amendment='Solicitar un pago antes de automatizar.';}
  }});
  f.s.brief.mode='quick';await f.engine.start(f.s,f.config);
  assert.equal(f.s.status,'COMPLETE');assert.equal(f.s.skippedRatification,false);assert.equal(f.s.verdict.label,'RESHAPE');
  assert.equal(f.s.verdict.amendments.length,1);assert.equal(f.s.verdict.amendments[0].adopted,false);
});
test('all model calls include typed output contracts and closed risk enums',async t=>{
  const f=fixture(t);const seen=[];
  f.engine.providerFactory=()=>({call(args){seen.push(args.schema);return f.provider.call(args);}});
  await f.engine.start(f.s,f.config);assert.equal(f.s.status,'COMPLETE');assert.equal(seen.length,15);
  for(const schema of seen)assert.equal(schema.additionalProperties,false);
  assert.deepEqual(seen[0].properties.risks.properties.A.properties.ruin.enum,['none','possible','likely']);
  assert(seen[0].required.includes('citations'));
});
