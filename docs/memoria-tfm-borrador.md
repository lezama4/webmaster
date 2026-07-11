# Vivetutiempo: plataforma de coordinación cultural en el ámbito hospitalario

## Primer borrador de memoria técnica del Trabajo de Fin de Máster

> **Nota de alcance y evidencia.** Este documento describe el estado del proyecto
> en el momento de su redacción. La capa de dominio y la capa de aplicación se
> han revisado como fuentes de implementación. La infraestructura de persistencia,
> sesiones, migraciones y Prisma está **en progreso** y no se ha inspeccionado
> para este borrador. Por tanto, ninguna afirmación sobre transacciones reales,
> cookies emitidas, esquema definitivo o despliegue debe interpretarse como
> verificada todavía.

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
   aplicación, futuras pruebas de integración contra PostgreSQL y pruebas
   extremo a extremo.
7. Documentar decisiones y riesgos de seguridad para que la demostración sea
   reproducible y defendible ante un tribunal.

### 2.3 Alcance por bloques

| Bloque | Alcance | Estado en este borrador |
| --- | --- | --- |
| 1. Núcleo | Registro y validación de perfiles, huecos, propuestas competidoras, aprobación/rechazo, creación de eventos y consulta pública. | Dominio y aplicación implementados; infraestructura, interfaz y despliegue en progreso. |
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
| PostgreSQL y Prisma | PostgreSQL proporciona transacciones y bloqueo de filas necesarios para el caso de concurrencia. Prisma reduce trabajo repetitivo de acceso a datos, mientras que las restricciones que no expresa se documentan como migraciones SQL explícitas. Su adaptador está **en progreso**. |
| Sesiones en base de datos, no JWT | La revocación inmediata es un requisito: un administrador puede rechazar o desactivar a un perfil y todas sus sesiones deben quedar invalidadas. Las sesiones persistidas permiten aplicar esa decisión sin esperar a que caduque un token autocontenido. Véase [`design.md`, ADR D1](../openspec/changes/bootstrap-vivetutiempo-platform/design.md). |
| argon2id para contraseñas | Se establece como el algoritmo de hashing detrás de un puerto de aplicación, evitando que el dominio conozca credenciales o bibliotecas criptográficas. El adaptador real está **en progreso**. |
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

La capa de infraestructura materializará los puertos de repositorio, unidad de
trabajo, sesiones, hash de contraseñas, limitación de intentos y consultas de
lectura. Esa capa está **en progreso** y no forma parte de la evidencia revisada
en este documento.

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

La semántica se ha expresado en los casos de uso de aplicación. La demostración
definitiva de bloqueo real, índices parciales y reversión transaccional requiere
pruebas de integración contra PostgreSQL y pertenece a la infraestructura **en
progreso**; no se afirma como verificada en este borrador.

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
| Unitario de dominio | Probar fábricas, transiciones, propiedad, invariantes y cascadas sin E/S. | Implementado en `tests/unit/domain/`. |
| Unitario de aplicación | Probar autorización, orquestación, puertos y mapeo de errores con dobles en memoria. | Implementado en `tests/unit/application/`. |
| Integración | Verificar Prisma/PostgreSQL, transacciones, bloqueos, índices y adaptadores de sesión. | En progreso con la infraestructura; pendiente de ejecución y evidencia. |
| Extremo a extremo | Verificar el flujo desplegado desde interfaz hasta persistencia y consulta pública. | Planificado para bloque 1. |

Las pruebas de dominio cubren, entre otros casos, la aceptación con rechazo de
rivales, la publicación del evento, la imposibilidad de aceptar en huecos
cerrados o llenos y la propiedad del Hospital
([`tests/unit/domain/acceptProposal.test.ts`](../tests/unit/domain/acceptProposal.test.ts)).
También existe cobertura específica para el cierre y el rechazo en cascada
([`tests/unit/domain/closeSlot.test.ts`](../tests/unit/domain/closeSlot.test.ts)).

En aplicación hay pruebas para autorización por rol, decisiones del Hospital,
sesiones y denegaciones. Estas pruebas dan confianza sobre la orquestación, pero
los dobles en memoria no pueden probar por sí solos un bloqueo de base de datos
ni una transacción real. La memoria final deberá informar resultados de las
ejecuciones reproducibles y distinguirlos de la simple presencia de tests.

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
acciones derivadas. No deben presentarse como una certificación automática de
seguridad: varios hallazgos siguen abiertos hasta que se verifiquen los
adaptadores y las pruebas de integración. Los informes están disponibles en
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
- **Sesiones revocables diseñadas.** `SessionPort` define expiración absoluta y
  por inactividad, creación de identificadores nuevos, cierre de sesión y
  revocación total por cuenta. La emisión y revocación se plantean dentro de una
  unidad de trabajo de perfil ([`SessionPort.ts`](../src/application/ports/SessionPort.ts)
  y [`ProfileUnitOfWork.ts`](../src/application/ports/ProfileUnitOfWork.ts)).
  Su adaptador persistente y la cookie real están **en progreso**.
- **Superficie pública reducida.** La especificación permite únicamente título,
  descripción, fecha, duración y nombre público del artista. Prohíbe ubicación
  exacta, mensaje de propuesta, correos e identificadores
  ([`public-event-browsing/spec.md`](../openspec/changes/bootstrap-vivetutiempo-platform/specs/public-event-browsing/spec.md)).
- **Concurrencia como seguridad de integridad.** El protocolo de bloqueo evita
  decisiones contradictorias y estados imposibles causados por peticiones
  simultáneas.

### 8.2 Riesgos abiertos que deben cerrarse antes de exponer el MVP

La rigurosidad de la memoria exige mantener visibles los hallazgos pendientes:

1. La consulta pública actual reenvía el resultado del puerto tal como lo
   recibe. Una interfaz TypeScript no elimina propiedades adicionales en tiempo
   de ejecución; debe construir un DTO nuevo campo a campo y probar que descarta
   valores prohibidos ([`codex-pr2a-review.md`, pr2a-B1](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr2a-review.md)).
2. La re-inscripción de un perfil rechazado debe autenticar de forma segura a
   la cuenta existente y verificar coherencia entre rol y tipo de perfil. El
   informe actual identifica una vía que no valida la contraseña
   ([`codex-pr2a-review.md`, pr2a-B2](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr2a-review.md)).
3. El esquema persistente debe reflejar `DEACTIVATED` y la evidencia de nueva
   solicitud de revisión antes de persistir el ciclo de vida completo. Su
   migración está **en progreso** y no se ha evaluado aquí
   ([`codex-pr1-review.md`, B1](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr1-review.md)).
4. Se deben acotar y normalizar nombres de perfil y mensajes de propuesta para
   evitar abuso de almacenamiento, registros y renderizado
   ([`codex-pr1-review.md`, M2](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr1-review.md)).
5. La limitación de inicio de sesión debe contemplar tanto cuenta como cliente
   de confianza, no filtrar existencia de cuentas por tiempo de respuesta y
   estar respaldada por almacenamiento compartido en un entorno serverless
   ([`codex-pr2a-review.md`, pr2a-M2](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr2a-review.md)).
6. CSRF, cabeceras HTTP, validación estricta de peticiones, límites de tamaño,
   gestión de secretos, registro sin datos sensibles y pruebas contra origen no
   confiable deberán verificarse en los puntos de entrega HTTP. Son requisitos
   de la fase de infraestructura e interfaz, no garantías ya demostradas.

La seguridad debe evaluarse de nuevo cuando la infraestructura esté estable. El
criterio de salida no será que exista una cookie o una migración, sino que se
prueben revocación, expiración, origen CSRF, denegación de perfiles no activos,
carreras de concurrencia y ausencia de fugas en respuestas públicas.

## 9. Trabajo pendiente y evolución futura

El bloque 1 no debe declararse terminado hasta que se completen y verifiquen los
siguientes elementos:

- **Infraestructura en progreso:** repositorios Prisma, migraciones,
  restricciones de base de datos, unidad de trabajo transaccional, sesiones
  persistentes, hashing argon2id, limitación de intentos y consulta pública.
- **Interfaz y entrega:** rutas y componentes accesibles, validación de entrada
  en la frontera, traducción homogénea de errores, controles CSRF y cabeceras
  de seguridad.
- **Calidad verificable:** pruebas de integración con PostgreSQL que fuercen
  carreras de envío/aprobación/cierre/rechazo, y pruebas E2E contra un entorno
  desplegado.
- **Operación:** datos de demostración no sensibles, documentación de despliegue,
  gestión de secretos, URL pública, smoke test y evidencia reproducible.

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
