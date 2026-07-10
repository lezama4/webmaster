# Infrastructure Layer

Concrete adapters implementing the ports declared in `src/application/ports`.

## Layout

- `persistence/prisma/` (Phase 4) — Prisma repositories per aggregate and
  the `MatchingUnitOfWork` (guarded `$transaction`, see ADR D4).
- `auth/` (Phase 4) — DB-backed session adapter and argon2id password
  hasher.

This layer MAY import `@prisma/client`, Node APIs, and `src/application`
(to implement its ports) and `src/domain` (types only). It MUST NOT be
imported by `src/domain`.
