import test from 'node:test';
import assert from 'node:assert/strict';
import {Provider,normalizeConfig,gatewayURL} from '../lib/provider.mjs';
test('OpenAI request uses server key and JSON mode, parses output and usage',async()=>{
  const p=new Provider({provider:'openai',model:'test',apiKey:'secret-key'},{fetchFn:async(url,init)=>{
    assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(init.headers.authorization,'Bearer secret-key');
    const b=JSON.parse(init.body);assert.equal(b.max_completion_tokens,1500);assert.equal(b.response_format.type,'json_object');
    return Response.json({choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}],usage:{prompt_tokens:40,completion_tokens:10}});
  }});
  const result=await p.call({system:'system',prompt:'data',maxOutputTokens:1500});assert.equal(result.raw,'{"ok":true}');assert.equal(result.usage.input,40);
});
test('Anthropic uses fixed endpoint and detects output truncation',async()=>{
  const p=new Provider({provider:'anthropic',model:'test',apiKey:'secret-key'},{fetchFn:async(url,init)=>{
    assert.equal(url,'https://api.anthropic.com/v1/messages');assert.equal(init.headers['x-api-key'],'secret-key');
    return Response.json({content:[{type:'text',text:'{}'}],stop_reason:'max_tokens',usage:{input_tokens:40,output_tokens:1000}});
  }});
  assert((await p.call({system:'system',prompt:'data',maxOutputTokens:1000})).truncated);
});
test('provider error bodies cannot leak secrets',async()=>{
  const p=new Provider({provider:'openai',model:'test',apiKey:'secret-key'},{fetchFn:async()=>new Response('secret-key private brief',{status:401})});
  await assert.rejects(p.call({system:'',prompt:'',maxOutputTokens:1000}),e=>!e.message.includes('secret-key')&&!e.message.includes('private brief')&&e.message.includes('401'));
});
test('configuration never reuses another provider key and disallows whitespace/model injection',()=>{
  assert.throws(()=>normalizeConfig({provider:'anthropic',model:'test',apiKey:''},{provider:'openai',apiKey:'secret-key'}));
  assert.throws(()=>normalizeConfig({provider:'openai',model:'test',apiKey:'key with spaces'}));
  assert.equal(normalizeConfig({provider:'openai',model:'test'},{provider:'openai',apiKey:'secret-key'}).apiKey,'secret-key');
});
test('FreeLLMAPI uses the configured HTTPS gateway and unified Bearer key',async()=>{
  const p=new Provider({provider:'freellmapi',baseURL:'https://gateway.example/v1',model:'auto',apiKey:'unified-secret'},{fetchFn:async(url,init)=>{
    assert.equal(url,'https://gateway.example/v1/chat/completions');assert.equal(init.headers.authorization,'Bearer unified-secret');
    assert.equal(JSON.parse(init.body).model,'auto');return Response.json({choices:[{message:{content:'{}'},finish_reason:'stop'}],usage:{prompt_tokens:3,completion_tokens:2}});
  }});assert.equal((await p.call({system:'JSON',prompt:'test',maxOutputTokens:1000})).raw,'{}');
});
test('gateway URL rejects credential-bearing URLs, insecure HTTP and paths',()=>{
  for(const u of ['http://gateway.example','https://key@gateway.example','https://gateway.example/other','https://gateway.example?key=abc'])assert.throws(()=>gatewayURL(u));
  const c=normalizeConfig({provider:'freellmapi',model:'auto',apiKey:'unified-secret',baseURL:'https://attacker.example'},{baseURL:'https://gateway.example'});
  assert.equal(c.baseURL,'https://gateway.example');
});
test('structured requests require the supplied schema instead of relying on JSON prose',async()=>{
  const schema={type:'object',properties:{ready:{type:'boolean'}},required:['ready'],additionalProperties:false};
  const p=new Provider({provider:'freellmapi',baseURL:'https://gateway.example',model:'auto',apiKey:'unified-secret'},{fetchFn:async(_url,init)=>{
    const b=JSON.parse(init.body);assert.equal(b.response_format.type,'json_schema');assert.equal(b.response_format.json_schema.strict,true);assert.deepEqual(b.response_format.json_schema.schema,schema);
    return Response.json({choices:[{message:{content:'{"ready":true}'},finish_reason:'stop'}]});
  }});await p.call({system:'JSON',prompt:'test',maxOutputTokens:1000,schema});
});

const gatewayConfig={provider:'freellmapi',baseURL:'https://gateway.example/v1',model:'auto',apiKey:'unified-secret'};
const callInput={system:'JSON',prompt:'technical test',maxOutputTokens:1000};
function rejectOnAbort(signal) {
  return new Promise((_resolve,reject)=>{
    const guard=setTimeout(()=>reject(new Error('Abort was not propagated')),1000);
    const abort=()=>{clearTimeout(guard);reject(signal.reason);};
    if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  });
}
test('auto gateway has room for fallback while other providers retain their deadline',async()=>{
  assert.equal(new Provider(gatewayConfig).requestTimeoutMs,300000);
  assert.equal(new Provider({provider:'openai'}).requestTimeoutMs,90000);
  const p=new Provider(gatewayConfig,{requestTimeoutMs:200,fetchFn:async(_url,{signal,body})=>{
    await new Promise(r=>setTimeout(r,40));assert.equal(signal.aborted,false);assert.equal(JSON.parse(body).model,'auto');
    return Response.json({choices:[{message:{content:'{"ready":true}'},finish_reason:'stop'}]});
  }});
  assert.equal((await p.call(callInput)).raw,'{"ready":true}');
});
test('a stalled gateway before headers is aborted with a bounded timeout',async()=>{
  const p=new Provider(gatewayConfig,{requestTimeoutMs:20,fetchFn:async(_url,{signal})=>rejectOnAbort(signal)});
  await assert.rejects(p.call(callInput),e=>e.code==='PROVIDER_TIMEOUT'&&e.status===504);
});
test('deadline also covers a stalled response body after successful headers',async()=>{
  const p=new Provider(gatewayConfig,{requestTimeoutMs:20,fetchFn:async(_url,{signal})=>({ok:true,json:()=>rejectOnAbort(signal)})});
  await assert.rejects(p.call(callInput),e=>e.code==='PROVIDER_TIMEOUT');
});
test('owner cancellation during body reading is preserved as cancellation',async()=>{
  const owner=new AbortController();
  const p=new Provider(gatewayConfig,{requestTimeoutMs:500,fetchFn:async(_url,{signal})=>{
    setTimeout(()=>owner.abort(),10);return {ok:true,json:()=>rejectOnAbort(signal)};
  }});
  await assert.rejects(p.call({...callInput,signal:owner.signal}),e=>e.code==='CANCELLED'&&e.status===409);
});
test('a gateway504 explains timeout and checkpoint recovery without leaking its body',async()=>{
  const p=new Provider(gatewayConfig,{fetchFn:async()=>new Response('unified-secret private brief',{status:504})});
  await assert.rejects(p.call(callInput),e=>e.code==='PROVIDER_HTTP'&&e.message.includes('504')&&e.message.includes('tiempo de espera')&&!e.message.includes('unified-secret')&&!e.message.includes('private brief'));
});
test('gateway502 and503 identify temporary route unavailability without exposing provider details',async()=>{
  for(const status of [502,503]) {
    const p=new Provider(gatewayConfig,{fetchFn:async()=>new Response('unified-secret private brief',{status})});
    await assert.rejects(p.call(callInput),e=>e.code==='PROVIDER_HTTP'&&e.message.includes(String(status))&&e.message.includes('ruta disponible')&&!e.message.includes('unified-secret')&&!e.message.includes('private brief'));
  }
});
