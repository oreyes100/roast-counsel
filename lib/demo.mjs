// Deliberately deterministic sample data, never a substitute for configured AI.
import {AppError} from './domain.mjs';
export const DEMO_BRIEF={
  decision:'¿Cómo lanzar mi consultoría de automatización con IA?',
  context:'Soy desarrollador independiente. Dos negocios conocidos mencionaron que dedican mucho tiempo a tareas administrativas, pero todavía no hay ventas ni validación de disposición a pagar.',
  resources:'40 horas disponibles durante las próximas dos semanas. Presupuesto máximo: US$300 para el piloto.',
  success:'Conseguir dos pilotos pagados y documentar al menos cinco horas de ahorro por semana en cada negocio.',
  constraints:'Sin contratar equipo. No comprometer pagos recurrentes antes de validar. Sólo datos autorizados por cada cliente.',
  deadline:'Dentro de 14 días',owner:'Responsable del proyecto',lean:'Me atrae construir un SaaS porque puede escalar.',
  options:[{label:'Construir un SaaS completo'},{label:'Ofrecer un piloto manual a dos negocios'},{label:'Mantener la situación actual'}],noActionId:'C',
  mode:'named',seats:['graham','martell','bezos','buffett'],weights:{graham:3,martell:2,bezos:2,buffett:2},scenarios:['budget','demand'],maxCalls:32,maxOutputTokens:2000
};
export class DemoProvider {
  async call({step,session:s,signal}) {
    await new Promise(resolve=>setTimeout(resolve,80));
    if(signal.aborted)throw new AppError('Consejo detenido.','CANCELLED',409);
    let data;
    if(step.startsWith('round')) {
      const [part,seat]=step.split('/'),round=Number(part.at(-1));
      const shift=seat==='buffett'?-1:seat==='graham'?1:0;
      data={seat,scores:{A:4+shift,B:8,C:5},risks:{A:{ruin:'possible',door:'one-way',reason:'Consumir horas sin validar demanda.'},B:{ruin:'none',door:'two-way',reason:'Piloto pequeño con límite de gasto.'},C:{ruin:'none',door:'two-way',reason:'Se conserva el presupuesto, pero se posterga aprender.'}},
        confidence:3,pillar:8,call:'Opción B: vender un piloto acotado antes de construir una plataforma.',
        reasons:[`${seat==='graham'?'Producto':seat==='buffett'?'Capital':seat==='martell'?'Ejecución':'Estrategia'}: el piloto permite aprender con una inversión reversible.`,
          'Las conversaciones iniciales son una señal, pero aún falta evidencia de pago.'],
        counterargument:'Un servicio manual puede consumir tiempo y no convertirse en un producto repetible.',changeMind:'Cambiaría si los negocios no aceptan un piloto pagado o el ahorro no se puede medir.',
        conditions:['No gastar más de US$300 antes de obtener dos pilotos.'],citations:[]};
      if(round>=2)Object.assign(data,{disagreesWith:'Cuestiono construir el SaaS ahora: aún no está claro qué trabajo quieren comprar los clientes.',concedes:'La escalabilidad importa; documentar lo repetible desde el primer piloto reduce trabajo futuro.',scenarios:s.brief.scenarios.map(id=>({id,response:id==='budget'?'Reducir a un solo piloto y mantener el límite de pérdida; revisar el segundo cuando haya cobro.':'Entrevistar a los dos negocios y detener la construcción si ninguno acepta pagar por el resultado.'}))});
      if(round===3)Object.assign(data,{vote:'endorse',support:8,amendment:'',mitigations:[]});
    }else if(step==='cruxes')data={cruxes:['¿Los negocios pagarían por el ahorro o sólo expresaron interés?','¿Se puede entregar el piloto en las 40 horas disponibles?']};
    else if(step==='draft')data={option:'B',recommendation:'Ejecutar dos pilotos manuales con alcance escrito antes de desarrollar un SaaS.',conditions:['No gastar más de US$300 antes de obtener dos pilotos.'],cheapestTest:'Presentar una oferta con precio y un resultado medible a los dos negocios.',killCriteria:'Detener el desarrollo si al día 7 ninguno acepta pagar por un piloto.'};
    else data={call:'Probar un servicio pequeño y pagado. La construcción del SaaS queda condicionada a demostrar demanda y una entrega repetible.',why:['El piloto mide disposición a pagar.','La inversión queda limitada a US$300.','Se aprende qué parte del trabajo merece automatizarse.'],minority:'El servicio puede limitar la escala. Es la objeción a resolver documentando cada paso y su tiempo real.',nextSteps:[{owner:s.brief.owner,when:'Días 1–3',action:'Presentar una oferta de piloto con precio, alcance y medición.'},{owner:s.brief.owner,when:'Día 7',action:'Revisar pagos confirmados antes de continuar el desarrollo.'}],cheapestTest:'Una propuesta y un pago de piloto antes de escribir la plataforma.',killCriteria:'Cero pilotos pagados al día 7 o más de US$300 comprometidos.',revisit:'Día 14, con pagos recibidos y horas ahorradas medidas.',amendments:[]};
    return {raw:JSON.stringify(data),usage:{input:0,output:0},truncated:false};
  }
}
