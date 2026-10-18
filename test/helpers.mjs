import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Store} from '../lib/store.mjs';
import {Knowledge} from '../lib/knowledge.mjs';
import {Engine} from '../lib/engine.mjs';
import {DemoProvider,DEMO_BRIEF} from '../lib/demo.mjs';
import {validateBrief} from '../lib/domain.mjs';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const brief=()=>validateBrief(structuredClone(DEMO_BRIEF));
export function fixture(t,{mutate,fail,retryDelaysMs=[0,0],config={provider:'openai',model:'test-model'}}={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'roast-room-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const store=new Store(dir),knowledge=new Knowledge(path.join(ROOT,'knowledge/brains')),calls=[];
  const demo=new DemoProvider();
  const provider={async call(args){calls.push({step:args.step,prompt:args.prompt,system:args.system});if(fail)await fail(args);const result=await demo.call(args);if(mutate){let v=JSON.parse(result.raw);v=mutate(v,args)||v;result.raw=JSON.stringify(v);}return result;}};
  const engine=new Engine(store,knowledge,{providerFactory:()=>provider,retryDelaysMs});
  const s=store.create(brief(),config,knowledge);
  return {dir,store,knowledge,engine,s,calls,provider,config};
}
