# Vivetutiempo: plataforma de coordinación cultural en el ámbito hospitalario

## Primer borrador de memoria técnica del Trabajo de Fin de Máster

> **Nota de alcance y evidencia.** Revisión documentada: `482aefd` en `main`.
> Actualizado el 2026-07-22.
>
> Una versión anterior de esta nota advertía de que la infraestructura de
> persistencia, sesiones, migraciones y Prisma estaba **en progreso** y no se
> había inspeccionado. Esa limitación ya no se aplica: para esta revisión se han
> leído las cuatro capas, el esquema, las migraciones, la semilla y el flujo de
> integración continua.
>
> La evidencia que se cita a lo largo del documento es ejecutada, no inferida
> del código:
>
> - Ejecución de CI [29905717933](https://github.com/lezama4/webmaster/actions/runs/29905717933)
>   sobre `482aefd`, con los dos trabajos en verde: `test` con **360 pruebas
>   superadas y 0 omitidas** (unitarias más la suite de integración y
>   concurrencia contra PostgreSQL 16 real, en serie, con las migraciones
>   aplicadas en un *global setup*), y `e2e` con **12 pruebas de Playwright
>   superadas** contra PostgreSQL 16 real y el conjunto de datos sembrado.
> - Ejecución local de `npm run test` sobre la misma revisión: 305 superadas y
>   55 omitidas (los 17 ficheros de integración se omiten salvo que se active
>   `VIVETUTIEMPO_RUN_INTEGRATION=true`).
> - La aplicación está desplegada y sirve datos sembrados en
>   <https://webmaster-lemon.vercel.app>.
>
> Lo que esta memoria **no** afirma: que el despliegue esté endurecido para
> producción. No existen cabeceras de seguridad, ni política de contenidos
> (CSP), ni registro de eventos, ni análisis de dependencias. La sección 9
> mantiene esos puntos como trabajo pendiente explícito.

## 1. Introducción y problema que se aborda

Una estancia hospitalaria incluye con frecuencia periodos prolongados de espera,
> acompañamiento o recuperación. Vivetutiempo nace como una plataforma web sin
ánimo de lucro orientada a que esos periodos puedan aprovecharse mediante
actividades culturales, artísticas y humanas. No pretende sustituir la atención
sanitaria ni gestionar datos clínicos: su problema concreto es la **coordinación
segura y trazable** entre centros hospitalarios que disponen de un hueco de
agenda, artistas o dinamizadores que proponen una actividad y las personas que
podrán consultar los eventos resultantes.

La propuesta diferencia cuatro papeles: Hospital, Artista, Administrador y
Paciente/Familiar. En el núcleo funcional, el Hospital publica un hueco
(`Slot`), uno o varios Artistas presentan propuestas, y sólo el Hospital
propietario selecciona una de ellas. Esta decisión convierte la propuesta
aceptada en un evento publicado y resuelve explícitamente las propuestas
competidoras. Los pacientes, familiares y visitantes anónimos pueden consultar
los eventos publicados sin crear una cuenta. El flujo y sus límites están
definidos en la propuesta del proyecto y en las especificaciones de bloque 1
([`proposal.md`, secciones 1--5](../openspec/changes/bootstrap-vivetutiempo-platform/proposal.md);
[`slot-proposal-coordination/spec.md`](../openspec/changes/bootstrap-vivetutiempo-platform/specs/slot-proposal-coordination/spec.md)).

El TFM no se limita a una interfaz demostrativa. Su objetivo técnico es producir
una aplicación desplegable y defendible que haga explícitos su modelo de
dominio, sus límites arquitectónicos, las decisiones de seguridad y la evidencia
de prueba. El repositorio identifica el trabajo como un proyecto de desarrollo
asistido por IA, guiado por especificaciones y arquitectura hexagonal
([`README.md`, introducción](../README.md)).

## 2. Objetivos, alcance y hoja de ruta

### 2.1 Objetivo general

Diseñar y construir una plataforma web de coordinación de actividades culturales
en hospitales que sea funcional para un flujo central multirol y que demuestre
de forma verificable prácticas de arquitectura limpia, pruebas por capas,
seguridad por diseño y desarrollo guiado por especificaciones.

### 2.2 Objetivos específicos

1. Modelar de forma explícita los ciclos de vida de las cuentas y perfiles, los
   huecos de agenda, las propuestas y los eventos.
2. Garantizar que Hospitales y Artistas sólo actúan tras una validación
   administrativa y que cada Hospital sólo decide sobre sus propios huecos.
3. Resolver de manera atómica la aceptación de una propuesta: aceptar una,
   llenar el hueco, publicar un evento y rechazar las competidoras pendientes.
4. Ofrecer consulta pública de eventos publicados sin divulgar ubicación exacta,
   mensajes privados, correos electrónicos ni identificadores internos.
5. Mantener el dominio independiente de Next.js, Prisma, HTTP y mecanismos de
   almacenamiento, mediante puertos y adaptadores.
6. Generar evidencia de calidad mediante pruebas unitarias de dominio y
   aplicación, pruebas de integración contra PostgreSQL y pruebas extremo a
   extremo.
7. Documentar decisiones y riesgos de seguridad para que la demostración sea
   reproducible y defendible ante un tribunal.

### 2.3 Alcance por bloques

| Bloque | Alcance | Estado en esta revisión |
| --- | --- | --- |
| 1. Núcleo | Registro y validación de perfiles, huecos, propuestas competidoras, aprobación/rechazo, creación de eventos y consulta pública. | Implementado de extremo a extremo y desplegado. Queda pendiente el endurecimiento de producción (cabeceras de seguridad, CSP, registro de eventos, análisis de dependencias). |
| 2. Valoración | Valoración de eventos finalizados por cuentas ligeras de pacientes/familiares, con una valoración por persona y evento. | Planificado; no implementado. |
| 3. Mecenazgo | Campañas de apoyo simuladas detrás de un puerto `PaymentGateway` y un adaptador falso. | Planificado; no se procesarán pagos reales en el TFM. |

Esta secuenciación evita ampliar el producto antes de disponer de una cadena
central completa. La decisión está justificada en la propuesta: un núcleo
desplegable y demostrable aporta más evidencia académica que varios módulos
incompletos ([`proposal.md`, secciones 3 y 8](../openspec/changes/bootstrap-vivetutiempo-platform/proposal.md)).

## 3. Estado del arte y diferenciación

Las iniciativas de arte, música, acompañamiento y humanización en hospitales
demuestran el valor social de acercar actividades culturales al entorno
asistencial. Sin embargo, la existencia de una actividad no resuelve por sí sola
la coordinación operativa: hay que gestionar disponibilidad del centro,
propuestas alternativas, validación de quienes participan, decisión del
Hospital y comunicación pública sin exponer información sensible.

Vivetutiempo se sitúa en esa capa de coordinación. Su diferenciación no consiste
en afirmar que inventa las actividades culturales hospitalarias, sino en
convertir el proceso de conciliación entre oferta y agenda en un flujo digital
multirol con gobernanza y trazabilidad. La propuesta identifica expresamente esa
distinción: «matching», aprobación, agenda y validación, frente a la mera
difusión de eventos ([`proposal.md`, sección 1](../openspec/changes/bootstrap-vivetutiempo-platform/proposal.md)).

Esta sección es una primera delimitación del problema, no una revisión
bibliográfica exhaustiva. La versión final de la memoria deberá incorporar
fuentes académicas y sectoriales verificables sobre artes y humanización en
hospitales, bienestar de pacientes y acompañantes, y plataformas de
coordinación de voluntariado. Es importante no convertir esta hipótesis de
producto en una afirmación empírica sin bibliografía.

## 4. Stack tecnológico y justificación de decisiones

La solución se plantea como un monolito web con Next.js, TypeScript, Tailwind,
Prisma y PostgreSQL. Vitest y Playwright completan la estrategia de pruebas.
Docker se reserva para PostgreSQL local, mientras que el despliegue objetivo es
Vercel con una base de datos PostgreSQL gestionada
([`design.md`, encabezado y ADR D5](../openspec/changes/bootstrap-vivetutiempo-platform/design.md);
[`README.md`, secciones *Stack* y *Architecture*](../README.md)).

| Decisión | Justificación |
| --- | --- |
| Next.js con App Router y TypeScript | Permite un único repositorio para interfaz, renderizado y puntos de entrega HTTP, manteniendo tipado estático. `src/app` funciona como entrada fina; no sustituye las capas de negocio. |
| Monolito modular | El flujo inicial no requiere despliegues, bases de datos ni equipos independientes por servicio. Un monolito reduce complejidad operativa y conserva límites explícitos mediante módulos y puertos. Los microservicios añadirían red, observabilidad distribuida, fallos parciales y coste sin resolver una necesidad actual. |
| Arquitectura hexagonal | Aísla reglas de negocio de frameworks, ORM, transporte y persistencia. Permite probar el dominio sin base de datos y sustituir adaptadores sin alterar los casos de uso. |
| PostgreSQL y Prisma | PostgreSQL proporciona transacciones y bloqueo de filas necesarios para el caso de concurrencia. Prisma reduce trabajo repetitivo de acceso a datos, mientras que las restricciones que no expresa —los índices únicos parciales— se documentan como migraciones SQL explícitas. Los adaptadores están implementados y su comportamiento transaccional se verifica en CI contra PostgreSQL 16 real. |
| Sesiones en base de datos, no JWT | La revocación inmediata es un requisito: un administrador puede rechazar o desactivar a un perfil y todas sus sesiones deben quedar invalidadas. Las sesiones persistidas permiten aplicar esa decisión sin esperar a que caduque un token autocontenido. Véase [`design.md`, ADR D1](../openspec/changes/bootstrap-vivetutiempo-platform/design.md). |
| argon2id para contraseñas | Se establece como el algoritmo de hashing detrás de un puerto de aplicación, evitando que el dominio conozca credenciales o bibliotecas criptográficas. El adaptador está implementado y fija explícitamente todos los parámetros de coste sobre la línea base de OWASP (`m=19456`, `t=2`, `p=1`, versión 0x13), en lugar de delegar en los valores por defecto de la biblioteca. El inicio de sesión rehashea de forma transparente cuando detecta un coste obsoleto. |
| Vercel y PostgreSQL gestionada | Se prioriza una entrega reproducible, de coste y operación contenidos, frente a Kubernetes o AWS. Para el tamaño y propósito del TFM, introducir orquestación de contenedores sería infraestructura sin valor funcional proporcional. |
| Vitest y Playwright | Separan pruebas rápidas de reglas y casos de uso de las comprobaciones de integración y de experiencia extremo a extremo. |

La elección de monolito no niega una evolución futura. Los puertos de
aplicación permiten introducir un proveedor de pagos simulado, una capa de
reputación o adaptadores externos sin convertir prematuramente el sistema en
una arquitectura distribuida.

## 5. Arquitectura y modelo de dominio

### 5.1 Capas y dirección de dependencias

La arquitectura se organiza en cuatro capas principales:

```text
UI / Next.js (src/ui, src/app)
        │ invoca
Application (src/application: casos de uso y puertos)
        │ aplica reglas sobre
Domain (src/domain: entidades, transiciones e invariantes puros)
        ▲ implementado por
Infrastructure (Prisma, sesiones, HTTP, correo, etc.)
```

El dominio no importa Next.js, Prisma, HTTP ni infraestructura; la aplicación
depende de interfaces de puertos y puede depender del dominio. Esta frontera se
documenta tanto en el repositorio como en los README de capa
([`src/domain/README.md`](../src/domain/README.md);
[`src/application/README.md`](../src/application/README.md)). Las reglas de
lint se emplean como salvaguarda adicional, pero no sustituyen la revisión de
arquitectura.

La capa de infraestructura materializa los puertos de repositorio, unidad de
trabajo, sesiones, hash de contraseñas, limitación de intentos y consultas de
lectura. Todos existen en `src/infrastructure/` y forman parte de la evidencia
revisada en este documento: adaptadores Prisma para cada repositorio, tres
unidades de trabajo transaccionales (`MatchingUnitOfWork`, `ProfileUnitOfWork`
y `RegistrationUnitOfWork`), sesiones opacas respaldadas por base de datos,
argon2id, limitador de intentos y las consultas de lectura especializadas.

La capa de entrega (`src/app/`) contiene las páginas públicas `/`, `/events`,
`/ayuda`, `/login` y `/register`, las áreas de rol `admin/`, `artist/` y
`hospital/`, y once manejadores de ruta de mutación. Todos ellos invocan la
guarda CSRF de origen canónico y derivan la identidad exclusivamente de la
sesión verificada, nunca del cuerpo de la petición.

### 5.2 Entidades y máquinas de estado

| Concepto | Estados y transiciones | Responsabilidad |
| --- | --- | --- |
| `Account` | No tiene ciclo de vida de negocio en bloque 1; posee rol `admin`, `hospital`, `artist` o `patient`. | Identidad y autorización base. Las credenciales quedan fuera del dominio. |
| `Profile` | `pending → active | rejected`; `active → deactivated`; `rejected → pending`. | Gobernanza de Hospitales y Artistas. La re-inscripción reutiliza el mismo perfil y registra una nueva solicitud de revisión. |
| `Slot` | `open → filled | closed`. | Hueco de agenda de un Hospital activo. Su creación exige fecha futura, duración positiva y límites de texto. |
| `Proposal` | `submitted → accepted | rejected`. | Propuesta de un Artista; sus estados terminales no pueden transitar de nuevo. |
| `Event` | `created → published → completed`. | Actividad confirmada; el estado `completed` deja preparada la ampliación de valoraciones. |

Las fábricas fuerzan el estado inicial y las funciones de rehidratación validan
datos persistidos. Las transiciones son inmutables y los errores de regla de
negocio son independientes de HTTP. Estas propiedades pueden observarse en
[`src/domain/profile/Profile.ts`](../src/domain/profile/Profile.ts),
[`src/domain/slot/Slot.ts`](../src/domain/slot/Slot.ts),
[`src/domain/proposal/Proposal.ts`](../src/domain/proposal/Proposal.ts) y
[`src/domain/event/Event.ts`](../src/domain/event/Event.ts).

### 5.3 Invariante de aceptación de una propuesta

El invariante principal se expresa como una operación pura. Para una propuesta
enviada sobre un hueco abierto y decidida por el Hospital propietario, la
operación debe producir conjuntamente:

1. La propuesta seleccionada en estado `accepted`.
2. El hueco en estado `filled`.
3. El rechazo de todas las demás propuestas `submitted` del mismo hueco.
4. Un evento nuevo en estado `published`, vinculado al hueco y a la propuesta
   aceptada.

La operación `acceptProposal` recibe el conjunto completo de propuestas y
comprueba propiedad, correspondencia entre propuesta y hueco, estados y
consistencia del agregado antes de construir el resultado
([`src/domain/slot/acceptProposal.ts`](../src/domain/slot/acceptProposal.ts)).
El cierre de un hueco sigue el mismo criterio: pasa a `closed` y rechaza las
propuestas pendientes en una única decisión pura
([`src/domain/slot/closeSlot.ts`](../src/domain/slot/closeSlot.ts)).

### 5.4 Concurrencia: enfoque *lock-first*

La pureza de la operación no basta para garantizar integridad en una aplicación
con peticiones simultáneas. Por ello, el diseño exige que envío, aceptación,
rechazo y cierre se coordinen mediante
`MatchingUnitOfWork.withLockedSlot(slotId, work)`. El contrato indica que el
adaptador debe bloquear primero la fila del hueco, cargar dentro de la misma
transacción el hueco y todas sus propuestas, ejecutar la decisión y persistir
el resultado antes de confirmar
([`src/application/ports/MatchingUnitOfWork.ts`](../src/application/ports/MatchingUnitOfWork.ts);
[`design.md`, ADR D4](../openspec/changes/bootstrap-vivetutiempo-platform/design.md)).

La motivación es precisa: una lectura previa al bloqueo puede permitir que una
propuesta se inserte después de que otra aprobación haya llenado el hueco, con
lo que quedaría una propuesta accionable fuera de la cascada de rechazo. Una
revisión adversarial identificó esta carrera y motivó el rediseño *lock-first*
([`reviews/codex-planning-review.md`, B1](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-planning-review.md)).

El adaptador cumple ese contrato: `PrismaMatchingUnitOfWork` ejecuta
`SELECT … FOR UPDATE` sobre la fila del hueco **antes** de cualquier lectura que
informe la decisión, carga el conjunto completo de propuestas dentro de la misma
transacción y persiste de forma atómica. La misma disciplina se aplica en
`ProfileUnitOfWork` y, para el caso del registro —donde en una primera
inscripción todavía no existe fila que bloquear—, `RegistrationUnitOfWork`
recurre a `pg_advisory_xact_lock` sobre el correo normalizado.

La demostración es ejecutada, no argumental. Nueve ficheros de prueba de
integración fuerzan el solapamiento con barreras explícitas y en ambos órdenes
—envío/aprobación, envío/cierre, aprobación/cierre, aprobación/rechazo,
cierre/rechazo, envío duplicado, inicio de sesión frente a desactivación,
autorización de hueco frente a desactivación y registro concurrente— y se
ejecutan contra PostgreSQL 16 real en CI. Los índices únicos parciales se
verifican además contra el catálogo real de PostgreSQL. La afirmación de
seguridad frente a carreras se apoya, por tanto, en una ejecución reproducible
y fechada, no en la lectura del código.

Conviene registrar una limitación operativa observada: estas pruebas de carrera
resultan inestables al ejecutarse localmente contra una rama remota de Neon,
porque la latencia de red eleva el tiempo de las transacciones solapadas (8-9
segundos frente a un límite de 5). La ejecución en CI con PostgreSQL local es
la evidencia autorizada de concurrencia.

## 6. Proceso de desarrollo: Spec-Driven Development e IA dirigida

El proyecto sigue un flujo de desarrollo guiado por especificaciones (SDD):

```text
Propuesta → especificaciones de comportamiento → diseño/ADR → tareas
          → implementación por capas → verificación y revisión adversarial
```

La propuesta define problema, alcance y criterios de éxito; las especificaciones
describen requisitos mediante escenarios; el diseño transforma esos requisitos
en decisiones arquitectónicas; y las tareas organizan la ejecución por fases.
Los artefactos se mantienen en
[`openspec/changes/bootstrap-vivetutiempo-platform/`](../openspec/changes/bootstrap-vivetutiempo-platform/).
En particular, [`tasks.md`](../openspec/changes/bootstrap-vivetutiempo-platform/tasks.md)
separa el dominio, la aplicación, la infraestructura, la interfaz, las semillas
y el despliegue.

La IA se utiliza como herramienta dirigida, no como sustituto de la decisión
técnica. El proceso parte de requisitos explícitos, solicita implementaciones o
revisiones acotadas por capa y conserva el resultado de revisiones
independientes. La validación humana se apoya en especificaciones, pruebas y
evidencia de revisión. Este enfoque permite explicar ante un tribunal no sólo
qué se construyó, sino por qué se aceptó o descartó cada cambio.

## 7. Aseguramiento de calidad

### 7.1 Estrategia de pruebas

La estrategia distingue el tipo de garantía de cada nivel:

| Nivel | Finalidad | Estado |
| --- | --- | --- |
| Unitario de dominio | Probar fábricas, transiciones, propiedad, invariantes y cascadas sin E/S. | Implementado en `tests/unit/domain/`; ejecutado local y en CI. |
| Unitario de aplicación | Probar autorización, orquestación, puertos y mapeo de errores con dobles en memoria. | Implementado en `tests/unit/application/`; ejecutado local y en CI. |
| Integración | Verificar Prisma/PostgreSQL, transacciones, bloqueos, índices y adaptadores de sesión. | Implementado en `tests/integration/` (17 ficheros). **Ejecutado en CI contra PostgreSQL 16 real, en serie y con 0 omitidas.** |
| Extremo a extremo | Verificar el flujo desde interfaz hasta persistencia y consulta pública. | Implementado en `e2e/` (5 especificaciones, 12 pruebas). **Ejecutado en CI** contra PostgreSQL real y datos sembrados. |

El total ejecutado en CI sobre `482aefd` es de **360 pruebas superadas y 0
omitidas** en el trabajo `test`, más **12 pruebas de Playwright superadas** en
el trabajo `e2e`. En una ejecución local sin activar el indicador de
integración, la misma revisión reporta 305 superadas y 55 omitidas: la
diferencia son exactamente los ficheros que exigen PostgreSQL.

Dos detalles operativos que conviene conocer para reproducir la evidencia: las
ejecuciones de integración vacían el conjunto de datos de demostración
(`resetDatabase()`), por lo que debe ejecutarse `npm run db:seed` antes de
cualquier prueba extremo a extremo posterior; y la semilla es idempotente
—escribe mediante `upsert` sobre identificadores fijos—, de modo que volver a
ejecutarla actualiza sus propios registros en lugar de duplicarlos.

Las pruebas de dominio cubren, entre otros casos, la aceptación con rechazo de
rivales, la publicación del evento, la imposibilidad de aceptar en huecos
cerrados o llenos y la propiedad del Hospital
([`tests/unit/domain/acceptProposal.test.ts`](../tests/unit/domain/acceptProposal.test.ts)).
También existe cobertura específica para el cierre y el rechazo en cascada
([`tests/unit/domain/closeSlot.test.ts`](../tests/unit/domain/closeSlot.test.ts)).

En aplicación hay pruebas para autorización por rol, decisiones del Hospital,
sesiones y denegaciones. Estas pruebas dan confianza sobre la orquestación, pero
los dobles en memoria no pueden probar por sí solos un bloqueo de base de datos
ni una transacción real. Esa distinción se mantiene deliberadamente: el bloqueo
de filas, la reversión transaccional y los índices únicos parciales se
demuestran en la suite de integración contra PostgreSQL real, y la cadena
completa desde el navegador hasta la respuesta pública se demuestra en la suite
extremo a extremo. Ambas se ejecutan en CI y su resultado está fechado y
asociado a una revisión concreta.

La suite extremo a extremo cubre en particular tres propiedades que no pueden
verificarse en memoria: la cadena de demostración completa (registro →
aprobación del Admin → publicación → propuesta → aceptación → rechazo
automático de la rival → consulta pública), la matriz de denegaciones sobre
HTTP real (401 sin sesión, 403 por rol o perfil no activo, 403 por origen CSRF
ausente, 404 por vínculo propuesta-hueco incorrecto, 409 por propuesta ya
decidida) y la ausencia de fugas en la respuesta pública, comprobando el
conjunto exacto de claves permitidas y que el cuerpo crudo no contiene
ubicación, mensaje de propuesta, correo ni identificador interno alguno.

### 7.2 Revisión adversarial independiente

Además de las pruebas, el proyecto incorpora rondas de revisión adversarial
documentadas. Este proceso busca activamente inconsistencias entre requisitos,
diseño y código, en lugar de limitarse a confirmar que el flujo feliz funciona.

| Ronda | Ejemplo de hallazgo | Efecto en el proyecto |
| --- | --- | --- |
| Planificación inicial | Una propuesta podía colarse entre una lectura y una aprobación concurrente. | Se sustituyó el enfoque de actualización tardía por el contrato *lock-first*. |
| Dominio (PR 1) | El ciclo de vida de `Profile` exigía `DEACTIVATED` y trazabilidad de re-registro que el esquema aún no representaba. | Se marcó como requisito bloqueante para la migración de infraestructura. |
| Plan de aplicación/infraestructura | Se detectaron riesgos en índices parciales, revocación de sesiones, limitación de intentos y CSRF. | Se concretaron puertos, migraciones y pruebas requeridas. |
| Aplicación (PR 2a) | La proyección pública dependía del tipo TypeScript y podía reenviar propiedades no permitidas en tiempo de ejecución. | Se registró como bloqueo que requiere mapeo explícito y prueba con un adaptador hostil. |

Las revisiones son evidencia útil porque conservan tanto los problemas como las
acciones derivadas. Los cuatro hallazgos de la tabla anterior están cerrados y
cada cierre tiene una prueba ejecutada asociada: el contrato *lock-first* con
nueve carreras forzadas por barreras, el ciclo de vida de `Profile` con su
migración aplicada sobre base de datos vacía, la proyección pública construida
campo a campo con una prueba de no fuga sobre HTTP real, y la re-inscripción que
exige verificar la contraseña de la cuenta existente.

No deben presentarse, sin embargo, como una certificación automática de
seguridad. Siguen abiertos hallazgos concretos que el modelo de amenazas
documenta con precisión: la matriz completa de estados del agregado
Hueco/Propuesta, los límites de longitud de nombre de perfil y mensaje de
propuesta, y —sobre todo— la ausencia de cabeceras de seguridad, política de
contenidos, registro de eventos y análisis de dependencias en el despliegue.
Los informes están disponibles en
[`reviews/`](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/).

## 8. Seguridad y minimización de datos

El contexto hospitalario exige un criterio conservador. Aunque el bloque 1 no
trata historias clínicas, procesa identidad, correo electrónico, credenciales,
nombres de perfil y datos operativos de agenda. La arquitectura adopta la
minimización de datos como principio y evita afirmar incorrectamente que no hay
datos personales.

### 8.1 Controles diseñados o ya expresados en las capas revisadas

- **Autorización por servidor.** Los casos de uso comprueban rol, perfil activo
  y propiedad del hueco; no se delega la autorización a la ocultación de
  botones. Administradores validan perfiles, mientras que los Hospitales
  propietarios deciden propuestas ([`src/application/use-cases/`](../src/application/use-cases/)).
- **Dominio aislado.** Las reglas de estado y propiedad no dependen de HTTP ni
  de Prisma, reduciendo el riesgo de que una decisión de transporte altere el
  modelo de negocio.
- **Sesiones revocables implementadas.** `SessionPort` define expiración
  absoluta y por inactividad, creación de identificadores nuevos, cierre de
  sesión y revocación total por cuenta, y la emisión y revocación ocurren dentro
  de una unidad de trabajo de perfil ([`SessionPort.ts`](../src/application/ports/SessionPort.ts)
  y [`ProfileUnitOfWork.ts`](../src/application/ports/ProfileUnitOfWork.ts)).
  El adaptador persistente y la cookie existen: el testigo es un valor opaco
  generado con un generador criptográficamente seguro, la cookie es `httpOnly`,
  `secure` en producción y `SameSite=Lax`, y **la fila de base de datos almacena
  únicamente el hash SHA-256 del testigo**. Una prueba de integración lo
  comprueba directamente contra la fila persistida: ni el identificador de la
  fila ni el hash almacenado sirven para autenticarse.
- **Superficie pública reducida.** La especificación permite únicamente título,
  descripción, fecha, duración y nombre público del artista. Prohíbe ubicación
  exacta, mensaje de propuesta, correos e identificadores
  ([`public-event-browsing/spec.md`](../openspec/changes/bootstrap-vivetutiempo-platform/specs/public-event-browsing/spec.md)).
- **Concurrencia como seguridad de integridad.** El protocolo de bloqueo evita
  decisiones contradictorias y estados imposibles causados por peticiones
  simultáneas.

### 8.2 Riesgos abiertos que deben cerrarse antes de exponer el MVP

La rigurosidad de la memoria exige distinguir los hallazgos que se han cerrado
—con la prueba que lo demuestra— de los que siguen abiertos.

**Cerrados, con evidencia ejecutada:**

1. La consulta pública ya no reenvía el resultado del puerto. El adaptador
   utiliza `select` (nunca `include`) y construye un objeto nuevo campo a campo,
   de modo que ampliar accidentalmente la consulta no puede filtrar una
   propiedad en tiempo de ejecución. Una prueba extremo a extremo comprueba el
   conjunto exacto de claves permitidas y la ausencia de cada valor prohibido en
   el cuerpo crudo de la respuesta
   ([`codex-pr2a-review.md`, pr2a-B1](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr2a-review.md)).
2. La re-inscripción exige ahora demostrar el control de la cuenta existente
   verificando su contraseña actual con argon2id, y además comprueba que el rol
   solicitado coincide con el almacenado. Ambas comprobaciones ocurren dentro de
   la transacción de registro
   ([`codex-pr2a-review.md`, pr2a-B2](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr2a-review.md)).
3. El esquema persistente refleja `DEACTIVATED` y `reviewRequestedAt`, y la
   migración se aplica sobre una base de datos vacía en CI
   ([`codex-pr1-review.md`, B1](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr1-review.md)).
4. La limitación de inicio de sesión contempla cuenta y cliente, se consume de
   forma atómica en una única sentencia por clave dentro de una transacción
   compartida en PostgreSQL —lo que la hace efectiva en un entorno serverless—,
   y no filtra la existencia de cuentas: un correo desconocido consume el mismo
   coste de verificación argon2id contra un hash señuelo antes de devolver la
   misma denegación genérica
   ([`codex-pr2a-review.md`, pr2a-M2](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr2a-review.md)).
5. CSRF se aplica en los once manejadores de mutación, incluido el inicio de
   sesión, comparando únicamente contra el origen canónico configurado y
   fallando de forma cerrada si la variable no está definida. Una prueba extremo
   a extremo comprueba que una petición sin cabecera `Origin` recibe 403 antes
   incluso de intentar autenticar.

**Abiertos, y deliberadamente visibles:**

1. Los nombres de perfil y los mensajes de propuesta siguen sin acotar ni
   normalizar. Los campos del hueco sí tienen límites de longitud, pero
   `Proposal` no valida su mensaje y `Profile` sólo comprueba que el nombre no
   esté vacío
   ([`codex-pr1-review.md`, M2](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr1-review.md)).
2. El despliegue **no tiene cabeceras de seguridad ni política de contenidos**.
   No existe `middleware.ts` ni un bloque `headers()` en la configuración de
   Next.js. Es la carencia más relevante que queda.
3. No hay validación de esquema ni límite de tamaño para los cuerpos de las
   peticiones, ni validación centralizada de las variables de entorno: un
   `SESSION_SECRET` de marcador de posición no impide arrancar.
4. No existe registro de eventos de seguridad ni análisis automático de
   dependencias.
5. La validación del agregado Hueco/Propuesta sigue siendo incompleta: sólo
   rechaza la contradicción «hueco abierto con propuesta aceptada», no la matriz
   completa de estados.

El criterio de salida planteado en su día —probar revocación, expiración, origen
CSRF, denegación de perfiles no activos, carreras de concurrencia y ausencia de
fugas en respuestas públicas— se ha cumplido y está respaldado por una ejecución
fechada. El criterio pendiente es distinto y de naturaleza operativa:
endurecimiento de la respuesta HTTP, observabilidad y gobernanza de
dependencias.

## 9. Trabajo pendiente y evolución futura

Los elementos que la versión anterior de esta sección listaba como pendientes se
han completado, con la excepción parcial que se detalla después:

- **Infraestructura:** completada. Repositorios Prisma, migraciones,
  restricciones de base de datos, tres unidades de trabajo transaccionales,
  sesiones persistentes, hashing argon2id, limitación de intentos y consulta
  pública están implementados y verificados contra PostgreSQL real en CI.
- **Interfaz y entrega:** completadas salvo el endurecimiento. Existen las
  rutas, los componentes y las páginas públicas, la traducción homogénea de
  errores mediante una única frontera que nunca revela mensajes internos, y el
  control CSRF sobre todas las mutaciones. **Siguen ausentes las cabeceras de
  seguridad y la política de contenidos**, así como la validación estricta de
  esquema y el límite de tamaño de las peticiones.
- **Calidad verificable:** completada. Las pruebas de integración fuerzan las
  carreras de envío, aprobación, cierre y rechazo con barreras y en ambos
  órdenes, y la suite extremo a extremo cubre la cadena completa. Ambas se
  ejecutan en CI.
- **Operación:** completada en lo esencial. Existen datos de demostración
  ficticios e idempotentes, un manual de despliegue con su procedimiento de
  reversión ([`deployment.md`](deployment.md)), gestión documentada de secretos
  y una URL pública en funcionamiento.

Queda, por tanto, un conjunto de trabajo pendiente más acotado y de naturaleza
distinta:

- **Endurecimiento de producción:** cabeceras de seguridad y política de
  contenidos, validación de esquema y límite de tamaño de peticiones, y
  validación de las variables de entorno al arrancar.
- **Observabilidad y gobernanza:** registro de eventos de seguridad respetuoso
  con la privacidad, alertas, y análisis automático de dependencias.
- **Integridad de dominio:** matriz completa de estados del agregado
  Hueco/Propuesta, y límites de longitud para nombre de perfil y mensaje de
  propuesta.
- **Evidencia de producción:** ejecución registrada de la cadena de
  demostración contra la URL desplegada. La cadena está probada en CI contra
  PostgreSQL local, no contra el despliegue.
- **Política de retención:** decisión sobre conservación y borrado de perfiles
  rechazados, mensajes, registros y copias de seguridad, requisito previo a
  procesar cualquier dato real.

> **TODO (autor):** el repositorio <https://github.com/lezama4/webmaster> es
> **privado**. La entrega del TFM exige un repositorio público. Es el único
> requisito de entrega que sigue sin cumplirse y no puede resolverse editando
> documentación: hay que decidir si se hace público antes de la defensa.

El bloque 2 añadirá el dominio de reputación o valoración después de que un
evento se complete. El bloque 3 demostrará extensibilidad mediante un puerto
`PaymentGateway` y un adaptador falso. La simulación es deliberada: no se debe
integrar cobro real sin análisis legal, fiscal, antifraude, de privacidad y de
custodia de fondos. La propuesta reserva explícitamente esa capacidad como una
extensión futura ([`proposal.md`, secciones 3 y 8](../openspec/changes/bootstrap-vivetutiempo-platform/proposal.md)).

El backlog funcional posterior puede incluir una experiencia pública de consulta
más rica, filtros no sensibles, información de accesibilidad de las actividades,
notificaciones y herramientas de moderación. Cada ampliación deberá conservar
la proyección pública mínima, la separación de capas y la revisión de seguridad
previa a su implementación.

## 10. Conclusión provisional

> **TODO (autor):** esta sección es argumentación propia y se ha dejado
> intacta deliberadamente. Contiene, sin embargo, una afirmación que ya no es
> cierta: «La infraestructura real, las migraciones, la interfaz y el despliegue
> siguen siendo trabajo en progreso». En la revisión `482aefd` las cuatro están
> implementadas, verificadas en CI y desplegadas. Conviene reescribir el párrafo
> final —con tus propias palabras y tu propio criterio— para que la conclusión
> refleje el estado real: un núcleo desplegado y con evidencia ejecutada, cuyo
> trabajo pendiente es de endurecimiento y observabilidad, no de construcción.

Vivetutiempo plantea un problema social concreto y lo aborda mediante un flujo
acotado: convertir disponibilidad hospitalaria y propuestas culturales en
eventos publicados, con roles y decisiones trazables. La principal aportación
técnica del TFM es hacer explícitas las reglas que suelen quedar ocultas en una
aplicación CRUD: estados, propiedad, cascadas, concurrencia, revocación y
exposición mínima de datos.

El dominio y la aplicación ya proporcionan una base valiosa para esta defensa:
modelan las transiciones, expresan puertos y contienen pruebas unitarias. La
infraestructura real, las migraciones, la interfaz y el despliegue siguen siendo
trabajo en progreso. La versión final de esta memoria deberá actualizar este
estado con resultados de pruebas ejecutadas, evidencia de despliegue y el cierre
de los hallazgos adversariales abiertos. Esta distinción entre evidencia
disponible y trabajo pendiente es esencial para que el TFM sea técnicamente
honesto y defendible.

## Referencias internas del proyecto

- [`proposal.md`](../openspec/changes/bootstrap-vivetutiempo-platform/proposal.md)
- [`design.md`](../openspec/changes/bootstrap-vivetutiempo-platform/design.md)
- [`tasks.md`](../openspec/changes/bootstrap-vivetutiempo-platform/tasks.md)
- [Especificación de perfiles](../openspec/changes/bootstrap-vivetutiempo-platform/specs/profile-onboarding/spec.md)
- [Especificación de coordinación de huecos y propuestas](../openspec/changes/bootstrap-vivetutiempo-platform/specs/slot-proposal-coordination/spec.md)
- [Especificación de consulta pública](../openspec/changes/bootstrap-vivetutiempo-platform/specs/public-event-browsing/spec.md)
- [Revisiones adversariales](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/)
