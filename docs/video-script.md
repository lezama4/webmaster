# Guion de vídeo de presentación — Vivetutiempo

**Formato:** screencast con narración en primera persona  
**Duración objetivo:** 9 minutos y 30 segundos  
**Criterio de evidencia:** separar siempre lo implementado y revisado de lo que está en progreso o planificado. No presentar como verde, desplegado o transaccionalmente verificado aquello que no tenga una ejecución reproducible asociada al momento de grabar.

## Preparación antes de grabar

Tener abiertas, por este orden:

1. Una portada simple con título, autor, máster y fecha.
2. El explorador de archivos en la raíz del repositorio.
3. La carpeta openspec/changes/bootstrap-vivetutiempo-platform/.
4. src/domain/slot/acceptProposal.ts.
5. src/application/ports/MatchingUnitOfWork.ts y el caso de uso de aprobación.
6. Las carpetas tests/unit/domain/ y tests/unit/application/.
7. docs/security-threat-model.md y la carpeta reviews/.
8. La aplicación local o desplegada sólo si el flujo completo está realmente disponible y verificado.

Grabo a 1080p, con fuente ampliada y sin notificaciones. Oculto archivos .env, secretos, correos reales y rutas personales. Utilizo únicamente datos ficticios de demostración.

---

## 1. Presentación y problema

**Tiempo estimado:** 0:00–0:55

### Qué digo

“Soy [nombre] y presento Vivetutiempo, mi Trabajo de Fin de Máster. Es una plataforma web sin ánimo de lucro para coordinar actividades culturales en hospitales.

Parto de un problema muy concreto: pacientes y familiares pasan periodos de espera, acompañamiento o recuperación que pueden ser largos. Existen iniciativas culturales valiosas, pero el reto técnico no es sólo publicar una actividad. Es coordinar de forma segura y trazable la agenda de un Hospital, las propuestas de artistas y la información que llega al público.

Vivetutiempo no gestiona historias clínicas ni pretende sustituir sistemas sanitarios. Se centra en el flujo de coordinación cultural y minimiza los datos que expone en un contexto hospitalario.”

### Qué muestro

- Portada con el título, nombre, máster y fecha.
- Diagrama sencillo: Hospital → Artista → Evento → Paciente/Familiar.
- No muestro código todavía.

### Transición

“A continuación explico el flujo central y el alcance real del MVP.”

---

## 2. Solución, roles y alcance

**Tiempo estimado:** 0:55–1:55

### Qué digo

“La plataforma trabaja con cuatro roles. El Hospital publica huecos de agenda, el Artista propone actividades, el Administrador valida perfiles y modera, y el Paciente o familiar consulta eventos publicados.

El núcleo funciona así: un Hospital activo publica un hueco; varios artistas pueden competir con propuestas; el Hospital propietario escoge una; y esa aceptación crea un evento publicado. La consulta de eventos es pública y no requiere iniciar sesión.

He dividido el producto en tres bloques. El bloque uno es el núcleo de coordinación. El bloque dos añadirá valoraciones después de que un evento se complete. El bloque tres modelará mecenazgo de forma simulada detrás de un puerto, sin procesar pagos reales. Esta secuencia prioriza terminar un flujo completo antes de ampliar funcionalidades.”

### Qué muestro

- proposal.md con los roles, el alcance y los bloques.
- Diagrama de flujo: Hospital publica Slot → Artistas proponen → Hospital decide → Evento publicado → Consulta pública.
- Resalto Block 1: Core y marco Blocks 2 y 3 como planificados.

### Transición

“Para que este flujo no dependa de pantallas o de una base de datos concreta, organicé el proyecto con arquitectura hexagonal.”

---

## 3. Recorrido por el repositorio y arquitectura hexagonal

**Tiempo estimado:** 1:55–3:05

### Qué digo

“Este es el repositorio. La solución es un monolito con Next.js y TypeScript, pero organizado en capas con dependencias hacia dentro.

En domain están las reglas puras: entidades, máquinas de estado e invariantes. En application están los casos de uso y los puertos que expresan lo que necesito de persistencia, sesiones o tiempo. La infraestructura y la interfaz implementan o consumen esos contratos; en este corte del vídeo las presento como trabajo en progreso cuando no haya evidencia verificable.

La decisión de monolito es deliberada. Para este MVP, microservicios o Kubernetes añadirían complejidad operativa sin resolver una necesidad actual. La arquitectura hexagonal aporta separación y testabilidad sin distribuir prematuramente el sistema.”

### Qué muestro

- Árbol de carpetas: src/domain, src/application, src/infrastructure, src/ui y src/app.
- src/domain/README.md, destacando que el dominio no importa Next.js, Prisma, HTTP ni infraestructura.
- src/application/README.md, destacando los puertos y los casos de uso.
- Esquema superpuesto: UI/Next.js → Application → Domain, con Infrastructure como adaptadores.

### Transición

“La ventaja de este diseño se ve especialmente bien en la regla de negocio más crítica del proyecto.”

---

## 4. Invariante clave y concurrencia lock-first

**Tiempo estimado:** 3:05–4:20

### Qué digo

“El invariante central es aceptar una propuesta. No es una simple actualización de estado. Si el Hospital propietario acepta una propuesta enviada sobre un hueco abierto, ocurren cuatro cosas: la propuesta se acepta, el hueco se llena, las propuestas competidoras pendientes se rechazan y se crea un evento publicado.

Aquí muestro la operación pura acceptProposal. No conoce Prisma, HTTP ni Next.js; recibe un hueco y todas sus propuestas, valida propiedad y estados, y calcula un resultado coherente.

La concurrencia añade un segundo requisito. No basta con decidir en memoria: una propuesta podría llegar mientras se aprueba otra. Por eso el contrato withLockedSlot exige bloquear primero el hueco, leer dentro de la transacción los datos vivos, ejecutar la decisión y persistir antes de confirmar.

La semántica está implementada en dominio y aplicación. La demostración de bloqueo real, índices parciales y reversión transaccional debe apoyarse en pruebas de integración reproducibles; no la presentaré como verificada hasta que esas pruebas se ejecuten en CI.”

### Qué muestro

- src/domain/slot/acceptProposal.ts:
  - comprobación de propiedad;
  - aceptación de la propuesta elegida;
  - rechazo de rivales;
  - creación y publicación del evento.
- src/application/ports/MatchingUnitOfWork.ts:
  - bloqueo primero;
  - snapshot vivo;
  - persistencia antes de confirmar.
- design.md, ADR D4, señalando la carrera que motivó este rediseño.

### Transición

“Esta decisión no apareció por intuición: procede de un proceso guiado por especificaciones y de revisiones independientes.”

---

## 5. Proceso: SDD, IA dirigida y revisión adversarial

**Tiempo estimado:** 4:20–5:15

### Qué digo

“He seguido un proceso de desarrollo guiado por especificaciones. Primero defino la propuesta y el alcance; después describo escenarios de comportamiento; transformo esos escenarios en decisiones de diseño y ADRs; los divido en tareas; y finalmente implemento y verifico por capas.

La IA se utiliza como una herramienta dirigida. No delego la decisión técnica en una respuesta automática: delimito el alcance, exijo contratos y pruebas, y conservo revisiones independientes. La responsabilidad sobre requisitos, seguridad y aceptación final sigue siendo humana.

La revisión adversarial es importante porque busca cómo romper el diseño. Por ejemplo, detectó que bloquear después de leer no impedía una carrera de envío y aprobación. La corrección fue redefinir el contrato como lock-first.”

### Qué muestro

- Carpeta openspec/changes/bootstrap-vivetutiempo-platform/.
- Secuencia visual: proposal.md → specs/ → design.md → tasks.md → reviews/.
- Un informe dentro de reviews/, resaltando el hallazgo de carrera y su corrección.
- Evito scroll rápido: muestro nombres de artefactos y una sección concreta.

### Transición

“Ahora explico cómo convierto esas decisiones en evidencia de calidad y seguridad.”

---

## 6. Calidad y seguridad

**Tiempo estimado:** 5:15–6:30

### Qué digo

“La estrategia de calidad tiene varios niveles. En dominio, las pruebas cubren fábricas, transiciones ilegales, propiedad y cascadas. En aplicación, cubren roles, autorización y orquestación con puertos. Las pruebas de integración son las que deben demostrar la base de datos, las transacciones y las carreras.

No mostraré una consola verde si no corresponde al mismo commit y a una ejecución reproducible. Si dispongo de un resultado de CI verificable, lo mostraré indicando la fecha y revisión. Si no, mostraré las suites y diré con claridad que su ejecución en CI está pendiente.

En seguridad sigo un modelo de amenazas OWASP. La consulta pública se protege con una proyección allow-list: sólo título, descripción, fecha, duración y nombre público del artista. No deben salir ubicación exacta, mensaje privado, correo electrónico ni identificadores internos.

También trato las sesiones, la revocación, CSRF, límites de inicio de sesión, inyección, logging y retención de datos como controles que requieren evidencia, no como promesas. En un contexto hospitalario, ubicación e identidad son datos sensibles por contexto aunque no exista información clínica.”

### Qué muestro

- tests/unit/domain/acceptProposal.test.ts y la carpeta tests/unit/application/.
- Opción A, sólo si existe CI actual y verificable: captura limpia del CI o terminal, con commit y fecha visibles.
- Opción B, si no hay ejecución verificable: no muestro consola verde; muestro las carpetas de pruebas y un rótulo “Pruebas de integración: pendientes de ejecución en CI”.
- docs/security-threat-model.md, secciones de activos, proyección pública y riesgos abiertos.
- specs/public-event-browsing/spec.md, con los campos permitidos y prohibidos.

### Transición

“Con esa base, el objetivo funcional es el siguiente recorrido de demostración.”

---

## 7. Demo del flujo de usuario

**Tiempo estimado:** 6:30–7:50

### Qué digo

“La demostración final sigue esta secuencia. Primero, un administrador activa un Hospital y un Artista. Después, el Hospital activo publica un hueco futuro. El Artista propone una actividad y, si existe otra propuesta, ambas compiten por el mismo hueco.

El Hospital propietario acepta una. El resultado esperado es que el hueco pase a lleno, la propuesta elegida se acepte, las rivales pendientes se rechacen y se publique un evento. Finalmente, abro la consulta pública sin sesión y compruebo que sólo aparece la información permitida.

Si, al grabar, el despliegue o la interfaz final aún están pendientes, no simularé esta ejecución. Mostraré esta secuencia como objetivo de demostración, junto con los escenarios de especificación y el estado del proyecto. Cuando el flujo esté disponible, sustituiré esta parte por una demo con datos ficticios y una comprobación visible de la respuesta pública.”

### Qué muestro

**Si la aplicación está realmente disponible:**

1. Inicio de sesión como Admin y activación de perfiles.
2. Inicio de sesión como Hospital y creación de un Slot.
3. Inicio de sesión como Artista y envío de una Proposal.
4. Inicio de sesión como Hospital y aprobación.
5. Navegador en incógnito o sesión cerrada con consulta pública.
6. Inspector de red o respuesta JSON, sólo si es seguro, para comprobar que no existen location, message, emails ni IDs internos.

**Si la aplicación no está disponible:**

- Escenarios de specs/slot-proposal-coordination/spec.md y specs/public-event-browsing/spec.md.
- Sobreimpresión: “Demo E2E y despliegue: pendientes de verificación”.

### Transición

“Para cerrar, separo con precisión lo que ya está construido de lo que todavía debe verificarse.”

---

## 8. Estado honesto y trabajo futuro

**Tiempo estimado:** 7:50–8:45

### Qué digo

“En el estado actual, las capas de dominio y aplicación contienen el modelo de estados, las operaciones puras, los puertos y los casos de uso revisados. Es una base relevante, pero no equivale todavía a un MVP desplegado.

La infraestructura, las migraciones, las sesiones reales, los controles de origen, la interfaz, las pruebas de integración ejecutadas en CI y el despliegue deben verificarse antes de exponer el producto. Los hallazgos adversariales abiertos son puertas de salida, no detalles que ocultar.

Después del núcleo, el bloque dos incorporará valoraciones de eventos completados. El bloque tres modelará mecenazgo de forma simulada. Cualquier pago real, integración hospitalaria o función con datos adicionales requerirá un análisis de seguridad, privacidad y legal específico antes de implementarse.”

### Qué muestro

- Tabla visible:

| Implementado y revisado | En progreso / por verificar | Planificado |
| --- | --- | --- |
| Dominio, aplicación, casos de uso y pruebas unitarias existentes. | Infraestructura, UI, pruebas de integración ejecutadas, E2E y despliegue. | Valoraciones, mecenazgo simulado y consulta pública enriquecida. |

- docs/memoria-tfm-borrador.md, sección de trabajo pendiente.
- No muestro infraestructura ni migraciones en esta grabación.

### Transición

“Termino con los aprendizajes que guían el proyecto.”

---

## 9. Cierre y aprendizajes

**Tiempo estimado:** 8:45–9:30

### Qué digo

“Vivetutiempo parte de una necesidad social y la reduce a un núcleo técnico acotado y verificable: coordinar un hueco, varias propuestas y un evento publicado sin perder control sobre roles, datos y concurrencia.

Los aprendizajes principales son tres. Primero, las reglas de negocio deben expresarse como estados e invariantes, no como condiciones dispersas en la interfaz. Segundo, una arquitectura hexagonal permite probar y evolucionar el núcleo sin casarlo con una tecnología de entrega. Y tercero, la calidad no es afirmar que todo está terminado: es mostrar qué evidencia existe, qué riesgos siguen abiertos y cómo se cerrarán.

Gracias por su atención.”

### Qué muestro

- Diapositiva final: “Núcleo seguro de coordinación antes que amplitud de funcionalidades”.
- Nombre y enlace al repositorio o QR, si corresponde, sin información privada.

---

## Lista de comprobación de edición

- Mantener la narración entre 8 y 10 minutos; eliminar pausas y scrolls largos.
- Grabar una toma por sección para corregir una parte sin repetir todo el vídeo.
- Añadir subtítulos y revisar contraste y tamaño de fuente.
- Usar un cursor lento y resaltar sólo la línea o bloque relevante.
- Sustituir todos los marcadores [nombre] y datos de ejemplo antes de exportar.
- Antes de publicar, comprobar que cada frase sobre pruebas, despliegue, sesiones o concurrencia tiene evidencia actual. Rebajar a “diseñado”, “en progreso” o “pendiente de verificación” cuando no la tenga.

## Artefactos de apoyo

- memoria-tfm-borrador.md
- slides-outline.md
- security-threat-model.md
- openspec/changes/bootstrap-vivetutiempo-platform/proposal.md
- openspec/changes/bootstrap-vivetutiempo-platform/design.md
- openspec/changes/bootstrap-vivetutiempo-platform/specs/
- src/domain/ y src/application/

