import type { Event } from "@domain/event/Event";
import type { EventRepository } from "@application/ports/EventRepository";
import type { PrismaClientOrTx } from "./client";
import { eventStatusToPrisma, toDomainEvent } from "./mappers";

/** Prisma adapter for `EventRepository` (Phase 4). Standalone reads only — Event creation from the accept cascade goes through `MatchingUnitOfWork.withLockedSlot` (ADR D4), never `save` directly, outside of the seed script. */
export class PrismaEventRepository implements EventRepository {
  constructor(private readonly client: PrismaClientOrTx) {}

  async findById(id: string): Promise<Event | null> {
    const row = await this.client.event.findUnique({ where: { id } });
    return row ? toDomainEvent(row) : null;
  }

  async save(event: Event): Promise<void> {
    const data = {
      slotId: event.slotId,
      proposalId: event.proposalId,
      title: event.title,
      status: eventStatusToPrisma(event.status),
    };
    await this.client.event.upsert({
      where: { id: event.id },
      create: { id: event.id, ...data },
      update: data,
    });
  }
}
