# Infrastructure Layer

Concrete adapters implementing the ports declared in `src/application/ports`.

## Layout

- `persistence/prisma/` (Phase 4) — Prisma repositories per aggregate, the
  lock-first `MatchingUnitOfWork`/`ProfileUnitOfWork` (`$transaction` +
  `SELECT ... FOR UPDATE`, ADR D4/D7), and the dedicated
  `PublicEventProjectionQuery` read-model adapter (ADR D6/M6).
- `auth/` (Phase 4) — DB-backed `SessionPort` adapter, argon2id
  `PasswordHasher`, the Postgres-backed `LoginRateLimiter`, and the
  canonical-origin CSRF check (ADR D1/D7).
- `shared/` (Phase 4) — `Clock`/`IdGenerator` adapters.

This layer MAY import `@prisma/client`, Node APIs, and `src/application`
(to implement its ports) and `src/domain` (types only). It MUST NOT be
imported by `src/domain`.
