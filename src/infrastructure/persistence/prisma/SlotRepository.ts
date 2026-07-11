import type { Slot } from "@domain/slot/Slot";
import type { SlotRepository } from "@application/ports/SlotRepository";
import type { PrismaClientOrTx } from "./client";
import { slotStatusToPrisma, toDomainSlot } from "./mappers";

/** Prisma adapter for `SlotRepository` (Phase 4). Standalone reads only — Slot-mutating writes MUST go through `MatchingUnitOfWork.withLockedSlot` (ADR D4), never through `save` directly, outside of the seed script. */
export class PrismaSlotRepository implements SlotRepository {
  constructor(private readonly client: PrismaClientOrTx) {}

  async findById(id: string): Promise<Slot | null> {
    const row = await this.client.slot.findUnique({ where: { id } });
    return row ? toDomainSlot(row) : null;
  }

  async listOpen(): Promise<readonly Slot[]> {
    const rows = await this.client.slot.findMany({ where: { status: "OPEN" } });
    return rows.map(toDomainSlot);
  }

  async save(slot: Slot): Promise<void> {
    const data = {
      hospitalProfileId: slot.hospitalProfileId,
      title: slot.title,
      description: slot.description,
      scheduledAt: slot.scheduledAt,
      durationMinutes: slot.durationMinutes,
      location: slot.location,
      status: slotStatusToPrisma(slot.status),
    };
    await this.client.slot.upsert({
      where: { id: slot.id },
      create: { id: slot.id, ...data },
      update: data,
    });
  }
}
