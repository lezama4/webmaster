# Vivetutiempo

Vivetutiempo es una plataforma web gratuita y sin fines de lucro que reduce las
horas muertas de pacientes y familias en hospitales mediante actividades
culturales. Los Hospitales publican Slots de agenda, los Artistas proponen
actividades, un Admin valida los perfiles de Hospitales y Artistas, y los
pacientes/familias navegan Eventos publicados sin necesidad de cuenta.

```text
Hospital publica un Slot -> Artista presenta una Proposal ->
Hospital propietario aprueba -> se publica un Evento -> consulta pública
```

Este repositorio es el entregable técnico de un Trabajo de Fin de Máster (TFM).
Su objetivo es demostrar una aplicación real y defendible: reglas de dominio
explícitas, Arquitectura Limpia/Hexagonal, pruebas con evidencia y seguridad por
diseño. No recopila historias clínicas ni datos de salud de pacientes.

## Estado y alcance

El Bloque 1 implementa el núcleo de coordinación: registro y validación de
perfiles, acceso por roles, Slots, Proposals competidoras, aprobación/rechazo,
publicación automática de Eventos y consulta pública. Los Bloques 2 y 3 quedan
planificados para valoraciones y mecenazgo simulado; no se procesan pagos reales.

La aplicación está desplegada en **https://webmaster-lemon.vercel.app**
(Vercel + PostgreSQL gestionado en Neon), con el dataset de demostración
cargado y verificado sobre el mismo commit publicado en `main`.

Además del núcleo del Bloque 1, dos rutas públicas de solo lectura completan
la primera impresión del sitio:

- **`/encuentra-tu-momento`** — directorio público de hospitales activos, con
  búsqueda por nombre/ciudad/código postal y un mapa indicativo (no a escala).
  No expone dirección postal, email ni ningún dato que correlacione un
  hospital con sus Eventos.
- **`/quienes-somos`** — página estática que explica el propósito, los cuatro
  roles (Admin, Hospital, Artista, Paciente/Familia), el flujo de alto nivel,
  la validación de perfiles por un Admin, qué datos se publican y cuáles se
  excluyen deliberadamente, y por qué la plataforma es gratuita y sin ánimo de
  lucro. El paso a paso operativo sigue viviendo en `/ayuda`; esta página no
  lo repite.

## Stack tecnológico

| Tecnología | Uso en el proyecto |
| --- | --- |
| Next.js 16 (App Router) + TypeScript | Monolito y capa de entrega: páginas y Route Handlers. |
| React 19 + Tailwind CSS v4 | Interfaz accesible y responsive. |
| PostgreSQL 16 + Prisma 6 | Persistencia relacional, transacciones, bloqueos y migraciones. |
| Vitest | Pruebas unitarias de dominio/aplicación e integración/concurrencia con PostgreSQL. |
| Playwright | Pruebas de navegador, smoke y E2E. |
| Docker Compose | Entorno local de PostgreSQL desechable. |
| Vercel + PostgreSQL gestionado | Despliegue objetivo con una carga operativa acorde al TFM. |

## Arquitectura y decisiones clave

Vivetutiempo es un monolito modular con Arquitectura Hexagonal:

```text
src/app + src/ui           Entrega y presentación
          |
src/application            Casos de uso, puertos, DTO y autorización
          |
src/domain                 Entidades e invariantes sin framework
          |
src/infrastructure         Prisma, sesiones, criptografía y adaptadores HTTP
```

- `src/domain` no importa Next.js, Prisma, HTTP ni infraestructura.
- `src/application` coordina las operaciones de dominio mediante puertos y
  vuelve a comprobar rol, propiedad y estado activo antes de cada acción
  protegida.
- `src/infrastructure` implementa repositorios Prisma, sesiones en base de
  datos, hash de contraseñas, CSRF y la raíz de composición.
- `src/app` es la entrada de App Router; `src/ui` contiene componentes
  presentacionales.

La invariante central de concurrencia es *lock-first*. `submitProposal`,
`approveProposal`, `rejectProposal` y `closeSlot` bloquean la fila del Slot
antes de leer los datos que determinan la decisión. La decisión y sus escrituras
ocurren dentro de la misma transacción. Aceptar una Proposal llena el Slot,
acepta la elegida, rechaza las Proposals enviadas rivales y publica el Evento de
forma atómica.

Controles de seguridad relevantes para la defensa:

- Sesiones opacas en base de datos, no JWT: permiten revocar en logout, rechazo
  y desactivación. La base solo almacena el hash del token; las sesiones tienen
  caducidad absoluta e inactividad.
- Contraseñas con Argon2id y parámetros fijados explícitamente.
- CSRF de origen canónico para peticiones inseguras. `APP_ORIGIN` falla cerrado:
  un origen ausente, malformado o distinto se rechaza.
- Proyección pública de Eventos mediante allow-list: excluye ubicación de
  planta/sala, mensajes de Proposal, emails e identificadores internos.

Las decisiones y especificaciones detalladas están en
[design.md](openspec/changes/bootstrap-vivetutiempo-platform/design.md) y en
[openspec/changes/bootstrap-vivetutiempo-platform/specs](openspec/changes/bootstrap-vivetutiempo-platform/specs/).

## Configuración local

### Requisitos

- Node.js 22.x y npm.
- Docker Desktop, o una base PostgreSQL 16 compatible accesible.

### 1. Instalar dependencias y configurar el entorno

```bash
npm ci
cp .env.example .env
```

En PowerShell puede usarse `Copy-Item .env.example .env`. Reemplazá los valores
de ejemplo en `.env` y nunca subas ese archivo al repositorio.

### 2. Arrancar PostgreSQL

```bash
docker compose up -d --wait
docker compose exec postgres pg_isready -U vivetutiempo -d vivetutiempo
```

La base de Compose es para desarrollo y contiene datos desechables. El archivo
publica el puerto 5432 del host, por lo que solo debe ejecutarse en una máquina
local y una red de confianza.

### 3. Generar Prisma, migrar y cargar el seed de demostración

```bash
npm run prisma:generate
npx prisma migrate deploy
npm run db:seed
```

El seed es idempotente y solo escribe registros ficticios y estables de demo:
16 cuentas, cinco Slots, dos Eventos y diez hospitales `ACTIVE` (más uno
`PENDING`, Hospital Esperanza) que alimentan `/encuentra-tu-momento`. Uno de
los diez hospitales `ACTIVE` (Hospital del Guadiana) no tiene coordenadas: se
lista en el buscador pero no muestra pin en el mapa. No debe utilizarse para
cargar datos reales de hospitales, artistas o pacientes.

### 4. Arrancar la aplicación

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

### 5. Comandos de calidad

| Propósito | Comando |
| --- | --- |
| Lint | `npm run lint` |
| Typecheck | `npx tsc --noEmit` |
| Suite unitaria e integración | `npm run test` |
| E2E de navegador | `npm run test:e2e` |

Las pruebas de integración y concurrencia necesitan PostgreSQL real. Sin una
base accesible se informan como **skipped**, nunca como aprobadas. Con Docker
activo, se puede habilitarlas explícitamente:

```bash
$env:VIVETUTIEMPO_RUN_INTEGRATION = "true" # PowerShell
npm run test
```

Esa variable también habilita
`tests/integration/public-hospital-directory-query.test.ts` (el adaptador
Prisma de `/encuentra-tu-momento`) contra la base real. **Importante**: las
pruebas de integración llaman a `resetDatabase()` sobre la misma base que usa
Playwright, así que borran el dataset de demostración. Después de ejecutarlas,
volvé a correr `npm run db:seed` antes de lanzar `npm run test:e2e`, o cada
prueba E2E fallará por falta de datos.

## Seed credentials

Todas las cuentas siguientes son ficticias y exclusivas del seed aislado del
TFM. No deben reutilizarse en un entorno real. La contraseña de todas es
`VivetuTiempo2026!`.

| Rol | Email | Estado esperado |
| --- | --- | --- |
| Admin | `admin@vtt.test` | Puede validar y desactivar Profiles. |
| Hospital — San Juan | `hospital.sanjuan@vtt.test` | Activo; propietario de los cinco Slots demo. |
| Hospital — Esperanza | `hospital.esperanza@vtt.test` | Pendiente; demuestra la validación del Admin. |
| Artista — Clara | `artist.clara@vtt.test` | Activa; Proposal competidora de S1 y aceptada de S5. |
| Artista — Mateo | `artist.mateo@vtt.test` | Activo; Proposal competidora de S1, aceptada de S2 y rechazada en cascada en S4. |
| Artista — Lucía | `artist.lucia@vtt.test` | Pendiente; demuestra la validación del Admin. |
| Paciente/Familiar — Ana | `patient.ana@vtt.test` | Rol ligero de consulta; sin Profile en el Bloque 1. |

El seed reproduce estos estados:

- S1: `open`, con Clara y Mateo compitiendo mediante Proposals `submitted`.
- S2: `filled`, con Mateo aceptado y un Evento `published`.
- S3: `open`, sin Proposals.
- S4: `closed` por la operación de dominio de cierre; la Proposal de Mateo se
  rechaza en cascada.
- S5: `filled`, con Clara aceptada y un Evento `completed`.

## CI, evidencia de pruebas y despliegue

GitHub Actions aprovisiona PostgreSQL 16, genera Prisma Client, aplica
migraciones y ejecuta lint, typecheck y `npm run test` en los pushes y pull
requests relevantes. El proyecto de integración se ejecuta en serie contra esa
base real e incluye carreras lock-first, sesiones e invariantes de concurrencia.
Esta es la evidencia de ejecución clave del TFM cuando la virtualización local
no está disponible.

Playwright está configurado tanto para local como para una URL desplegada. Una
ejecución contra el despliegue se realiza con:

```bash
PLAYWRIGHT_BASE_URL="https://url-produccion.example" npm run test:e2e
```

El workflow versionado incluye además un job `e2e` independiente que
aprovisiona su propio PostgreSQL 16, aplica migraciones, carga el seed de
demostración, instala Chromium y ejecuta `npm run test:e2e` contra esa base
real. Se dispara en los mismos pushes y pull requests que el resto de la
verificación, de modo que la evidencia E2E en CI sí puede afirmarse.

Esa ejecución en CI es más fiable que una local: parte de una base limpia en
cada intento, mientras que en local la base se comparte entre ejecuciones y las
suites que registran perfiles no los limpian al terminar.

El procedimiento de producción, variables requeridas, CSRF de origen canónico,
rollback y comprobaciones posteriores están en
[docs/deployment.md](docs/deployment.md).

## Documentación del TFM

- [Propuesta](openspec/changes/bootstrap-vivetutiempo-platform/proposal.md)
- [Diseño y ADRs](openspec/changes/bootstrap-vivetutiempo-platform/design.md)
- [Especificaciones](openspec/changes/bootstrap-vivetutiempo-platform/specs/)
- [Plan de tareas](openspec/changes/bootstrap-vivetutiempo-platform/tasks.md)
- [Borrador de memoria técnica](docs/memoria-tfm-borrador.md)
- [Modelo de amenazas](docs/security-threat-model.md)
- [Runbook de despliegue](docs/deployment.md)
