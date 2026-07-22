/**
 * In-memory fake adapters implementing the application ports.
 *
 * The unit-of-work fakes simulate LOCK-FIRST semantics (ADR D4/D7): every
 * `withLocked*` call is serialized on a queue (one "transaction" at a time),
 * reads the LIVE state from the backing store at callback time (never a
 * pre-enqueue snapshot), persists inside the same critical section, and
 * rolls back on failure — enough to exercise use-case behavior and the
 * race-relevant orderings at the unit level. The real Prisma adapters
 * (SELECT ... FOR UPDATE) are PR 2b.
 */
import type { Account } from "@domain/account/Account";
import type { Event } from "@domain/event/Event";
import type { Profile } from "@domain/profile/Profile";
import type { Proposal } from "@domain/proposal/Proposal";
import type { Clock } from "@domain/shared/Clock";
import type { Slot } from "@domain/slot/Slot";
import { NotFoundError } from "@application/errors";
import type {
  AccountRecord,
  AccountRepository,
} from "@application/ports/AccountRepository";
import type { EventRepository } from "@application/ports/EventRepository";
import type { IdGenerator } from "@application/ports/IdGenerator";
import type {
  LoginAttemptKey,
  LoginRateLimiter,
} from "@application/ports/LoginRateLimiter";
import type {
  LockedSlotWork,
  MatchingUnitOfWork,
} from "@application/ports/MatchingUnitOfWork";
import type { PasswordHasher } from "@application/ports/PasswordHasher";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type {
  LockedProfileWork,
  ProfileUnitOfWork,
} from "@application/ports/ProfileUnitOfWork";
import type { ProposalRepository } from "@application/ports/ProposalRepository";
import type { PublicEventProjectionQuery } from "@application/ports/PublicEventProjectionQuery";
import type { PublicEventProjection } from "@application/dto/PublicEventProjection";
import type { PublicHospitalDirectoryQuery } from "@application/ports/PublicHospitalDirectoryQuery";
import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";
import type {
  RegistrationWork,
  RegistrationUnitOfWork,
} from "@application/ports/RegistrationUnitOfWork";
import type { Session, SessionPort } from "@application/ports/SessionPort";
import type { SlotRepository } from "@application/ports/SlotRepository";
import type {
  OpenSlotListingItem,
  OpenSlotListingQuery,
} from "@application/ports/OpenSlotListingQuery";
import type { PendingProfileView } from "@application/dto/PendingProfileView";
import type { PendingProfileQuery } from "@application/ports/PendingProfileQuery";
import type { HospitalSlotView } from "@application/dto/HospitalSlotView";
import type { HospitalSlotBoardQuery } from "@application/ports/HospitalSlotBoardQuery";

export const NOW = new Date("2026-07-10T12:00:00Z");

export const fixedClock: Clock = { now: () => NOW };

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;
  constructor(private readonly prefix = "id") {}
  next(): string {
    return `${this.prefix}-${++this.counter}`;
  }
}

/**
 * Reversible "hash" — good enough to assert hashing is actually used.
 * `needsRehash` treats a `legacy:`-prefixed value as a stand-in for a
 * pre-pr2b-M2 hash whose parameters are below the current baseline, so
 * tests can exercise the upgrade-on-login path without real Argon2id.
 */
export class FakePasswordHasher implements PasswordHasher {
  async hash(plaintext: string): Promise<string> {
    return `hashed:${plaintext}`;
  }
  async verify(plaintext: string, passwordHash: string): Promise<boolean> {
    return (
      passwordHash === `hashed:${plaintext}` ||
      passwordHash === `legacy:${plaintext}`
    );
  }
  needsRehash(passwordHash: string): boolean {
    return passwordHash.startsWith("legacy:");
  }
}

/**
 * pr2b-B1: mirrors the real adapter's collapsed `consumeAttempt` +
 * `recordSuccess` contract — no separate isAllowed/recordFailure split.
 * `attempts` records every `consumeAttempt` call (allowed or not), so
 * existing "denies and records" assertions read the same signal the old
 * `failures` array gave, just against the single unified entry point.
 */
export class FakeLoginRateLimiter implements LoginRateLimiter {
  readonly attempts: LoginAttemptKey[] = [];
  readonly successes: LoginAttemptKey[] = [];
  /** Keys currently denied — tests flip this to simulate a lockout. */
  blockedEmails = new Set<string>();

  async consumeAttempt(key: LoginAttemptKey): Promise<boolean> {
    this.attempts.push(key);
    return !this.blockedEmails.has(key.email);
  }
  async recordSuccess(key: LoginAttemptKey): Promise<void> {
    this.successes.push(key);
  }
}

export class InMemoryAccountRepository implements AccountRepository {
  private records = new Map<string, AccountRecord>();

  async findByEmail(email: string): Promise<AccountRecord | null> {
    for (const record of this.records.values()) {
      if (record.account.email === email) return record;
    }
    return null;
  }
  async findById(id: string): Promise<Account | null> {
    return this.records.get(id)?.account ?? null;
  }
  async save(record: AccountRecord): Promise<void> {
    this.records.set(record.account.id, record);
  }
  /** Snapshot/restore (pr2a-M5): lets a unit-of-work fake roll back atomically on failure. */
  snapshot(): Map<string, AccountRecord> {
    return new Map(this.records);
  }
  restore(snapshot: Map<string, AccountRecord>): void {
    this.records = snapshot;
  }
}

export class InMemoryProfileRepository implements ProfileRepository {
  private profiles = new Map<string, Profile>();

  async findById(id: string): Promise<Profile | null> {
    return this.profiles.get(id) ?? null;
  }
  async findByAccountId(accountId: string): Promise<Profile | null> {
    for (const profile of this.profiles.values()) {
      if (profile.accountId === accountId) return profile;
    }
    return null;
  }
  async save(profile: Profile): Promise<void> {
    this.profiles.set(profile.id, profile);
  }
  snapshot(): Map<string, Profile> {
    return new Map(this.profiles);
  }
  restore(snapshot: Map<string, Profile>): void {
    this.profiles = snapshot;
  }
}

export class InMemorySlotRepository implements SlotRepository {
  private slots = new Map<string, Slot>();

  async findById(id: string): Promise<Slot | null> {
    return this.slots.get(id) ?? null;
  }
  async listOpen(): Promise<readonly Slot[]> {
    return [...this.slots.values()].filter((s) => s.status === "open");
  }
  async save(slot: Slot): Promise<void> {
    this.slots.set(slot.id, slot);
  }
  /** Snapshot/restore (pr2a-M4): lets `FakeMatchingUnitOfWork` roll back the persist phase atomically on a mid-write failure. */
  snapshot(): Map<string, Slot> {
    return new Map(this.slots);
  }
  restore(snapshot: Map<string, Slot>): void {
    this.slots = snapshot;
  }
}

export class InMemoryProposalRepository implements ProposalRepository {
  private proposals = new Map<string, Proposal>();

  async findById(id: string): Promise<Proposal | null> {
    return this.proposals.get(id) ?? null;
  }
  async listBySlotId(slotId: string): Promise<readonly Proposal[]> {
    return [...this.proposals.values()].filter((p) => p.slotId === slotId);
  }
  async save(proposal: Proposal): Promise<void> {
    this.proposals.set(proposal.id, proposal);
  }
  snapshot(): Map<string, Proposal> {
    return new Map(this.proposals);
  }
  restore(snapshot: Map<string, Proposal>): void {
    this.proposals = snapshot;
  }
}

export class InMemoryEventRepository implements EventRepository {
  private events = new Map<string, Event>();

  async findById(id: string): Promise<Event | null> {
    return this.events.get(id) ?? null;
  }
  async save(event: Event): Promise<void> {
    this.events.set(event.id, event);
  }
  all(): readonly Event[] {
    return [...this.events.values()];
  }
  snapshot(): Map<string, Event> {
    return new Map(this.events);
  }
  restore(snapshot: Map<string, Event>): void {
    this.events = snapshot;
  }
}

/** Idle-expiry window (D7): 30 minutes since `lastActiveAt`. */
export const SESSION_IDLE_EXPIRY_MS = 30 * 60 * 1000;
/** Absolute-expiry window (D7): 12 hours since `createdAt`. */
export const SESSION_ABSOLUTE_EXPIRY_MS = 12 * 60 * 60 * 1000;

/**
 * `SessionPort` fake (pr2a-M4): unlike the earlier version, `resolveValid`
 * NOW ENFORCES both the absolute and the idle expiry the port contract
 * promises — a stored row past either deadline resolves to `null`, exactly
 * like the real Postgres adapter's contract (D7). `touch` resets the idle
 * clock, which `resolveValid` honors.
 */
export class FakeSessionPort implements SessionPort {
  sessions = new Map<string, Session>();
  private counter = 0;
  constructor(private readonly clock: Clock = fixedClock) {}

  async create(accountId: string): Promise<Session> {
    const now = this.clock.now();
    const session: Session = {
      id: `session-${++this.counter}`, // ALWAYS fresh — rotation contract
      accountId,
      createdAt: now,
      lastActiveAt: now,
      absoluteExpiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_EXPIRY_MS),
    };
    this.sessions.set(session.id, session);
    return session;
  }
  async resolveValid(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const now = this.clock.now().getTime();
    if (now >= session.absoluteExpiresAt.getTime()) return null;
    if (now - session.lastActiveAt.getTime() >= SESSION_IDLE_EXPIRY_MS) return null;
    return session;
  }
  async touch(sessionId: string): Promise<boolean> {
    // pr2b-M1: mirrors the real adapter's guard — conditional on BOTH
    // absolute AND idle validity, never absolute expiry alone.
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const now = this.clock.now().getTime();
    const absoluteExpired = now >= session.absoluteExpiresAt.getTime();
    const idleExpired =
      now - session.lastActiveAt.getTime() >= SESSION_IDLE_EXPIRY_MS;
    if (absoluteExpired || idleExpired) {
      this.sessions.delete(sessionId);
      return false;
    }
    this.sessions.set(sessionId, {
      ...session,
      lastActiveAt: this.clock.now(),
    });
    return true;
  }
  async revokeOne(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
  async revokeAllForAccount(accountId: string): Promise<void> {
    for (const [id, session] of this.sessions) {
      if (session.accountId === accountId) this.sessions.delete(id);
    }
  }
  sessionsForAccount(accountId: string): readonly Session[] {
    return [...this.sessions.values()].filter(
      (s) => s.accountId === accountId,
    );
  }
}

/**
 * Lock-first fake (ADR D4/B2, unified per recheck-pr2a-verify-M2): serializes
 * every `withLockedSlot` call, reads the LIVE Slot + complete Proposal set
 * from the backing stores INSIDE the critical section (so a call enqueued
 * behind another observes the first one's committed writes — the
 * race-relevant ordering), persists the returned mutation before releasing,
 * and persists NOTHING when `work` throws.
 *
 * recheck-pr2a-verify-M2: ALSO reads the acting Account's LIVE Profile
 * (from the SAME `profiles` store, looked up by `actorAccountId`) INSIDE
 * the same critical section that later persists the mutation, and passes it
 * as `work`'s 3rd argument — simulating the real Prisma adapter's atomic
 * Account-lock-plus-Profile-read, so this fake no longer needs a separate
 * `ProfileUnitOfWork` call to authorize a Slot-mutating use case.
 *
 * pr2a-M4: the PERSIST phase (writing the returned mutation) is now
 * snapshot/rollback-protected — a failure partway through persisting
 * (Slot saved, then a Proposal or the Event save throws) restores every
 * backing store to its pre-persist state, mirroring the real Postgres
 * transaction's all-or-nothing commit. Unlike a `work` throw (which
 * persists nothing because nothing has been written yet), this covers a
 * failure DURING the write sequence itself.
 */
export class FakeMatchingUnitOfWork implements MatchingUnitOfWork {
  private queue: Promise<unknown> = Promise.resolve();
  /** Slot ids locked, in order — lets tests assert lock-first sequencing. */
  readonly lockLog: string[] = [];

  constructor(
    private readonly slots: InMemorySlotRepository,
    private readonly proposals: InMemoryProposalRepository,
    private readonly events: InMemoryEventRepository,
    private readonly profiles: InMemoryProfileRepository,
  ) {}

  withLockedSlot<T>(
    slotId: string,
    actorAccountId: string,
    work: LockedSlotWork<T>,
  ): Promise<T> {
    const run = this.queue.then(async () => {
      this.lockLog.push(slotId);
      const slot = await this.slots.findById(slotId); // LIVE read inside the lock
      if (!slot) throw new NotFoundError(`Slot '${slotId}' does not exist`);
      const proposals = await this.proposals.listBySlotId(slotId);
      // Atomic Account-lock-plus-Profile-read simulation (recheck-pr2a-verify-M2).
      const actorProfile = await this.profiles.findByAccountId(actorAccountId);
      const { mutation, result } = await work(slot, proposals, actorProfile);

      const slotsSnapshot = this.slots.snapshot();
      const proposalsSnapshot = this.proposals.snapshot();
      const eventsSnapshot = this.events.snapshot();
      try {
        if (mutation.slot) await this.slots.save(mutation.slot);
        for (const proposal of mutation.proposals ?? []) {
          await this.proposals.save(proposal);
        }
        if (mutation.event) await this.events.save(mutation.event);
      } catch (error) {
        // pr2a-M4: roll back the WHOLE persist phase, not just the write
        // that failed — no partial mutation survives.
        this.slots.restore(slotsSnapshot);
        this.proposals.restore(proposalsSnapshot);
        this.events.restore(eventsSnapshot);
        throw error;
      }
      return result;
    });
    this.queue = run.catch(() => undefined); // keep serving after a failure
    return run;
  }
}

/**
 * Lock-first Profile/session fake (ADR D7/M3): serializes every
 * `withLockedProfile` call, reads the LIVE Profile inside the critical
 * section, and rolls BOTH the profile store and the session store back when
 * `work` throws — a transition and its session effect are one atomic unit.
 */
export class FakeProfileUnitOfWork implements ProfileUnitOfWork {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly profiles: InMemoryProfileRepository,
    private readonly sessionPort: FakeSessionPort,
    /** Optional wrapper (e.g. failure injector) exposed to `work` as ctx.sessions. */
    private readonly sessionsForWork: SessionPort = sessionPort,
    /** Transaction-scoped Slot store used by publishSlot. */
    private readonly slots: InMemorySlotRepository = new InMemorySlotRepository(),
  ) {}

  withLockedProfile<T>(
    accountId: string,
    work: LockedProfileWork<T>,
  ): Promise<T> {
    const run = this.queue.then(async () => {
      const profileSnapshot = this.profiles.snapshot();
      const sessionSnapshot = new Map(this.sessionPort.sessions);
      const slotsSnapshot = this.slots.snapshot();
      try {
        const profile = await this.profiles.findByAccountId(accountId);
        return await work({
          profile,
          saveProfile: (p: Profile) => this.profiles.save(p),
          sessions: this.sessionsForWork,
          slots: this.slots,
        });
      } catch (error) {
        this.profiles.restore(profileSnapshot); // atomic rollback
        this.sessionPort.sessions = sessionSnapshot;
        this.slots.restore(slotsSnapshot);
        throw error;
      }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}

export class FakePublicEventProjectionQuery
  implements PublicEventProjectionQuery
{
  constructor(private readonly items: readonly PublicEventProjection[]) {}
  async listPublished(): Promise<readonly PublicEventProjection[]> {
    return this.items;
  }
}

/**
 * `PublicHospitalDirectoryQuery` fake (D9, Phase 1.1) — mirrors
 * `FakePublicEventProjectionQuery`'s shape: a plain in-memory list, no
 * filtering logic (the fake trusts caller-supplied data is already
 * ACTIVE+HOSPITAL-filtered, exactly like the real Prisma adapter's `where`
 * clause is the port's implementation detail, not the fake's job).
 */
export class FakePublicHospitalDirectoryQuery
  implements PublicHospitalDirectoryQuery
{
  constructor(private readonly items: readonly PublicHospitalProjection[]) {}
  async listActive(): Promise<readonly PublicHospitalProjection[]> {
    return this.items;
  }
}

/**
 * Lock-first registration fake (pr2a-M5): serializes every
 * `withLockedRegistration` call on the SAME queue keyed by nothing but call
 * order (mirrors the other unit-of-work fakes — one "transaction" at a
 * time), reads the LIVE Account/Profile for the email INSIDE the critical
 * section, and rolls BOTH stores back atomically when `work` throws —
 * closing the pr2a-M5 gap where an Account could be saved and a subsequent
 * Profile save could fail, leaving an orphan Account.
 */
export class FakeRegistrationUnitOfWork implements RegistrationUnitOfWork {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly accounts: InMemoryAccountRepository,
    private readonly profiles: InMemoryProfileRepository,
  ) {}

  withLockedRegistration<T>(
    email: string,
    work: RegistrationWork<T>,
  ): Promise<T> {
    const run = this.queue.then(async () => {
      const accountsSnapshot = this.accounts.snapshot();
      const profilesSnapshot = this.profiles.snapshot();
      try {
        const record = await this.accounts.findByEmail(email);
        const existing = record
          ? {
              account: record.account,
              passwordHash: record.passwordHash,
              profile: await this.profiles.findByAccountId(record.account.id),
            }
          : null;

        return await work({
          existing,
          createAccountAndProfile: async (account, passwordHash, profile) => {
            await this.accounts.save({ account, passwordHash });
            await this.profiles.save(profile);
          },
          saveProfile: async (profile: Profile) => {
            await this.profiles.save(profile);
          },
        });
      } catch (error) {
        this.accounts.restore(accountsSnapshot);
        this.profiles.restore(profilesSnapshot);
        throw error;
      }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}

/** In-memory `OpenSlotListingQuery` fake (pr2a-N3). */
export class FakeOpenSlotListingQuery implements OpenSlotListingQuery {
  constructor(private readonly items: readonly OpenSlotListingItem[]) {}
  async listOpenUpcoming(now: Date): Promise<readonly OpenSlotListingItem[]> {
    return this.items.filter((item) => item.scheduledAt.getTime() > now.getTime());
  }
}

/** In-memory `PendingProfileQuery` fake — the fake trusts caller-supplied ordering (5.3/5.12). */
export class FakePendingProfileQuery implements PendingProfileQuery {
  constructor(private readonly items: readonly PendingProfileView[]) {}
  async listPending(): Promise<readonly PendingProfileView[]> {
    return this.items;
  }
}

/** In-memory `HospitalSlotBoardQuery` fake — records every `hospitalProfileId` it is called with, so tests can assert scoping (5.4/5.6/5.10). */
export class FakeHospitalSlotBoardQuery implements HospitalSlotBoardQuery {
  readonly calls: string[] = [];
  constructor(private readonly items: readonly HospitalSlotView[]) {}
  async listForHospital(
    hospitalProfileId: string,
  ): Promise<readonly HospitalSlotView[]> {
    this.calls.push(hospitalProfileId);
    return this.items;
  }
}
