import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {AppError,UPSTREAM} from './domain.mjs';
export class Store {
  constructor(root) {
    this.root=root;fs.mkdirSync(root,{recursive:true,mode:0o700});
    this.sessions=new Map();
    for(const id of fs.readdirSync(root)) {
      if(!/^[a-f0-9-]{36}$/.test(id))continue;
      try {
        const s=JSON.parse(fs.readFileSync(path.join(root,id,'session.json'),'utf8'));
        if(s.status==='RUNNING') {s.status='PAUSED';s.error='El servidor se reinició. Puedes reanudar desde el último paso guardado.';}
        this.sessions.set(s.id,s);this.save(s);
      }catch { /* A damaged session must not prevent access to other sessions. */ }
    }
  }
  get(id) {const s=this.sessions.get(id);if(!s)throw new AppError('Sesión no encontrada.','NOT_FOUND',404);return s;}
  create(brief,config,knowledge,{demo=false}={}) {
    const s={id:randomUUID(),title:brief.decision,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
      status:'PAUSED',phase:'setup',brief,engine:{provider:config.provider,model:config.model},demo,
      version:1,upstream:UPSTREAM,knowledge:knowledge.manifest(brief.seats),rounds:{1:{},2:{},3:{}},
      results:{},events:[],attempts:{},usage:{calls:0,input:0,output:0,reservedOutput:0},error:null};
    this.sessions.set(s.id,s);this.save(s);return s;
  }
  event(s,type,message,details={}) {
    s.events.push({seq:s.events.length+1,time:new Date().toISOString(),type,message,...details});this.save(s);
  }
  write(s,name,value) {
    const dir=path.join(this.root,s.id);fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const target=path.join(dir,name),tmp=`${target}.${randomUUID()}.tmp`;
    fs.writeFileSync(tmp,typeof value==='string'?value:JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(tmp,target);
  }
  save(s) {s.updatedAt=new Date().toISOString();this.write(s,'session.json',s);}
  list() {return [...this.sessions.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(s=>({id:s.id,title:s.title,status:s.status,phase:s.phase,createdAt:s.createdAt,demo:s.demo,label:s.verdict?.label,calls:s.usage.calls}));}
}
