import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {SEATS,ensure,text} from './domain.mjs';
const norm=s=>s.normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export class Knowledge {
  constructor(root) {this.root=root;this.cache=new Map();}
  get(key) {
    if(this.cache.has(key))return this.cache.get(key);
    const seat=SEATS.find(s=>s.key===key);ensure(seat,'Asesor desconocido.');
    const dir=path.join(this.root,seat.slug), sources=new Map();
    const registry=fs.readFileSync(path.join(dir,'sources.md'),'utf8');
    for(const line of registry.split('\n')) {
      const m=line.match(/^(?:\|\s*|-\s*)(S\d{3})\s*\|\s*(.*?)\s*\|\s*(https?:\/\/[^|\s]+)\s*\|/);
      if(m)sources.set(m[1],{id:m[1],title:m[2].trim(),url:m[3]});
    }
    const files=['_hot.md','frameworks.md','positions.md'];
    // Keep each pack bounded and cite only references actually present in it.
    const content=files.map(f=>`## ${f}\n${fs.readFileSync(path.join(dir,f),'utf8').slice(0,12000)}`).join('\n').slice(0,28000);
    const data={content,sources,hash:createHash('sha256').update(content+registry).digest('hex')};
    this.cache.set(key,data);return data;
  }
  verify(key,c) {
    const data=this.get(key),id=text(c?.id,'ID de referencia',4);
    const source=data.sources.get(id);ensure(source,`La fuente ${id} no existe para ${key}.`);
    ensure(data.content.includes(id),`La fuente ${id} no está en el contexto del asesor.`);
    const claim=text(c.claim,'Afirmación citada',700);
    const quote=typeof c.quote==='string'?c.quote.trim():'';
    if(quote) {
      ensure(quote.length>=15&&quote.length<=400,'La cita debe ser un fragmento breve.');
      const passages=[...data.content.matchAll(/["“]([^"“”\n]{15,400})["”][ .,:;]*\((S\d{3}(?:[ ,;]+S\d{3})*)\)/g)];
      const matching=passages.some(m=>m[2].split(/[,; ]+/).includes(id)&&norm(m[1])===norm(quote));
      ensure(matching,`La cita no coincide con un pasaje atribuido a ${id} del asesor ${key}.`);
    }
    return {...source,claim,quote,verification:quote?'pack-quote':'registered-reference'};
  }
  manifest(keys) {return Object.fromEntries(keys.map(k=>[k,this.get(k).hash]));}
}
