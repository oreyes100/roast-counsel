# Roast Room · Wargame con IA

Webapp en español para someter una decisión a distintas perspectivas, debatir escenarios y producir una resolución con condiciones, disenso y próximos pasos. Reutiliza los siete packs de conocimiento y retratos de [nateherkai/roast-room](https://github.com/nateherkai/roast-room/tree/f5e7b631a172ecc8ef5488760654ad37f24204b0); el servidor, la interfaz y el motor de validación de esta adaptación están en esta carpeta.

La web alojada está en https://roast.dineroorganizado.duckdns.org/ y requiere las credenciales del propietario. Consulta el [manual de uso](docs/MANUAL-DE-USO.md) y el [estado verificado de la entrega](docs/RELEASE-STATUS.md).

## Ejecutar

Requiere Node.js 20 o superior. No necesita instalar dependencias.

```bash
git clone https://github.com/oreyes100/roast-counsel.git
cd roast-counsel
npm start
```

Abre [Roast Room local](http://127.0.0.1:4730). Si el puerto está ocupado: `PORT=4731 npm start`.

En **Conexión de IA**, elige FreeLLMAPI, OpenAI o Anthropic, introduce un modelo habilitado en tu cuenta y tu API key. La clave se mantiene únicamente en la memoria del servidor y se elimina al reiniciar. Guardar la conexión no consulta al proveedor. **Abrir el consejo** inicia las llamadas de IA y el proveedor puede cobrarlas. El brief y los fragmentos seleccionados del pack se transmiten al proveedor elegido.

FreeLLMAPI usa el gateway HTTPS configurado y el modelo `auto`, comprobado contra su catálogo. El proveedor se selecciona automáticamente si `FREELLMAPI_API_KEY` está configurada. En producción, la conexión está bloqueada para cambios desde el navegador.

OpenAI usa por defecto el ID configurable `gpt-4o-mini`. Para Anthropic introduce el ID de un modelo disponible en tu cuenta. El acceso y la disponibilidad dependen del proveedor. Esta aplicación no consume tu sesión de ChatGPT o Claude Code.

También puedes copiar `.env.example` a `.env` dentro de esta carpeta y configurar las variables de proveedor indicadas en esa plantilla y `PORT`. No uses las claves de Binance de VaultSignals para esta app. No compartas `.env` ni lo añadas a Git.

**Explorar un ejemplo** ejecuta una demostración precalculada sin IA ni coste. La etiqueta DEMO permanece en la sesión, el informe y el PDF. Nunca se utiliza como reemplazo automático de una conexión real fallida.

## Flujo implementado

- Brief con 2–4 opciones, alternativa de mantener la situación actual, datos conocidos, restricciones, responsable, éxito medible y plazo.
- Consejo completo de siete voces, personalizado de 2–7, o rápido con exactamente cuatro. Pesos 1–3; uno o dos pilares tienen peso 3.
- Posiciones independientes: cada solicitud tiene sólo su pack y el brief sin la preferencia inicial. Las solicitudes se ejecutan secuencialmente con contextos separados; comparten el modelo, no una conversación.
- Identificación de desacuerdos y defensa obligatoria de una alternativa por dos asesores cuando hay unanimidad.
- Debate con al menos dos escenarios hipotéticos. Sus consecuencias se muestran separadas de los hechos originales.
- Borrador explícito y ratificación con respaldo, enmienda o disenso. El modo rápido omite el voto sólo si hay datos completos, dispersión ≤3 y ningún riesgo de ruina probable observado.
- Veredicto calculado con ponderación, comparación con pesos iguales, confianza subjetiva, apoyo a la resolución y controles deterministas de ruina/reversibilidad. El modelo no puede reemplazar estas cifras o controles.
- Historial local, detalle por asesor/ronda, cancelación, reanudación, exportaciones Markdown/JSON y PDF generado localmente con jsPDF.

Las enmiendas se registran para una nueva resolución; no se adoptan silenciosamente después de votar. Si cambia la opción líder durante la ratificación, el resultado se limita a RESHAPE para pedir una nueva resolución. Las condiciones ratificadas se conservan en el informe.

## Límites y recuperación

Cada sesión tiene un máximo total de llamadas y un máximo de tokens por respuesta. Se reserva y guarda cada llamada antes de enviarla. Un error de formato permite hasta dos solicitudes de corrección durante esa ejecución. Las citas son opcionales: si la fuente pertenece al pack pero el texto literal no coincide, se elimina el texto y se conserva sólo como referencia registrada; una fuente ajena al pack se omite. La interfaz y los informes muestran estos avisos. Ante un error temporal de red o del gateway, la app hace hasta dos reintentos con espera de 5 y 15 segundos; cada uno cuenta contra el límite total. Si el proveedor sigue fallando, el paso queda guardado para reanudar la misma sesión. Las reanudaciones no repiten pasos completados ni requieren crear otro brief. Los errores 502/503/504 identifican la indisponibilidad o el timeout sin mostrar la respuesta interna del proveedor.

La app permite un consejo activo a la vez. Detener aborta la solicitud activa y conserva el progreso. Una llamada abortada o fallida puede haber sido cobrada sin devolver uso. Los tokens mostrados son los reportados por respuestas recibidas, no un estado de cuenta. El límite de llamadas no es un presupuesto monetario; revisa tarifas y límites en tu cuenta.

Los archivos están en `data/sessions/<UUID>/`, fuera de Git. Se guardan mediante archivo temporal y renombrado, con permisos privados. Cada sesión tiene un UUID incluso si repites título y fecha. Si el proceso se reinicia, las sesiones en curso quedan pausadas. Para reanudar una sesión real configura el mismo proveedor/modelo; el hash de sus packs debe coincidir. No hay reanudación automática que genere gastos al arrancar.

`session.json` es el registro canónico de la app. Las exportaciones de sesión incluyen sus inputs y tarjetas para poder auditarlas. Sólo se crean informes finales y `verdict.json` tras completar las validaciones. Las carpetas completas también incluyen los archivos Markdown/JSON que entiende el visor de upstream; este adaptador no instala sus agentes de Claude ni ejecuta comandos de ese host.

## Referencias, privacidad y alcance

Los asesores son simulaciones inspiradas en obras públicas. No representan a las personas, ni existe afiliación o respaldo. Las referencias se comprueban contra el registro de cada pack y las citas literales contra un fragmento con el mismo ID. Los textos completos primarios no vienen en el repo y no se descargan: la comprobación local no prueba que la publicación primaria sea correcta ni que la recomendación lo sea. Las paráfrasis quedan identificadas como referencias registradas.

El servidor escucha únicamente en `127.0.0.1`, comprueba Host/Origin, usa un token para mutaciones y sirve el frontend con CSP. Las claves no se devuelven al navegador ni se escriben en sesiones. El despliegue web usa HTTPS y autenticación en Nginx; configura `PUBLIC_ORIGIN` con el origen exacto y conserva Node en loopback. La conexión puede administrarse con un archivo privado de entorno y bloquearse con `ROAST_CONFIG_LOCKED=true`. El software no ingiere archivos personales ni ejecuta las acciones de negocio propuestas por la IA. Consulta [el despliegue](docs/DEPLOYMENT.md).

Esta primera implementación ofrece decisiones `GO`, `GO WITH CONDITIONS`, `RESHAPE` y `DON'T DO IT`; las dependencias pendientes se expresan como condiciones o RESHAPE. El modo consult de un solo asesor y la etiqueta WAIT del protocolo original quedan fuera de esta interfaz. No se han realizado pruebas de mercado ni se declara validada la mejora de calidad frente a un prompt simple.

## Verificación

```bash
npm test
```

Las pruebas usan fixtures y respuestas simuladas, sin API keys reales ni llamadas de pago. Cubren contratos OpenAI/Anthropic, atribución por fuente, puntuaciones incompletas, votos ausentes, límites, ruina/reversibilidad, aislamiento de preferencias, fallos, reanudación, unicidad, origen y persistencia sin secretos. La inspección de navegador verifica la demo, el detalle de asesores, las vistas de escritorio/móvil y el PDF. El gateway FreeLLMAPI también se verifica con una prueba JSON autenticada; el registro de release distingue pruebas simuladas, consejos sintéticos reales y comprobaciones de HTTPS.

El [wargame de release](docs/RELEASE-WARGAME.md) recoge las puertas de publicación. Los registros privados de verificación y las sesiones no se publican en este repositorio.

## Atribución

Código y packs de referencia upstream: AI Automation Society, commit `f5e7b631a172ecc8ef5488760654ad37f24204b0`. Consulta `UPSTREAM-LICENSE`; las citas de los packs pertenecen a sus autores. Retratos reutilizados del mismo proyecto. PDF: jsPDF, licencia MIT conservada en `public/vendor/jspdf-LICENSE.txt`. No se cargan recursos de CDNs ni tipografías externas.

API references used for this adapter: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat) and [Anthropic Messages](https://docs.anthropic.com/en/api/messages).
