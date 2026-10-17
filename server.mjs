import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {AppError,SEATS,SCENARIOS,UPSTREAM,validateBrief} from './lib/domain.mjs';
import {Knowledge} from './lib/knowledge.mjs';
import {Provider,normalizeConfig} from './lib/provider.mjs';
import {Store} from './lib/store.mjs';
import {Engine} from './lib/engine.mjs';
import {DemoProvider,DEMO_BRIEF} from './lib/demo.mjs';
import {reportMarkdown} from './lib/report.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  const p=path.join(ROOT,'.env');if(!fs.existsSync(p))return;
  for(const line of fs.readFileSync(p,'utf8').split('\n')) {
    const m=line.match(/^([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
  }
}
export function createApp({dataDir=process.env.ROAST_DATA_DIR||path.join(ROOT,'data/sessions'),fetchFn,providerFactory,publicOrigin=process.env.PUBLIC_ORIGIN||'',configLocked=process.env.ROAST_CONFIG_LOCKED==='true'}={}) {
  if(publicOrigin){const u=new URL(publicOrigin);if(u.origin!==publicOrigin||u.protocol!=='https:')throw new Error('PUBLIC_ORIGIN debe ser un origen HTTPS exacto.');}
  const store=new Store(dataDir),knowledge=new Knowledge(path.join(ROOT,'knowledge/brains'));
  const csrf=randomBytes(24).toString('hex');
  let config={provider:process.env.ANTHROPIC_API_KEY&&!process.env.OPENAI_API_KEY?'anthropic':'openai',
    model:process.env.OPENAI_MODEL||'gpt-4o-mini',apiKey:process.env.OPENAI_API_KEY||process.env.ANTHROPIC_API_KEY||''};
  if(config.provider==='anthropic')config.model=process.env.ANTHROPIC_MODEL||'';
  if(process.env.FREELLMAPI_API_KEY)config={provider:'freellmapi',model:process.env.FREELLMAPI_MODEL||'auto',apiKey:process.env.FREELLMAPI_API_KEY,baseURL:process.env.FREELLMAPI_URL||'https://freellm.dineroorganizado.duckdns.org'};
  const engine=new Engine(store,knowledge,{providerFactory:(c,s)=>s.demo?new DemoProvider():providerFactory?providerFactory(c,s):new Provider(c,{fetchFn})});
  function send(res,status,value,type='application/json; charset=utf-8',extra={}) {
    res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff',
      'referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",...extra});
    res.end(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value));
  }
  async function body(req) {
    const chunks=[];let size=0;
    for await(const chunk of req) {size+=chunk.length;if(size>64000)throw new AppError('La solicitud es demasiado grande.','TOO_LARGE',413);chunks.push(chunk);}
    try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch {throw new AppError('JSON inválido.');}
  }
  const server=http.createServer(async(req,res)=>{
    try {
      const port=server.address()?.port;
      const hosts=[`127.0.0.1:${port}`,`localhost:${port}`,...(publicOrigin?[new URL(publicOrigin).host]:[])];
      if(!hosts.includes(req.headers.host))throw new AppError('Host no permitido.','HOST',403);
      const origin=publicOrigin||`http://${req.headers.host}`,url=new URL(req.url,origin),p=url.pathname;
      if(req.headers['sec-fetch-site']==='cross-site')throw new AppError('Acceso entre sitios no permitido.','ORIGIN',403);
      if(p.startsWith('/api/')&&!['GET','HEAD'].includes(req.method)) {
        if(req.headers.origin!==origin||req.headers['x-roast-token']!==csrf)throw new AppError('Vuelve a cargar la página para autorizar esta acción local.','CSRF',403);
        if(!String(req.headers['content-type']).startsWith('application/json'))throw new AppError('Se requiere JSON.','CONTENT_TYPE',415);
      }
      if(p==='/health'&&req.method==='GET')return send(res,200,{status:'ok',version:'0.2.0'});
      if(p==='/api/bootstrap'&&req.method==='GET')return send(res,200,{csrf,seats:SEATS,scenarios:SCENARIOS,upstream:UPSTREAM,
        config:{provider:config.provider,model:config.model,hasKey:Boolean(config.apiKey),locked:configLocked,baseURL:config.baseURL||null},sessions:store.list(),active:engine.active?.id||null,demoBrief:DEMO_BRIEF});
      if(p==='/api/config'&&req.method==='POST') {
        if(configLocked)throw new AppError('La conexión está administrada por el servidor.','CONFIG_LOCKED',403);
        if(engine.active)throw new AppError('Espera o detén el consejo antes de cambiar la configuración.','BUSY',409);
        config=normalizeConfig(await body(req),config);return send(res,200,{provider:config.provider,model:config.model,hasKey:true,locked:configLocked,baseURL:config.baseURL||null});
      }
      if(p==='/api/sessions'&&req.method==='GET')return send(res,200,{sessions:store.list(),active:engine.active?.id||null});
      if((p==='/api/sessions'||p==='/api/demo')&&req.method==='POST') {
        if(engine.active)throw new AppError('Ya hay un consejo en curso.','BUSY',409);
        const demo=p==='/api/demo',data=await body(req);
        const c=demo?{provider:'demo',model:'ejemplo-precalculado'}:normalizeConfig({...config},config);
        const brief=validateBrief(demo?DEMO_BRIEF:data);
        const s=store.create(brief,c,knowledge,{demo});engine.start(s,c);return send(res,201,{id:s.id});
      }
      const match=p.match(/^\/api\/sessions\/([a-f0-9-]{36})(?:\/(resume|stop|report|export))?$/);
      if(match) {
        const s=store.get(match[1]),action=match[2];
        if(req.method==='GET'&&!action)return send(res,200,s);
        if(req.method==='POST'&&action==='resume') {
          const c=s.demo?{provider:'demo',model:'ejemplo-precalculado'}:normalizeConfig({...config},config);
          engine.start(s,c);return send(res,202,{id:s.id,status:s.status});
        }
        if(req.method==='POST'&&action==='stop') {engine.cancel(s.id);return send(res,202,{status:'STOPPING'});}
        if(req.method==='GET'&&['report','export'].includes(action)) {
          if(s.status!=='COMPLETE')throw new AppError('La sesión todavía está incompleta.','INCOMPLETE',409);
          return action==='report'?send(res,200,reportMarkdown(s),'text/markdown; charset=utf-8',{'content-disposition':`attachment; filename="roast-room-${s.id}.md"`}):
            send(res,200,JSON.stringify(s,null,2),'application/json; charset=utf-8',{'content-disposition':`attachment; filename="roast-room-${s.id}.json"`});
        }
      }
      if(p.startsWith('/api/'))throw new AppError('Ruta no encontrada.','NOT_FOUND',404);
      if(req.method!=='GET'&&req.method!=='HEAD')throw new AppError('Método no permitido.','METHOD',405);
      const publicDir=path.join(ROOT,'public');
      let file=p==='/upstream-license'?path.join(ROOT,'UPSTREAM-LICENSE'):path.resolve(publicDir,'.'+decodeURIComponent(p==='/'?'/index.html':p));
      if(p!=='/upstream-license'&&!file.startsWith(publicDir+path.sep))throw new AppError('Ruta no permitida.','PATH',403);
      if(!fs.existsSync(file)||!fs.statSync(file).isFile())throw new AppError('Archivo no encontrado.','NOT_FOUND',404);
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
      return send(res,200,req.method==='HEAD'?'':fs.readFileSync(file),types[path.extname(file)]||'text/plain; charset=utf-8');
    }catch(e) {send(res,e instanceof AppError?e.status:500,{error:e instanceof AppError?e.message:'Error interno. La sesión guardada permanece disponible.',code:e.code||'INTERNAL'});}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  return {server,store,engine,knowledge};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  loadEnv();
  const app=createApp(),port=Number(process.env.PORT)||4730;
  app.server.listen(port,'127.0.0.1',()=>console.log(`Roast Room: http://127.0.0.1:${port}`));
  app.server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`El puerto ${port} está ocupado. Usa PORT=4731 npm start.`:'No se pudo iniciar el servidor local.');process.exitCode=1;});
}
