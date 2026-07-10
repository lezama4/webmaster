# Contexto de proyecto — Vivetutiempo

Documento de traspaso para continuar el proyecto después de migrar de PC.

**Fecha de generación:** 2026-07-10  
**Workspace actual:** `C:\Users\koldobika\OneDrive - Berritzen\Documentos\WEB MASTER`  
**Estado:** proyecto conceptual + reglas de trabajo + skills; la aplicación todavía no está scaffolded.

## Resumen ejecutivo

**Vivetutiempo** es el nombre provisional de una plataforma web gratuita y sin ánimo de lucro para reducir las horas muertas de pacientes y familiares en hospitales mediante actividades culturales, artísticas y humanas.

La idea central es conectar:

- **Hospitales**, que publican huecos disponibles en su agenda.
- **Artistas / dinamizadores / voluntarios**, que proponen actividades para esos huecos.
- **Pacientes y familiares**, que consultan eventos y valoran la experiencia después.
- **Mecenas / donantes / entidades**, que apoyan económicamente la actividad sin convertir la plataforma en marketplace comercial.
- **Administradores**, que validan perfiles, eventos, seguridad, reputación y cumplimiento.

El proyecto está orientado inicialmente a un **trabajo final de máster en desarrollo de programación con IA**, no a una puesta en producción real inmediata.

## Principios del proyecto

- Plataforma gratuita, de impacto social y sin ánimo de lucro.
- No monetizar artistas ni cobrar comisiones.
- Priorizar seguridad, mantenibilidad, UX, calidad, trazabilidad y arquitectura limpia.
- Usar **Spec-Driven Development** para justificar el proceso técnico.
- Demostrar buen uso de IA como herramienta dirigida por criterio humano.
- Evitar implementar pagos reales en el MVP salvo que exista una razón académica clara.
- Tratar deducciones fiscales/donaciones como hipótesis legal/compliance, no como promesa de producto.

## Problema que resuelve

En hospitales, pacientes y familiares pasan muchas horas de espera, acompañamiento o recuperación. Cuando existen actividades culturales, musicales, artísticas o sociales, el tiempo se vuelve más llevadero y mejora la experiencia humana del entorno hospitalario.

El problema no es solo “hacer eventos”, sino **coordinar de forma segura y trazable** a hospitales, artistas, voluntarios y entidades de apoyo.

## MVP recomendado

Para el máster, el MVP debería centrarse en demostrar arquitectura y flujo de negocio, no en cubrir todo el mundo real.

Alcance recomendado:

1. Registro/login por roles.
2. Hospital crea huecos de agenda.
3. Artista propone una actividad para un hueco.
4. Hospital/admin aprueba o rechaza la propuesta.
5. Evento aprobado queda publicado.
6. Pacientes/familiares pueden consultar eventos.
7. Valoración posterior con estrellas.
8. Panel básico de campañas/apoyo económico simulado o preparado para futura integración.

Fuera del MVP inicial:

- Pagos reales.
- Certificados fiscales reales.
- Integración con sistemas hospitalarios reales.
- Gestión legal completa de voluntariado, seguros o protección de menores.
- App móvil nativa.

## Diferenciación frente a iniciativas existentes

Se verificó que en España existen iniciativas relacionadas con arte, música o actividades en hospitales, por ejemplo:

- Músicos por la Salud.
- Cultura en Vena / Arte Ambulatorio.
- Fundación [H]arte.
- Believe in Art.
- ShowTime en Planta.

La oportunidad diferencial de Vivetutiempo no es “arte en hospitales” en abstracto, sino una **plataforma digital de coordinación multi-rol** con agenda, matching, aprobación, reputación, trazabilidad y gobernanza.

## Riesgo fiscal / donaciones

La deducción fiscal de donaciones en España depende de que la entidad receptora cumpla requisitos legales, especialmente los vinculados a entidades beneficiarias del mecenazgo y normativa aplicable.

Decisión de producto:

- No prometer deducción fiscal automáticamente.
- Presentarlo como posible evolución futura sujeta a validación legal.
- En el MVP, usar donaciones/campañas como módulo conceptual o simulado.

## Stack por defecto previsto

Si no se decide lo contrario, las reglas del proyecto definen este stack base:

| Área | Tecnología |
|---|---|
| Frontend | Next.js + TypeScript + Tailwind |
| Backend | Node.js + NestJS |
| Base de datos | PostgreSQL |
| Auth | JWT + OAuth |
| Infraestructura | Docker + Kubernetes |
| Cloud | AWS |
| Testing | Playwright + Vitest |
| CI/CD | GitHub Actions |

Estos defaults no son dogma. Para el máster puede tener sentido empezar más simple si ayuda a entregar calidad demostrable.

## Arquitectura objetivo

El proyecto debe demostrar:

- Clean Architecture / Hexagonal Architecture.
- Separación clara entre dominio, casos de uso, infraestructura y UI.
- Reglas de negocio independientes del framework.
- Validaciones por rol.
- Seguridad desde el diseño.
- Testing por capas.
- Documentación viva.

Dominios candidatos:

- Identity & Access.
- Hospital Management.
- Availability Slots.
- Activity Proposals.
- Event Scheduling.
- Event Feedback / Reputation.
- Patronage / Support Campaigns.
- Moderation / Admin Review.
- Audit Trail.

## SDD / estado de planificación

> **Nota crítica de migración:** no dependas de Engram como única fuente de verdad al cambiar de PC. En una comprobación posterior, Engram no devolvió de forma fiable el proyecto web master y apareció contexto de otro proyecto (portal ofertas), que NO pertenece a Vivetutiempo. Para continuar en el nuevo equipo, usa este archivo y los archivos locales como fuente principal; si hace falta, vuelve a ejecutar sdd-init y genera openspec/ en modo hybrid.


En una sesión anterior se reportó SDD inicializado en modo **Engram**, pero ese estado no debe considerarse portable ni verificable tras la migración.

Resultado reportado en la sesión anterior:

- `sdd-init/web master` fue reportado como guardado en Engram, pero no se debe asumir recuperable.
- `sdd/web master/testing-capabilities` fue reportado como guardado en Engram, pero no se debe asumir recuperable.
- `skill-registry` fue reportado como guardado en Engram, pero no se debe asumir recuperable.
- `.atl/skill-registry.md` generado localmente.
- No se creó `openspec/` porque el modo inicial fue Engram.

Estado técnico detectado en ese momento:

| Capacidad | Estado |
|---|---|
| App scaffolded | No |
| Test runner | No |
| Strict TDD | Desactivado hasta crear test runner |
| OpenSpec | No existe todavía |
| Skill registry local | Sí, en `.atl/skill-registry.md` |

Decisión pendiente ya acordada verbalmente:

- Continuar en modo **hybrid** para tener Engram + archivos `openspec/` versionables y entregables.

Siguiente fase recomendada:

- Lanzar SDD para el primer cambio: `bootstrap-vivetutiempo-platform`.
- Elegir modo de ejecución SDD: interactivo o automático.
- Recomendación: interactivo para revisar propuesta, specs, diseño y tareas antes de implementar.

## Estado actual del workspace

Inventario leído el 2026-07-10:

```text
WEB MASTER/
├── .atl/
│   └── skill-registry.md
├── skills/
│   ├── design-taste-frontend/SKILL.md
│   ├── image-to-code/SKILL.md
│   ├── redesign-existing-projects/SKILL.md
│   ├── web-project-standards/SKILL.md
│   └── webapp-testing/SKILL.md
├── .gitignore
└── AGENTS.md
```

No existe todavía:

- `package.json`.
- `README.md`.
- `src/`.
- `apps/`.
- `openspec/`.
- Configuración de tests.
- Configuración de Docker.
- Repositorio Git local independiente dentro de `WEB MASTER`.

Nota importante:

- La carpeta está dentro de un worktree Git más amplio en `C:\Users\koldobika`.
- `WEB MASTER` no tiene su propio `.git/` local.
- En la verificación de migración, los archivos del proyecto aparecen como **untracked** respecto al Git superior.
- Por tanto, si se migra por Git sin commit/stage explícito, **no viajarán** `AGENTS.md`, `.gitignore`, `PROJECT_CONTEXT.md` ni `skills/`.
- `.atl/` además está ignorado en `.gitignore`, así que tampoco viajará por Git salvo copia manual.

## Archivos importantes para migrar

Copiar sí o sí:

- `AGENTS.md`
- `.gitignore`
- `skills/`
- `.atl/skill-registry.md` si se quiere conservar el índice generado
- Este archivo: `PROJECT_CONTEXT.md`

Si se migra con Git, primero hay que convertir `WEB MASTER` en repo propio o añadir/commitear explícitamente los archivos en el repo correspondiente. Si no, copiar la carpeta completa manualmente.

## Skills del proyecto

| Skill | Uso |
|---|---|
| `skills/web-project-standards/SKILL.md` | Reglas web del proyecto, arquitectura, seguridad, calidad y validación. |
| `skills/design-taste-frontend/SKILL.md` | Diseño frontend premium, landing pages y UI polish. |
| `skills/redesign-existing-projects/SKILL.md` | Auditoría/rediseño de interfaces existentes. |
| `skills/image-to-code/SKILL.md` | Implementación desde screenshots, mockups o referencias visuales. |
| `skills/webapp-testing/SKILL.md` | Playwright, smoke tests, servidor local y regresión web. |

## Reglas de trabajo importantes

- Responder corto por defecto.
- Preguntar como máximo una cosa cada vez.
- No aceptar claims técnicos sin verificar.
- No añadir `Co-Authored-By` ni atribución IA en commits.
- Usar conventional commits.
- Artefactos técnicos en inglés salvo que el proyecto ya use español o el usuario lo pida.
- Para cambios sustanciales, usar SDD.
- Para implementación multiarchivo, delegar o revisar con contexto fresco.
- Antes de finalizar tareas: verificar archivos, ejecutar/recomendar pruebas y reportar riesgos.

## Próximo arranque recomendado en el nuevo PC

1. Abrir la carpeta `WEB MASTER` en Codex.
2. Pedir: “Continuemos con Vivetutiempo desde `PROJECT_CONTEXT.md`”.
3. Verificar que existen `AGENTS.md`, `skills/` y este archivo.
4. Regenerar o copiar `.atl/skill-registry.md` si no existe.
5. Ejecutar/verificar `sdd-init` de nuevo si Engram no recupera `web master`.
6. Continuar SDD en modo `hybrid`.
7. Crear `openspec/` con el primer cambio: `bootstrap-vivetutiempo-platform`.
8. Planificar antes de scaffold: propuesta → specs → diseño → tareas.
9. Scaffold de app solo después de aprobar la planificación.

## Primera pregunta pendiente para continuar

Antes de generar propuesta/specs/diseño, elegir modo SDD:

- **Interactivo**: revisar cada fase antes de seguir. Recomendado para trabajo final.
- **Automático**: generar todas las fases de planificación seguidas y revisar al final.

Recomendación del orquestador: **interactivo**.

## Mensaje corto para retomar

Usar este prompt en el nuevo PC:

```text
Continuemos con Vivetutiempo desde PROJECT_CONTEXT.md. Quiero seguir con SDD en modo hybrid e interactivo para crear el primer cambio bootstrap-vivetutiempo-platform.
```

10. Una vez exista package.json y test runner, actualizar SDD init/testing capabilities para activar Strict TDD si corresponde.


