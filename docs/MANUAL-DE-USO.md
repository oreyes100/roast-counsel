# Roast Counsel / Roast Room — entrega e instrucciones de uso

Fecha: 17 de octubre de 2026, America/Mexico_City.

## Estado de la entrega

La web pública está disponible en https://roast.dineroorganizado.duckdns.org/ con certificado HTTPS válido y acceso por usuario y contraseña. La interfaz, los recursos estáticos y la API autenticada respondieron 200. Sin credenciales, responde 401: es el comportamiento esperado.

El motor está conectado a https://freellm.dineroorganizado.duckdns.org con **modelo `auto`**. La aplicación envía `model: "auto"` y el gateway decide qué motor utilizar por solicitud. Los asesores comparten esa configuración; no tienen un modelo fijado por separado. La conexión de producción está administrada desde el servidor y bloqueada para cambios desde el navegador.

**Límite pendiente:** el consejo sintético real llegó hasta la tercera ronda y el gateway respondió HTTP 502 en la llamada 7. Se reanudó desde el checkpoint, guardó otro paso y la llamada 9 terminó con HTTP 504. No es una demo: se recibieron y validaron respuestas reales antes del fallo. No hay evidencia todavía de un consejo real completo con su informe final. El portal HTTPS funciona; la aceptación completa de IA queda pendiente.

## Qué se construyó

- Webapp en español con formulario de decisión, consejo de asesores, debate, escenarios, votación y resolución.
- Adaptación de los siete packs de conocimiento y retratos de `nateherkai/roast-room`, fijados en el commit `f5e7b631a172ecc8ef5488760654ad37f24204b0`, conservando licencia y atribución.
- Backend Node.js sin dependencias npm de servidor; PDF generado en el navegador con jsPDF incluido en el proyecto.
- Contextos independientes por asesor, validación de JSON y fuentes, escalas y enumeraciones cerradas y cálculo determinista del veredicto.
- Historial persistente, puntos de recuperación, detención/reanudación y límites por sesión.
- Exportaciones Markdown, JSON y PDF cuando la sesión termina correctamente.
- Demo precalculada identificada como DEMO, sin llamadas de IA.
- Integración FreeLLMAPI, OpenAI y Anthropic; en este despliegue está activo FreeLLMAPI `auto`.
- Servicio systemd dedicado, estado privado fuera de Git y autenticación HTTP Basic en Nginx.
- Publicación del código en https://github.com/oreyes100/roast-counsel, rama `main`.

Los asesores son perspectivas simuladas inspiradas en marcos públicos; las personas no participan ni respaldan la aplicación.

## Primer acceso

1. Abre https://roast.dineroorganizado.duckdns.org/.
2. Introduce el usuario y la contraseña de la web en el diálogo de autenticación del navegador. Son credenciales de Nginx; no hay registro de cuentas en esta versión.
3. La pantalla principal debe mostrar «Nueva decisión» y «Abrir el consejo».
4. En «Conexión de IA» verás FreeLLMAPI y `auto`. No necesitas introducir una API key en el navegador.

La versión desplegada comparte un único espacio e historial entre quienes tengan las credenciales. Las sesiones se guardan en el VPS; no dependen del almacenamiento del navegador ni se guardan en el Mac por visitar la web.

## Cómo crear un wargame

1. Pulsa **Nueva decisión**.
2. Escribe una pregunta concreta: «¿Lanzar el producto ahora o validar primero con dos pilotos pagados?».
3. Explica el contexto: usuarios, problema, etapa actual, evidencia disponible y datos desconocidos.
4. Define entre **2 y 4 opciones** y señala cuál mantiene la situación actual.
5. Completa presupuesto, tiempo, equipo, éxito medible, responsable, plazo y restricciones.
6. Puedes indicar tu preferencia inicial. Se oculta a los asesores durante la primera ronda.
7. Selecciona al menos **dos escenarios**: presupuesto a la mitad, falta de demanda, competidor, dependencia que falla o decisión irreversible.
8. Elige modo, asesores y pesos. Usa peso 3 para uno o dos pilares decisivos; los demás pesos son 1 o 2.
9. Revisa «Límites de uso de IA» y pulsa **Abrir el consejo**.

Ejemplo de brief: presupuesto US$300, 40 horas durante 14 días, dos negocios contactados sin ventas confirmadas, objetivo de dos pilotos pagados y cinco horas de ahorro semanal por negocio. Opciones: construir un SaaS, vender pilotos manuales o mantener la situación actual. Estos datos son un ejemplo, no resultados comprobados.

## Modos y asesores

| Modo | Comportamiento |
|---|---|
| Personalizado | Entre 2 y 7 asesores elegidos por ti; tres rondas. |
| Rápido | Cuatro asesores; puede omitir ratificación sólo si cumple los controles de consenso y riesgo. |
| Completo | Los siete asesores y tres rondas. |

| Asesor simulado | Perspectiva |
|---|---|
| Jeff Bezos | Estrategia y reversibilidad |
| Paul Graham | Producto y problema del usuario |
| Alex Hormozi | Oferta, valor y ventas |
| Gary Vaynerchuk | Distribución |
| Dan Martell | Ejecución y tiempo |
| Gino Wickman | Operaciones |
| Warren Buffett | Capital y riesgo |

Para explorar la interfaz sin depender de los proveedores, usa **Explorar un ejemplo**. Su etiqueta DEMO significa que el resultado está precalculado y no prueba que el motor de IA esté disponible.

## Cómo leer el debate y el resultado

- **Ronda 1:** posiciones independientes; después se identifican los desacuerdos relevantes.
- **Ronda 2:** debate y respuestas a los escenarios; se prepara una propuesta.
- **Ronda 3:** ratificación, condiciones, enmiendas y disenso, salvo la excepción del modo rápido.
- El resultado calcula puntuación ponderada y compara pesos iguales; incorpora confianza subjetiva y controles de ruina/reversibilidad.
- Las salidas posibles son `GO`, `GO WITH CONDITIONS`, `RESHAPE` y `DON'T DO IT`.
- Una enmienda no se incorpora silenciosamente después de votar. Si cambia la opción líder, se pide reformular mediante `RESHAPE`.
- El plan incluye responsables, fechas, prueba más barata y criterios para detener o revisar la decisión. La aplicación no ejecuta esas acciones por ti.

Los tokens mostrados corresponden al uso informado por respuestas recibidas; no equivalen a una factura ni a un presupuesto en dinero. Los asesores y el enrutamiento `auto` no eliminan la necesidad de revisar la evidencia.

## Detener, reanudar e historial

- **Detener** aborta la solicitud activa y conserva el progreso. Una solicitud abortada puede haber consumido recursos en el proveedor.
- Abre una sesión desde **TUS SESIONES** para revisar sus rondas, actividad y errores.
- **Reanudar** continúa desde el punto pendiente y no vuelve a ejecutar los pasos completados.
- Sólo puede haber un consejo activo a la vez.
- Cada paso admite como máximo dos intentos, incluyendo reanudaciones. Un error de formato puede usar un intento de reparación; un error HTTP requiere reanudación manual.
- Si se agota el límite de intentos o llamadas, conserva la sesión para auditoría y crea una nueva cuando hayas corregido el problema.
- Después de un reinicio del servicio, una sesión en curso queda pausada; no se reanuda automáticamente.

El máximo por sesión admite 5–64 llamadas y 1000–4000 tokens de salida por respuesta. El valor predeterminado es 32 llamadas y 2000 tokens. El límite debe cubrir el modo elegido y sus posibles reparaciones; no es un saldo monetario.

## Exportaciones

Al completarse el veredicto se habilitan **PDF**, **Markdown** y **JSON**. Markdown facilita guardar el informe en Obsidian; JSON contiene entradas y resultados para auditoría; PDF sirve para compartir una lectura fija. Una sesión incompleta no ofrece un informe final como si hubiera terminado.

## Configuración de IA

La configuración efectiva de la aplicación incluye:

```dotenv
FREELLMAPI_URL=https://freellm.dineroorganizado.duckdns.org
FREELLMAPI_MODEL=auto
PUBLIC_ORIGIN=https://roast.dineroorganizado.duckdns.org
ROAST_CONFIG_LOCKED=true
PORT=4730
ROAST_DATA_DIR=/var/lib/roast-counsel/sessions
```

La línea `FREELLMAPI_API_KEY` ya existe en el archivo privado del servidor y debe conservarse. La clave no se devuelve en la API ni se incluye en Git o sesiones. También se ajustó el perfil local de Claude `roast-counsel` a `ANTHROPIC_MODEL=auto`; ese perfil es independiente de la webapp.

## Diagnóstico de errores

| Síntoma | Significado y acción |
|---|---|
| 401 antes de entrar | Introduce las credenciales web en el diálogo del navegador. |
| Error de certificado | Revisa dominio, certificado y vhost del proxy. No uses `curl -k` como prueba de aceptación. |
| 502 durante una ronda | El gateway no consiguió completar la generación. La sesión conserva sus pasos validados; espera a que el proveedor se recupere y usa Reanudar si quedan intentos. |
| 429 del proveedor | Cuota o límite de peticiones. Espera al restablecimiento de la cuota o revisa el gateway. |
| 503/504 | Indisponibilidad o tiempo agotado aguas arriba; conserva el checkpoint y revisa el gateway. |
| JSON, cita o escala rechazados | La respuesta no cumple el contrato. La app no la convierte en un veredicto válido; la reparación está limitada. |
| Reintentos agotados | El paso ya consumió sus dos intentos; crea otra sesión después de corregir el problema. |
| Token/origen inválido | Recarga la página desde el dominio público exacto e intenta de nuevo. |

`auto` selecciona el motor; no garantiza disponibilidad ilimitada ni elimina las cuotas. Los errores HTTP recibidos no permiten por sí solos saber qué proveedor interno falló.

## Verificaciones realizadas

- 33 pruebas locales y 33 pruebas en el VPS aprobadas para la revisión de código desplegada.
- Servicio activo, `/health` correcto y Node limitado a loopback.
- HTTPS público con el certificado del nombre correcto, válido hasta el 15 de enero de 2027 (fecha UTC).
- Petición anónima: 401; HTML y bootstrap autenticados: 200; FreeLLMAPI/modelo auto y clave oculta.
- Archivos JavaScript, CSS, icono, jsPDF y licencia accesibles con autenticación.
- Renovación ACME por cron y recarga de Nginx configuradas.
- Sitios principal de Dinero Organizado y FreeLLMAPI respondiendo 200 con HTTPS válido durante la comprobación.
- Consejo real de prueba: llegó a tercera ronda; primer fallo HTTP 502 en la llamada 7. Reanudación desde checkpoint comprobada, con otro paso guardado; fallo posterior HTTP 504 en la llamada 9. No completado.

No se cambió el NAT de pfSense ni la configuración de otros sitios. En la última conexión, el vhost y el certificado de Roast ya estaban instalados; se inspeccionaron y verificaron, sin atribuir su instalación a esta última intervención.

## Código y versiones

Repositorio: https://github.com/oreyes100/roast-counsel

- `b2fc3e8`: implementación inicial, integración FreeLLMAPI y despliegue.
- `0d32676`: contratos de salida y arranque mediante symlink.
- `5e08c509`: escalas numéricas y riesgos explícitos; revisión de aplicación desplegada.
- `14a3674` y `837106a`: documentación del estado y accesos verificados antes de resolverse HTTPS.

La revisión de aplicación en ejecución es `5e08c50917c5550e601096fe26cdd7e68a047572`; commits posteriores de documentación no implican cambio de servicio. No hay despliegue automático recurrente instalado.
