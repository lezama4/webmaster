# Revisión adversarial de planificación — Vivetutiempo, bloque 1

Revisión de `proposal.md`, `design.md`, `tasks.md` y las tres especificaciones
incluidas en `specs/`. No se ha inspeccionado ni modificado código de la
aplicación.

## BLOCKER

### B1 — La concurrencia de aprobar y enviar una propuesta deja una ventana que viola el invariante

**Referencias:** `design.md` §D4 (líneas 24–26), `design.md` §Approve-Proposal
Sequence (líneas 52–59), `specs/slot-proposal-coordination/spec.md` §“Accepting
a Proposal…” (líneas 51–62), `tasks.md` 4.4–4.5.

El `UPDATE slots ... WHERE status = 'open'` impide que dos aprobaciones llenen
el mismo Slot, y el índice parcial impide dos propuestas `accepted`. Sin
embargo, no serializa `submitProposal` respecto de la aprobación. Una petición
de envío puede comprobar que el Slot está `open`; después la aprobación bloquea
el Slot, rechaza las propuestas que había leído y confirma; finalmente el envío
pendiente inserta una propuesta `submitted`. El resultado es una propuesta
accionable en un Slot `filled`, que no fue incluida en el auto-rechazo.

La corrección debe formar parte del diseño y de las tareas: toda transición que
dependa de que el Slot esté abierto (`submitProposal`, aprobar y cerrar) debe
coordinarse sobre la misma fila, por ejemplo mediante `SELECT ... FOR UPDATE`
dentro de una transacción, o un `INSERT ... SELECT ... WHERE EXISTS` protegido
por un bloqueo/condición atómica equivalente. Añadir una prueba de integración
que intercale `submitProposal` y `approveProposal`, no solo dos aprobaciones.

### B2 — La especificación de retirada/cierre no tiene diseño ni tareas de implementación

**Referencias:** `specs/slot-proposal-coordination/spec.md` §“Withdrawing a
Slot Resolves Outstanding Proposals” (líneas 74–89), `design.md` §Application
Layer (líneas 43–47), `tasks.md` fases 2–5.

La especificación exige que un Hospital pueda cerrar/retirar un Slot y que sus
propuestas `submitted` dejen de ser accionables. No existe el caso de uso
`closeSlot`/`withdrawSlot`, ruta, pantalla, operación transaccional, regla de
dominio, ni prueba asociada. El estado `closed` por sí solo no implementa el
requisito, y tampoco define si las propuestas deben pasar a `rejected` o solo
quedar bloqueadas. El flujo obligatorio del bloque 1 no queda completo hasta
resolver esta discrepancia.

## MAJOR

### M1 — El conjunto de semillas es internamente imposible según el modelo declarado

**Referencias:** `design.md` §Domain Model (líneas 35–41) y §Seed Dataset
(líneas 76–87); `tasks.md` 6.1.

Se declaran cuatro Slots: S1 abierto, S2 lleno con una propuesta aceptada, S3
abierto y S4 cerrado. A la vez se declaran dos Events: uno publicado desde S2 y
otro completado. Como `Event.slotId` y `Event.proposalId` son únicos y el único
Slot/propuesta aceptada identificado es S2, no hay un segundo origen válido para
el Event completado. El seed no puede demostrar coherentemente la “seam” de
Block 2 sin añadir otro Slot lleno/propuesta aceptada/Event, o sin retirar ese
Event de Block 1.

### M2 — La re-inscripción de perfiles rechazados es ambigua e incompatible con las restricciones propuestas

**Referencias:** `specs/profile-onboarding/spec.md` §“Rejected Profile May
Re-Register” (líneas 66–74), `design.md` §Domain Model (líneas 35–41),
`tasks.md` 3.2–3.3.

La especificación dice que el perfil rechazado vuelve a `pending`, mientras el
modelo declara `Profile.accountId (unique)` y una transición de perfil que solo
muestra `pending -> active | rejected`. No está decidido si la re-inscripción
reactiva el mismo perfil, crea una nueva solicitud independiente, o crea otra
cuenta; las dos últimas chocan con las unicidades o cambian la trazabilidad.
Además, las tareas solo cubren crear un perfil pendiente, no este escenario.
Definir la transición explícita y su auditoría/justificación antes de codificar;
la opción más simple es `rejected -> pending` en el mismo perfil, registrada
como una nueva solicitud de revisión.

### M3 — La seguridad de sesión está incompleta para una superficie autenticada de producción

**Referencias:** `design.md` §D1 (líneas 11–14), `design.md` §Testing Strategy
(líneas 89–98), `tasks.md` 4.6, 5.2 y 5.8.

Se fijan atributos correctos de cookie y argon2id, pero faltan requisitos y
tareas para expiración absoluta e inactividad, rotación de identificador al
login, revocación/borrado en logout, invalidación de todas las sesiones al
rechazar o desactivar un perfil, límites de intentos de login y pruebas de esos
controles. `SameSite=Lax` reduce CSRF, pero no sustituye una política CSRF
explícita para todas las mutaciones autenticadas ni la comprobación de
`Origin`/`Host`. La justificación contra JWT menciona revocación al rechazar,
pero las transiciones actuales solo permiten rechazar perfiles pendientes:
falta definir la desactivación de un perfil activo y su efecto sobre sesiones.

### M4 — El contrato público no limita los datos expuestos ni tiene pruebas de fuga

**Referencias:** `proposal.md` §8 (línea 138), `design.md` §D3 (líneas 21–22),
`specs/public-event-browsing/spec.md` (líneas 9–29), `tasks.md` 5.7 y 6.2.

El diseño asume que los Events publicados no contienen datos sensibles, pero no
define un DTO/proyección pública ni qué campos se pueden devolver. La ubicación
libre (sala/planta), descripción, mensaje de propuesta y datos del artista son
material sensible en un entorno hospitalario si se filtran por un `include` de
Prisma o se reutiliza una vista interna. Definir una proyección allow-list para
la API pública, prohibir identificadores y contenido de Proposal/Profile, y
probar expresamente que los no publicados y sus campos nunca aparecen.

### M5 — La cobertura de tareas no alcanza el criterio de “desplegado y demostrablemente funcional”

**Referencias:** `proposal.md` §5 (líneas 98–107), `tasks.md` fase 7
(líneas 99–103).

La propuesta exige una URL desplegada y verificable. La única tarea final es
“Vercel config + managed-Postgres env wiring”; no hay tarea para ejecutar una
migración segura en producción, cargar o provisionar datos de demostración,
desplegar, verificar la URL ni realizar un smoke/E2E contra el despliegue.
“Preparación” no satisface el criterio de éxito. Incorporar estas tareas y sus
responsables/evidencias antes de considerar cerrado el bloque.

### M6 — Faltan pruebas y decisiones de borde para autorización y estados terminales

**Referencias:** `specs/slot-proposal-coordination/spec.md` §“Only the Owning
Hospital…” (líneas 35–49) y §“Approval Is Denied…” (líneas 64–72), `design.md`
§Application Layer (líneas 43–47), `tasks.md` 3.12 y 5.8.

Se prueba que un Hospital ajeno no puede actuar, pero no se especifican ni se
planifican pruebas para: Admin intentando aprobar/rechazar propuestas, Artist o
Patient intentando las mutaciones de Hospital/Admin, propuesta cuyo `id` no
pertenece al `slotId` de la URL, propuesta ya rechazada/aceptada, ni perfil que
pasa a rechazado entre la creación de sesión y la mutación. Cada caso debe
fallar en aplicación, no depender de ocultar botones ni de la ruta.

## MINOR

### N1 — Contradicción sobre el momento de aplicar TDD estricto

**Referencias:** `proposal.md` §3 y §5 (líneas 50–60 y 98–107), `design.md`
§Testing Strategy (líneas 89–98), `tasks.md` fases 2–3.

La propuesta habla de scaffolding para que el TDD estricto pueda activarse más
adelante y dice que está actualmente desactivado; diseño y tareas lo exigen ya
para dominio y aplicación. No bloquea el producto, pero sí debilita la
trazabilidad metodológica del TFM. Elegir una formulación única y documentar la
evidencia esperada (commits RED/GREEN o equivalente).

### N2 — La especificación no define la visibilidad de Slots abiertos ni el tratamiento de horarios inválidos

**Referencias:** `design.md` §D3 (líneas 21–22), `design.md` §Application
Layer (línea 45), `specs/slot-proposal-coordination/spec.md` (líneas 19–33),
`tasks.md` 3.8–3.11.

Existe `listOpenSlots`, pero ninguna especificación determina si solo artistas
activos pueden listarlos, qué información ven, ni cómo se filtran Slots en el
pasado. Tampoco hay invariantes para fecha futura, duración positiva, longitud
de texto o ubicación. Definirlo evita exponer agenda interna y datos de mala
calidad.

### N3 — “No PII” es una afirmación inexacta para el alcance descrito

**Referencias:** `proposal.md` §6 (línea 117), `design.md` §Domain Model
(líneas 35–39).

Email, nombre de perfil, credenciales y posiblemente ubicación ya son datos
personales o sensibles por contexto. Para una defensa académica sólida, sustituir
esa afirmación por minimización de datos, base de tratamiento/aviso de privacidad,
retención y procedimiento de borrado, aunque la demo use datos ficticios.

## OPEN QUESTIONS

1. Al cerrar un Slot, ¿las propuestas pendientes se rechazan de forma explícita
   y auditable, o se conserva `submitted` con una regla que las hace
   inaccionables? La primera opción conserva un estado coherente y simplifica
   consultas.
2. ¿Debe un perfil activo poder ser suspendido/desactivado por Admin? Si sí, hay
   que añadir estado/transición, revocación de sesión y comportamiento para sus
   Slots y Propuestas existentes.
3. ¿Qué campos exactos de un Event pueden ser públicos, especialmente ubicación
   hospitalaria, identidad del artista y descripción? Esa decisión debe
   preceder al DTO público y a los tests de no divulgación.
4. ¿La re-inscripción de un rechazado conserva su misma cuenta/perfil o crea una
   nueva solicitud versionada? Debe resolverse antes del esquema y las
   restricciones únicas.
