# Vivetutiempo

Plataforma web sin ánimo de lucro para coordinar actividades culturales en el
ámbito hospitalario. Vivetutiempo conecta a los Hospitales que publican huecos
de agenda con Artistas o dinamizadores que proponen actividades, bajo la
gobernanza de un Administrador. El resultado es un Evento publicado que puede
consultarse sin iniciar sesión.

El flujo central es:

```text
Hospital publica un hueco → Artista propone una actividad →
Hospital aprueba → se publica un Evento → consulta pública
```

Este repositorio es el entregable de un Trabajo de Fin de Máster (TFM) sobre
desarrollo de software asistido por IA, desarrollo guiado por especificaciones,
arquitectura hexagonal y seguridad por diseño. No procesa historias clínicas ni
pretende sustituir sistemas sanitarios: se limita a la coordinación de
actividades culturales.

> Estado honesto: el núcleo de dominio, aplicación e infraestructura está
> avanzado, pero el MVP completo aún requiere rutas HTTP, interfaz, datos de
> demostración, E2E, despliegue y evidencia de CI. Consultá el
> [informe de readiness](docs/tfm-readiness-report.md) para el estado detallado.

## Stack tecnológico

| Tecnología | Uso | Motivo |
| --- | --- | --- |
| Next.js (App Router) + TypeScript | Monolito web y capa de entrega | Mantiene tipado y una única base de código para interfaz y API. |
| React + Tailwind CSS | Interfaz | Componentes y estilos de la aplicación web. |
| PostgreSQL + Prisma | Persistencia | PostgreSQL aporta transacciones y bloqueos; Prisma implementa los adaptadores de persistencia. |
| Vitest | Pruebas unitarias e integración | Separa reglas de dominio/casos de uso de las pruebas reales contra PostgreSQL. |
| Playwright | Smoke y E2E | Verifica el flujo desplegado cuando las pantallas y rutas estén disponibles. |
| Docker Compose | PostgreSQL local | Entorno local reproducible y aislado. |
| Vercel + PostgreSQL gestionada | Despliegue objetivo | Reduce complejidad operativa para el alcance del TFM. |

La justificación de estas decisiones está desarrollada en la
[memoria técnica](docs/memoria-tfm-borrador.md) y en el
[diseño del cambio](openspec/changes/bootstrap-vivetutiempo-platform/design.md).

## Arquitectura

Vivetutiempo es un monolito modular organizado con arquitectura hexagonal:

```text
src/app + src/ui       Entrada Next.js y presentación
          ↓
src/application        Casos de uso, DTOs y puertos
          ↓
src/domain             Entidades, transiciones e invariantes puros
          ↑
src/infrastructure     Adaptadores Prisma, sesiones, hash, CSRF y reloj
```

- `domain` no depende de Next.js, Prisma, HTTP ni infraestructura.
- `application` coordina reglas de negocio a través de puertos.
- `infrastructure` implementa puertos concretos, como Prisma y sesiones.
- `app` y `ui` son la frontera de entrega; las rutas y pantallas del flujo
  completo siguen pendientes.

Las decisiones arquitectónicas y ADRs están en
[design.md](openspec/changes/bootstrap-vivetutiempo-platform/design.md).

## Estructura del proyecto

```text
.
├── docs/                         # Memoria, seguridad, readiness y despliegue
├── e2e/                          # Smoke/E2E de Playwright
├── openspec/                     # Propuesta, especificaciones, diseño, tareas y reviews
├── prisma/
│   ├── migrations/               # Migraciones PostgreSQL versionadas
│   └── schema.prisma             # Modelo Prisma
├── src/
│   ├── app/                      # App Router de Next.js (capa de entrada)
│   ├── domain/                   # Modelo de dominio independiente de frameworks
│   ├── application/              # Casos de uso, puertos y errores de aplicación
│   ├── infrastructure/           # Adaptadores de persistencia y seguridad
│   └── ui/                       # Componentes presentacionales reutilizables
├── tests/
│   ├── unit/                     # Dominio, aplicación, infraestructura y límites
│   └── integration/              # PostgreSQL, migraciones, sesiones y carreras
├── .github/workflows/ci.yml      # Validación continua con PostgreSQL
├── docker-compose.yml            # PostgreSQL local
└── package.json                  # Scripts y dependencias
```

## Funcionalidades y hoja de ruta

| Bloque | Alcance | Estado |
| --- | --- | --- |
| 1. Núcleo de coordinación | Perfiles, validación, Slots, Proposals, decisión del Hospital, Eventos y consulta pública. | **En progreso.** Dominio, aplicación, migraciones y adaptadores están presentes; rutas, UI, seed, E2E y despliegue siguen pendientes. |
| 2. Valoración | Valoración de Eventos completados por pacientes/familiares, una por cuenta y Evento. | **Planificado.** |
| 3. Mecenazgo simulado | Campañas de apoyo detrás de un puerto `PaymentGateway` y un adaptador falso; no procesa pagos reales. | **Planificado / en rama separada.** |

### Reglas de negocio principales del Bloque 1

- Un Hospital o Artista se registra con un perfil `pending`; un Admin lo aprueba
  o rechaza.
- Sólo los perfiles activos pueden publicar Slots o enviar Proposals.
- Un Slot puede recibir varias Proposals, pero sólo el Hospital propietario
  decide sobre él.
- Al aprobar una Proposal, el Slot pasa a `filled`, la Proposal seleccionada
  pasa a `accepted`, las rivales pendientes se rechazan y se crea un Evento
  `published`.
- La proyección pública está diseñada como una lista de campos permitidos:
  título, descripción, fecha/hora, duración y nombre público del Artista. No
  debe exponer ubicación exacta, mensajes privados, correos ni identificadores
  internos.

Las especificaciones verificables están en
[openspec/changes/bootstrap-vivetutiempo-platform/specs](openspec/changes/bootstrap-vivetutiempo-platform/specs/).

## Instalación y ejecución local

### Requisitos

- Node.js 22.x
- Docker Desktop o un PostgreSQL local accesible

### 1. Instalar dependencias y configurar el entorno

```bash
npm ci
cp .env.example .env
```

Reemplazá los valores de ejemplo por valores locales seguros. Nunca subas `.env`
ni secretos al repositorio.

### 2. Arrancar PostgreSQL local

```bash
docker compose up -d --wait
docker compose exec postgres pg_isready -U vivetutiempo -d vivetutiempo
```

El Compose actual es sólo para desarrollo local y publica PostgreSQL en el
puerto 5432. No lo uses como configuración de producción ni en redes no
confiables.

### 3. Generar Prisma y aplicar migraciones

```bash
npm run prisma:generate
npx prisma migrate deploy
```

Las migraciones se aplican en orden: esquema base y, después, índices únicos
parciales para las invariantes de Proposals.

### 4. Seed de demostración

```bash
npm run db:seed
```

El seed es idempotente: actualiza exclusivamente sus registros de demostración
con identificadores estables y utiliza datos ficticios. No cargues cuentas de
demostración manuales en un entorno compartido.

### 5. Arrancar la aplicación

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). En el estado actual, la
página principal es un scaffold; el flujo multirol completo está pendiente de
la Fase 5.

### 6. Ejecutar calidad y pruebas

```bash
npm run lint
npx tsc --noEmit
npm test
npm run test:e2e
```

Los tests de integración y carreras necesitan PostgreSQL real. Si Docker/WSL2
no está disponible localmente, Vitest los marca como **skipped**, no como
aprobados. La ejecución requerida de esas suites ocurre en GitHub Actions con
un servicio PostgreSQL efímero. Ver [Testing y calidad](#testing-y-calidad).

## Seed credentials

Todas estas credenciales son ficticias y exclusivas del seed de demostración.
No se deben reutilizar en ningún entorno real.

| Role | Email | Password | Expected state |
| --- | --- | --- | --- |
| Admin | `admin@vtt.test` | `VivetuTiempo2026!` | Can validate and deactivate Profiles. |
| Hospital (San Juan) | `hospital.sanjuan@vtt.test` | `VivetuTiempo2026!` | Active; owns all five demo Slots. |
| Hospital (Esperanza) | `hospital.esperanza@vtt.test` | `VivetuTiempo2026!` | Pending; demonstrates Admin validation. |
| Artist (Clara) | `artist.clara@vtt.test` | `VivetuTiempo2026!` | Active; submits S1 and owns the accepted S5 Proposal. |
| Artist (Mateo) | `artist.mateo@vtt.test` | `VivetuTiempo2026!` | Active; submits S1, owns the accepted S2 Proposal, and the S4 cascade-rejected Proposal. |
| Artist (Lucía) | `artist.lucia@vtt.test` | `VivetuTiempo2026!` | Pending; demonstrates Admin validation. |
| Patient/Family (Ana) | `patient.ana@vtt.test` | `VivetuTiempo2026!` | Authenticated browsing role; no Profile in Block 1. |

## Despliegue

El objetivo es Vercel con PostgreSQL gestionada (Neon o Supabase). La URL de
producción es: **TBD**.

El despliegue requiere variables de entorno, migración controlada,
aprovisionamiento de datos demo, CI verde y una comprobación posterior. El
procedimiento reproducible, el rollback y los controles de seguridad están en
[docs/deployment.md](docs/deployment.md).

No se debe declarar el despliegue como realizado hasta que exista una URL,
migraciones aplicadas, seed ejecutado, CI verificable y smoke test del flujo
completo para el mismo commit.

## Testing y calidad

El proyecto aplica TDD selectivo en las capas de dominio y aplicación, junto con
revisiones adversariales documentadas en
[openspec/changes/bootstrap-vivetutiempo-platform/reviews](openspec/changes/bootstrap-vivetutiempo-platform/reviews/).

| Capa | Qué valida | Estado de evidencia |
| --- | --- | --- |
| Unitarios de dominio | Estados, invariantes, propiedad, cascadas y errores de transición. | Suite implementada. |
| Unitarios de aplicación | Roles, autorización, casos de uso, puertos y DTO público. | Suite implementada. |
| Integración PostgreSQL | Migraciones, índices parciales, bloqueos, transacciones, sesiones y rate limiting. | Tests escritos; deben ejecutarse con PostgreSQL en CI. |
| E2E / smoke | Flujo completo y consulta pública desplegada. | Smoke de scaffold disponible; flujo E2E completo pendiente. |

La concurrencia no se presenta como probada sólo porque exista código o tests:
su evidencia requiere que las pruebas de integración/carreras se ejecuten con
PostgreSQL real en CI. Los riesgos y remediaciones abiertas están consolidados
en [docs/tfm-readiness-report.md](docs/tfm-readiness-report.md).

## Seguridad

El modelo de amenazas cubre control de acceso, sesiones, CSRF, validación de
entrada, datos públicos, concurrencia, secretos y retención. Las sesiones de
base de datos, argon2id, el rate limiter de PostgreSQL y la comprobación de
origen canónico son controles implementados como adaptadores o contratos; las
rutas HTTP que los aplican siguen pendientes.

Antes de una exposición pública deben cerrarse las verificaciones de rutas,
cookies, CSRF, pruebas reales de concurrencia, logging y políticas de retención.
Ver [docs/security-threat-model.md](docs/security-threat-model.md) y el
[informe de readiness](docs/tfm-readiness-report.md).

## Enlaces de entrega del TFM

| Entregable | Enlace |
| --- | --- |
| Repositorio público | TBD |
| Despliegue de producción | TBD |
| Slides / presentación | TBD |
| Vídeo de demostración | TBD |
| Memoria técnica | [docs/memoria-tfm-borrador.md](docs/memoria-tfm-borrador.md) |
| Runbook de despliegue | [docs/deployment.md](docs/deployment.md) |
| Modelo de amenazas | [docs/security-threat-model.md](docs/security-threat-model.md) |

## Documentación de proyecto

- [Propuesta](openspec/changes/bootstrap-vivetutiempo-platform/proposal.md)
- [Diseño y ADRs](openspec/changes/bootstrap-vivetutiempo-platform/design.md)
- [Especificaciones](openspec/changes/bootstrap-vivetutiempo-platform/specs/)
- [Plan de tareas](openspec/changes/bootstrap-vivetutiempo-platform/tasks.md)
- [Tracker de readiness y hallazgos](docs/tfm-readiness-report.md)
- [Runbook de despliegue](docs/deployment.md)
