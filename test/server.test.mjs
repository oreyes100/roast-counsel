import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {ROOT} from './helpers.mjs';
import {createApp} from '../server.mjs';
import {DemoProvider,DEMO_BRIEF} from '../lib/demo.mjs';
async function app(t,options={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'roast-http-'));
  const demo=new DemoProvider(),a=createApp({dataDir:dir,providerFactory:()=>demo,...options});
  await new Promise((resolve,reject)=>{a.server.once('error',reject);a.server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${a.server.address().port}`;
  const boot=await fetch(base+'/api/bootstrap').then(r=>r.json());
  const post=(url,body,extra={})=>fetch(base+url,{method:'POST',headers:{origin:base,'content-type':'application/json','x-roast-token':boot.csrf,...extra},body:JSON.stringify(body)});
  t.after(async()=>{if(a.engine.active){a.engine.cancel(a.engine.active.id);await a.engine.active?.done;}await new Promise(resolve=>a.server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});});
  return {...a,base,boot,post,dir};
}
test('server rejects cross-site and forged-host access and protects credentials',async t=>{
  const a=await app(t);
  assert.equal((await a.post('/api/config',{provider:'openai',model:'test',apiKey:'secret-key'},{origin:'http://attacker.invalid'})).status,403);
  const forged=await new Promise((resolve,reject)=>{const req=http.get(a.base+'/api/bootstrap',{headers:{host:'attacker.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
  assert.equal(forged,403);
  assert.equal((await fetch(a.base+'/api/bootstrap',{headers:{'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal((await a.post('/api/config',{provider:'openai',model:'test',apiKey:'secret-key'})).status,200);
  const response=await fetch(a.base+'/api/bootstrap');const text=await response.text();assert(!text.includes('secret-key'));
  assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
  assert.equal((await fetch(a.base+'/knowledge/brains/jeff-bezos/_hot.md')).status,404);
});
test('HTTP create, progress, completed report and restart preserve contract without storing API keys',async t=>{
  const a=await app(t);
  assert.equal((await a.post('/api/config',{provider:'openai',model:'test',apiKey:'secret-key'})).status,200);
  const create=await a.post('/api/sessions',DEMO_BRIEF);assert.equal(create.status,201);const {id}=await create.json();
  assert.equal((await fetch(`${a.base}/api/sessions/${id}/report`)).status,409);
  await a.engine.active.done;
  const session=await fetch(`${a.base}/api/sessions/${id}`).then(r=>r.json());assert.equal(session.status,'COMPLETE');assert.equal(session.demo,false);
  const report=await fetch(`${a.base}/api/sessions/${id}/report`).then(r=>r.text());assert.match(report,/Veredicto: GO/);assert.match(report,/Ronda 3/);
  const exported=await fetch(`${a.base}/api/sessions/${id}/export`).then(r=>r.text());assert(!exported.includes('secret-key'));
  for(const p of fs.readdirSync(path.join(a.dir,id)))assert(!fs.readFileSync(path.join(a.dir,id,p),'utf8').includes('secret-key'));
  const second=await a.post('/api/sessions',DEMO_BRIEF);assert.equal(second.status,201);assert.notEqual((await second.json()).id,id);
  assert.equal((await fetch(a.base+'/api/sessions')).status,200);
});
test('demo is explicit, requires no key, and invalid input cannot start a paid council',async t=>{
  const a=await app(t);
  assert.equal((await a.post('/api/sessions',{decision:'short'})).status,400);
  const response=await a.post('/api/demo',{});assert.equal(response.status,201);const {id}=await response.json();
  await a.engine.active.done;const s=a.store.get(id);assert(s.demo);assert.equal(s.engine.provider,'demo');
  const report=await fetch(`${a.base}/api/sessions/${id}/report`).then(r=>r.text());assert.match(report,/No se consultó a una IA/);
});
test('production origin accepts only the configured origin, never arbitrary forwarding headers',async t=>{
  const a=await app(t,{publicOrigin:'https://roast.example.com'});
  assert.equal((await a.post('/api/demo',{})).status,403);
  const r=await a.post('/api/demo',{}, {origin:'https://roast.example.com'});assert.equal(r.status,201);
  const health=await fetch(a.base+'/health').then(r=>r.json());assert.equal(health.status,'ok');
  assert.equal((await fetch(a.base+'/api/bootstrap',{headers:{'x-forwarded-host':'attacker.invalid'}})).status,200);
});
test('managed production config cannot be changed or leaked through the UI endpoint',async t=>{
  const a=await app(t,{configLocked:true});
  assert(a.boot.config.locked);
  assert.equal((await a.post('/api/config',{provider:'openai',model:'test',apiKey:'new-secret'})).status,403);
});
test('CLI starts through a release symlink as used by systemd current',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'roast-cli-'));
  const reservation=http.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const entry=path.join(dir,'entry.mjs');fs.symlinkSync(path.join(ROOT,'server.mjs'),entry);
  const child=spawn(process.execPath,[entry],{env:{...process.env,PORT:String(port),ROAST_DATA_DIR:path.join(dir,'sessions')}});
  t.after(async()=>{child.kill();await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));fs.rmSync(dir,{recursive:true,force:true});});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Symlink CLI did not start')),7000);
    child.stdout.on('data',chunk=>{if(String(chunk).includes('Roast Room:')){clearTimeout(timer);resolve();}});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error('CLI exited before listening: '+code));});
  });
  const r=await fetch(`http://127.0.0.1:${port}/health`);assert.equal(r.status,200);
});
