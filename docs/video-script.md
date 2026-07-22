# Guion de vídeo de presentación — Vivetutiempo

**Formato:** screencast con narración en primera persona  
**Duración objetivo:** 9 minutos y 30 segundos  
**Revisión grabada:** `482aefd` en `main`. **Actualizado:** 2026-07-22.

**Criterio de evidencia:** separar siempre lo implementado y verificado de lo que sigue pendiente. No presentar como verde, desplegado o transaccionalmente verificado aquello que no tenga una ejecución reproducible asociada al momento de grabar. El criterio no cambia; lo que ha cambiado es qué cae de cada lado.

**Evidencia disponible al grabar:**

- Ejecución de CI [29905717933](https://github.com/lezama4/webmaster/actions/runs/29905717933) sobre `482aefd`, con los dos trabajos en verde: `test` con 360 pruebas superadas y 0 omitidas (unitarias más integración y concurrencia contra PostgreSQL 16 real) y `e2e` con 12 pruebas de Playwright superadas contra PostgreSQL real y datos sembrados.
- Aplicación desplegada y sirviendo datos sembrados en <https://webmaster-lemon.vercel.app>.

**Lo que sigue sin poder afirmarse:** que el despliegue esté endurecido. No hay cabeceras de seguridad, ni CSP, ni registro de eventos, ni análisis de dependencias. Los bloques 2 y 3 no existen en `main`. El repositorio es privado.

## Preparación antes de grabar

Tener abiertas, por este orden:

1. Una portada simple con título, autor, máster y fecha.
2. El explorador de archivos en la raíz del repositorio.
3. La carpeta openspec/changes/bootstrap-vivetutiempo-platform/.
4. src/domain/slot/acceptProposal.ts.
5. src/application/ports/MatchingUnitOfWork.ts y el caso de uso de aprobación.
6. Las carpetas tests/unit/domain/ y tests/unit/application/.
7. docs/security-threat-model.md y la carpeta reviews/.
8. La aplicación desplegada en <https://webmaster-lemon.vercel.app> (el flujo completo está disponible y verificado).
9. La ejecución de CI 29905717933, para mostrar el resultado con revisión y fecha visibles.

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

En domain están las reglas puras: entidades, máquinas de estado e invariantes. En application están los casos de uso y los puertos que expresan lo que necesito de persistencia, sesiones o tiempo. La infraestructura implementa esos contratos —repositorios Prisma, tres unidades de trabajo transaccionales, sesiones, hashing y limitación de intentos— y la capa de entrega los consume desde las páginas y los once manejadores de ruta de mutación. Las cuatro capas están implementadas y su comportamiento se verifica en integración continua.

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

La semántica está implementada en dominio y aplicación, y el adaptador cumple el contrato: ejecuta un SELECT FOR UPDATE sobre la fila del hueco antes de cualquier lectura que informe la decisión. Y esto no lo afirmo por lectura del código: nueve escenarios de carrera se fuerzan con barreras explícitas, en ambos órdenes, contra PostgreSQL real, y se ejecutan en integración continua. Los índices únicos parciales se comprueban además contra el catálogo real de la base de datos.”

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
- src/infrastructure/persistence/prisma/MatchingUnitOfWork.ts, señalando el SELECT ... FOR UPDATE real.
- tests/integration/, mostrando los ficheros de carrera y el soporte de barreras.
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

“La estrategia de calidad tiene varios niveles. En dominio, las pruebas cubren fábricas, transiciones ilegales, propiedad y cascadas. En aplicación, cubren roles, autorización y orquestación con puertos. Las de integración demuestran la base de datos, las transacciones y las carreras. Y las de extremo a extremo demuestran la cadena completa sobre HTTP real.

Muestro el resultado de integración continua indicando revisión y fecha: sobre el commit 482aefd, 360 pruebas superadas y ninguna omitida, más doce pruebas de Playwright superadas contra PostgreSQL real y datos sembrados. Señalo expresamente el cero de omitidas, porque es lo que distingue «existen pruebas de integración» de «se han ejecutado».

En seguridad sigo un modelo de amenazas OWASP. La consulta pública se protege con una proyección allow-list: sólo título, descripción, fecha, duración y nombre público del artista. No salen ubicación exacta, mensaje privado, correo electrónico ni identificadores internos, y una prueba extremo a extremo comprueba el conjunto exacto de claves y la ausencia de cada valor prohibido en el cuerpo crudo de la respuesta.

Las sesiones almacenan únicamente el hash del testigo, CSRF se aplica en los once manejadores de mutación y falla de forma cerrada, y el limitador de intentos consume cada intento de forma atómica. Todo ello con prueba ejecutada.

Y ahora la parte que también hay que decir: el despliegue no está endurecido. No hay cabeceras de seguridad, ni política de contenidos, ni registro de eventos, ni análisis de dependencias. Es un MVP defendible, no un servicio listo para producción, y el modelo de amenazas lo documenta control por control. En un contexto hospitalario, ubicación e identidad son datos sensibles por contexto aunque no exista información clínica.”

### Qué muestro

- tests/unit/domain/acceptProposal.test.ts y la carpeta tests/unit/application/.
- La ejecución de CI 29905717933, con commit y fecha visibles, destacando los dos trabajos en verde y el «360 passed | 0 skipped».
- e2e/public-projection.spec.ts, mostrando la comprobación del conjunto exacto de claves permitidas.
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

Esta secuencia no es un objetivo: está automatizada en e2e/demo-chain.spec.ts y se ejecuta en integración continua contra PostgreSQL real y datos sembrados. La grabo sobre la aplicación desplegada, con datos ficticios de demostración, y muestro la comprobación de la respuesta pública.”

### Qué muestro

Sobre la aplicación desplegada, con las credenciales sembradas documentadas en README.md:

1. Inicio de sesión como Admin y activación de perfiles.
2. Inicio de sesión como Hospital y creación de un Slot.
3. Inicio de sesión como Artista y envío de una Proposal.
4. Inicio de sesión como Hospital y aprobación.
5. Navegador en incógnito o sesión cerrada con consulta pública.
6. Inspector de red o respuesta JSON para comprobar que no existen location, message, emails ni IDs internos.

Antes de grabar: si se ha ejecutado la suite de integración, hay que volver a sembrar con `npm run db:seed`, porque esa suite vacía los datos de demostración.

### Transición

“Para cerrar, separo con precisión lo que ya está construido de lo que todavía debe verificarse.”

---

## 8. Estado honesto y trabajo futuro

**Tiempo estimado:** 7:50–8:45

### Qué digo

“En el estado actual, el bloque uno está implementado de extremo a extremo, desplegado y respaldado por evidencia ejecutada: las cuatro capas, las migraciones, las sesiones reales, el control de origen, la interfaz, la suite de integración contra PostgreSQL y la suite extremo a extremo.

Lo que no está hecho lo digo con la misma precisión. El despliegue no tiene cabeceras de seguridad ni política de contenidos, no hay registro de eventos de seguridad ni análisis de dependencias, la validación de agregado no cubre la matriz completa de estados y los nombres de perfil y mensajes de propuesta siguen sin acotar. Los hallazgos adversariales abiertos son puertas de salida, no detalles que ocultar.

Después del núcleo, el bloque dos incorporará valoraciones de eventos completados. El bloque tres modelará mecenazgo de forma simulada. Cualquier pago real, integración hospitalaria o función con datos adicionales requerirá un análisis de seguridad, privacidad y legal específico antes de implementarse.”

### Qué muestro

- Tabla visible:

| Implementado y con prueba ejecutada | Implementado, sin endurecer | Planificado |
| --- | --- | --- |
| Dominio, aplicación, infraestructura y entrega; migraciones e índices; sesiones y CSRF; concurrencia lock-first; suites de integración y extremo a extremo; despliegue sirviendo datos sembrados. | Cabeceras de seguridad y CSP; validación de esquema y tamaño de peticiones; registro de eventos; análisis de dependencias; matriz del agregado; límites de texto. | Valoraciones, mecenazgo simulado y consulta pública enriquecida. |

- docs/memoria-tfm-borrador.md, sección de trabajo pendiente.
- La ejecución de CI con revisión y fecha visibles.

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
- Antes de publicar, comprobar que cada frase sobre pruebas, despliegue, sesiones o concurrencia tiene evidencia actual. Rebajar a “diseñado”, “en progreso” o “pendiente de verificación” cuando no la tenga. El criterio sigue vigente en ambas direcciones: tampoco conviene decir “pendiente” de algo que ya está probado.
- Volver a ejecutar `npm run test` y consultar la última ejecución de CI antes de grabar; si los números han cambiado, narrar los nuevos en lugar de los de este guion.
- Comprobar que la URL desplegada responde y que los datos sembrados están presentes.

> **TODO (autor):** decidir si mencionar en el vídeo que el repositorio es privado. Si va a seguir siéndolo, es preferible decirlo que dejar que se descubra. Y si se hace público antes de grabar, incluir el enlace o el QR en el cierre.

## Artefactos de apoyo

- memoria-tfm-borrador.md
- slides-outline.md
- security-threat-model.md
- openspec/changes/bootstrap-vivetutiempo-platform/proposal.md
- openspec/changes/bootstrap-vivetutiempo-platform/design.md
- openspec/changes/bootstrap-vivetutiempo-platform/specs/
- src/domain/ y src/application/

