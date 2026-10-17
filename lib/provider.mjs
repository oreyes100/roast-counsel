import {AppError,ensure,text} from './domain.mjs';
export function normalizeConfig(input,previous={}) {
  ensure(['openai','anthropic','freellmapi'].includes(input.provider),'Proveedor no compatible.');
  const model=text(input.model,'Modelo',100);
  ensure(/^[a-zA-Z0-9_.:/-]+$/.test(model),'Identificador de modelo inválido.');
  let apiKey=input.apiKey;
  if(!apiKey)apiKey=previous.provider===input.provider?previous.apiKey:'';
  ensure(typeof apiKey==='string'&&apiKey.length>=8&&apiKey.length<=500&&!/\s/.test(apiKey),'Introduce una API key válida.');
  const out={provider:input.provider,model,apiKey};
  if(input.provider==='freellmapi')out.baseURL=gatewayURL(previous.baseURL||'https://freellm.dineroorganizado.duckdns.org');
  return out;
}
export function gatewayURL(value) {
  let u;try{u=new URL(value);}catch{throw new AppError('La URL del gateway no es válida.');}
  ensure(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash,'FreeLLMAPI requiere una URL HTTPS sin credenciales ni parámetros.');
  ensure(u.pathname==='/'||u.pathname==='/v1'||u.pathname==='/v1/','La URL del gateway debe apuntar a la raíz o /v1.');
  return u.origin;
}
export function parseJSON(raw) {
  try { return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')); }
  catch {throw new AppError('La IA devolvió JSON inválido. Se puede reintentar.','MODEL_OUTPUT',502);}
}
export class Provider {
  constructor(config,{fetchFn=globalThis.fetch}={}) {this.config={...config};this.fetch=fetchFn;}
  async call({system,prompt,maxOutputTokens,signal}) {
    ensure(system.length+prompt.length<=70000,'El contexto supera el límite por llamada. Reduce el brief.');
    const {provider,apiKey,model}=this.config;
    ensure(apiKey,'Configura una API key antes de iniciar.');
    const anthropic=provider==='anthropic';
    const body=anthropic?{model,max_tokens:maxOutputTokens,system,messages:[{role:'user',content:prompt}]}:
      {model,max_completion_tokens:maxOutputTokens,response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'user',content:prompt}]};
    const headers={'content-type':'application/json',...(anthropic?{'x-api-key':apiKey,'anthropic-version':'2023-06-01'}:{authorization:`Bearer ${apiKey}`})};
    let response;
    try {
      const endpoint=provider==='freellmapi'?`${gatewayURL(this.config.baseURL)}/v1/chat/completions`:anthropic?'https://api.anthropic.com/v1/messages':'https://api.openai.com/v1/chat/completions';
      response=await this.fetch(endpoint,{
        method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.any([signal??new AbortController().signal,AbortSignal.timeout(90000)])
      });
    } catch(e) {
      if(signal?.aborted)throw new AppError('Consejo detenido.','CANCELLED',409);
      throw new AppError('No se pudo conectar con la IA o se agotó el tiempo. Revisa la conexión y reanuda.','PROVIDER_NETWORK',502);
    }
    if(!response.ok) {
      // Never reflect provider errors, which can contain credentials or private input.
      const reason=response.status===401||response.status===403?'Revisa la API key y el acceso al modelo.':response.status===429?'Límite de uso del proveedor. Espera antes de reanudar.':'Revisa el modelo y la disponibilidad del proveedor.';
      throw new AppError(`IA respondió HTTP ${response.status}. ${reason}`,'PROVIDER_HTTP',502);
    }
    let data;
    try {data=await response.json();}catch {throw new AppError('Respuesta ilegible del proveedor.','PROVIDER_RESPONSE',502);}
    const raw=anthropic?(data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join(''):data.choices?.[0]?.message?.content;
    ensure(typeof raw==='string','El modelo no devolvió texto.');
    const usage=anthropic?{input:data.usage?.input_tokens??0,output:data.usage?.output_tokens??0}:
      {input:data.usage?.prompt_tokens??0,output:data.usage?.completion_tokens??0};
    if(data.stop_reason==='max_tokens'||data.choices?.[0]?.finish_reason==='length')
      return {raw,usage,truncated:true};
    return {raw,usage,truncated:false};
  }
}
