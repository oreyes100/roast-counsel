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
