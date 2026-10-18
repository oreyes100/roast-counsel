const str={type:'string'},num={type:'number',minimum:0,maximum:10};
const arr=items=>({type:'array',items});
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function cardSchema(brief,round,key) {
  const risk=obj({ruin:{type:'string',enum:['none','possible','likely']},door:{type:'string',enum:['one-way','two-way']},reason:str});
  const properties={seat:{type:'string',enum:[key]},scores:obj(Object.fromEntries(brief.options.map(o=>[o.id,num]))),
    risks:obj(Object.fromEntries(brief.options.map(o=>[o.id,risk]))),confidence:{type:'number',minimum:1,maximum:5},pillar:num,call:str,reasons:arr(str),
    counterargument:str,changeMind:str,conditions:arr(str),citations:arr(obj({id:str,claim:str,quote:str}))};
  if(round>=2)Object.assign(properties,{disagreesWith:str,concedes:str,scenarios:arr(obj({id:{type:'string',enum:brief.scenarios},response:str}))});
  if(round===3)Object.assign(properties,{vote:{type:'string',enum:['endorse','amend','dissent']},support:num,amendment:str,mitigations:arr(obj({option:{type:'string',enum:brief.options.map(o=>o.id)},condition:str}))});
  return obj(properties);
}
export function chairSchema(kind,brief) {
  if(kind==='cruxes')return obj({cruxes:arr(str)});
  if(kind==='draft')return obj({option:{type:'string',enum:brief.options.map(o=>o.id)},recommendation:str,conditions:arr(str),cheapestTest:str,killCriteria:str});
  return obj({call:str,why:arr(str),minority:str,nextSteps:arr(obj({owner:str,when:str,action:str})),cheapestTest:str,killCriteria:str,revisit:str,amendments:arr(obj({seat:str,amendment:str}))});
}
